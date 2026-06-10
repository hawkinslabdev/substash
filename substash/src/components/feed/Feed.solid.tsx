import {
  createSignal,
  createEffect,
  on,
  For,
  Show,
  Switch,
  Match,
  onMount,
  onCleanup,
  createMemo,
} from "solid-js";
import {
  createInfiniteQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/solid-query";
import SceneCard from "./SceneCard.solid";
import ImageCard from "./ImageCard.solid";
import { proxyImage } from "@/lib/stash/image";
import type { FeedItem, ImageFeedItem } from "@/lib/stash/feed-item";

interface PageResult {
  items: FeedItem[];
  cursor: string;
  nextCursor: string | null;
  total: number;
  stashError?: boolean;
}

interface Props {
  sort?: string;
  tagId?: string;
  studioId?: string;
  performerId?: string;
  initialData?: PageResult;
}

const preloadMap = new Map<string, HTMLLinkElement>();
const preloadOrder: string[] = [];
const MAX_PRELOADS = 6;

function flushPreloads() {
  for (const link of preloadMap.values()) link.remove();
  preloadMap.clear();
  preloadOrder.length = 0;
}
if (typeof document !== "undefined") {
  document.addEventListener("astro:before-preparation", flushPreloads);
}

const FEED_CACHE_TTL = 30 * 60 * 1000;

interface FeedCache {
  pages: PageResult[];
  pageParams: (string | null)[];
  savedAt: number;
}

function feedCacheKey(
  sort?: string,
  tagId?: string,
  studioId?: string,
  performerId?: string,
): string {
  return `substash:feed:${sort ?? "date"}:${tagId ?? ""}:${studioId ?? ""}:${performerId ?? ""}`;
}

function feedScrollKey(
  sort?: string,
  tagId?: string,
  studioId?: string,
  performerId?: string,
): string {
  return `substash:feed-scroll:${sort ?? "date"}:${tagId ?? ""}:${studioId ?? ""}:${performerId ?? ""}`;
}

function loadFeedCache(
  sort?: string,
  tagId?: string,
  studioId?: string,
  performerId?: string,
): FeedCache | null {
  try {
    const key = feedCacheKey(sort, tagId, studioId, performerId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const data: FeedCache = JSON.parse(raw);
    if (Date.now() - data.savedAt > FEED_CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function FeedSkeleton() {
  return (
    <div class="p-4 space-y-3">
      <div
        class="skeleton-shimmer w-full rounded-lg"
        style={{ "aspect-ratio": "16/9" }}
      />
      <div class="skeleton-shimmer h-3.5 w-2/3" />
      <div class="skeleton-shimmer h-3 w-1/3 opacity-60" />
    </div>
  );
}

const END_MESSAGES = [
  "All caught up",
  "That's all for now",
  "You've reached the bottom",
  "The front page is full",
  "You've seen it all",
  "The well has run dry",
  "Back to the top?",
  "Check back later for more",
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, retry: 1 },
  },
});

async function fetchPage(
  cursor: string | null,
  params: Omit<Props, "initialData">,
): Promise<PageResult> {
  const url = new URL("/api/stash/feed", location.origin);
  if (cursor) url.searchParams.set("cursor", cursor);
  if (params.sort) url.searchParams.set("sort", params.sort);
  if (params.tagId) url.searchParams.set("tag", params.tagId);
  if (params.studioId) url.searchParams.set("studio", params.studioId);
  if (params.performerId) url.searchParams.set("performer", params.performerId);

  const res = await fetch(url.toString());
  const data: PageResult = await res.json();
  if (!res.ok || data.stashError) {
    window.dispatchEvent(
      new CustomEvent("substash:toast", {
        detail: {
          message: "Couldn't reach Stash",
          duration: 5000,
          variant: "error",
        },
      }),
    );
  }
  return data;
}

function FeedInner(props: Props) {
  let touchStartY = 0;
  const [pullY, setPullY] = createSignal(0);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshed, setRefreshed] = createSignal(false);
  // incrementing this key forces a brand-new random fetch, discarding cached pages
  const [refreshKey, setRefreshKey] = createSignal(0);
  const [retryIn, setRetryIn] = createSignal<number | null>(null);
  // ref so the post-load effect can call the scroll check that's defined in onMount
  let checkScrollFn: (() => void) | null = null;
  // track how many items were present at mount so items loaded after this index get feed-enter
  let mounted = false;
  let mountedItemCount = 0;

  const cachedFeed = loadFeedCache(
    props.sort,
    props.tagId,
    props.studioId,
    props.performerId,
  );
  const endMessage = createMemo(() => {
    refreshKey();
    return END_MESSAGES[Math.floor(Math.random() * END_MESSAGES.length)];
  });

  const query = createInfiniteQuery(() => ({
    queryKey: [
      "feed",
      props.sort,
      props.tagId,
      props.studioId,
      props.performerId,
      refreshKey(),
    ],
    queryFn: ({ pageParam }) =>
      fetchPage(pageParam as string | null, {
        sort: props.sort,
        tagId: props.tagId,
        studioId: props.studioId,
        performerId: props.performerId,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: PageResult) => last.nextCursor ?? undefined,
    // Prefer sessionStorage cache (multi-page) over SSR initialData (single page).
    // Both only apply for refreshKey=0 (not after a manual pull-to-refresh).
    // initialDataUpdatedAt=now so TanStack treats it as fresh for staleTime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData: (refreshKey() === 0
      ? cachedFeed
        ? { pages: cachedFeed.pages, pageParams: cachedFeed.pageParams }
        : props.initialData
          ? { pages: [props.initialData], pageParams: [null as string | null] }
          : undefined
      : undefined) as any,
    initialDataUpdatedAt: refreshKey() === 0 ? Date.now() : undefined,
  }));

  const hasStashError = () =>
    query.data?.pages.some((p) => p.stashError) ?? false;

  // Auto-retry countdown: 60s after Stash reports an error.
  // Resets whenever a fetch is in-flight or the error clears.
  createEffect(() => {
    if (!hasStashError() || query.isFetching) {
      setRetryIn(null);
      return;
    }
    setRetryIn(60);
    const id = setInterval(() => {
      setRetryIn((n) => {
        if (n === null || n <= 1) {
          clearInterval(id);
          query.refetch();
          return null;
        }
        return n - 1;
      });
    }, 1000);
    onCleanup(() => {
      clearInterval(id);
      setRetryIn(null);
    });
  });

  // Clear the pull-to-refresh spinner once the new query finishes loading.
  createEffect(() => {
    if (refreshing() && !query.isFetching) {
      setRefreshing(false);
    }
  });

  // Flash a success check when pull-to-refresh completes.
  createEffect(
    on(
      () => refreshing(),
      (isRefreshing, wasRefreshing) => {
        if (!isRefreshing && wasRefreshing) {
          setRefreshed(true);
          setTimeout(() => setRefreshed(false), 700);
        }
      },
      { defer: true },
    ),
  );

  // After each page load, re-check scroll position. New items increase scrollHeight but leave scrollTop unchanged progress drops below the threshold and no scroll events fire until the user moves again, causing an invisible stall.
  createEffect(
    on(
      () => query.isFetchingNextPage,
      (fetching, wasFetching) => {
        if (!fetching && wasFetching) checkScrollFn?.();
      },
      { defer: true },
    ),
  );

  // Persist feed pages to sessionStorage so back-nav restores full content + scroll position. It skips error pages to avoid caching degraded state.
  createEffect(() => {
    const data = query.data;
    if (!data || data.pages.length === 0) return;
    if ((data.pages as PageResult[]).some((p) => p.stashError)) return;
    try {
      sessionStorage.setItem(
        feedCacheKey(
          props.sort,
          props.tagId,
          props.studioId,
          props.performerId,
        ),
        JSON.stringify({
          pages: data.pages,
          pageParams: data.pageParams,
          savedAt: Date.now(),
        } satisfies FeedCache),
      );
    } catch {
      /* storage quota */
    }
  });

  onMount(() => {
    document.getElementById("feed-skeleton")?.remove();
    document.querySelector("[data-feed-skeleton]")?.remove();

    // Snapshot item count at mount; items beyond this index get feed-enter animation.
    mounted = true;
    mountedItemCount = allItems().length;

    // ---- Scroll position save/restore ----
    // Save scrollY continuously so back-nav can restore it exactly.
    // This is independent of PageShell's mechanism and works even if
    // history.back() bypasses Astro's ClientRouter popstate intercept.
    const scrollKey = feedScrollKey(
      props.sort,
      props.tagId,
      props.studioId,
      props.performerId,
    );
    let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;
    function saveScrollPos() {
      if (scrollSaveTimer !== null) clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(() => {
        try {
          sessionStorage.setItem(scrollKey, String(Math.round(window.scrollY)));
        } catch {}
      }, 150);
    }
    window.addEventListener("scroll", saveScrollPos, { passive: true });
    onCleanup(() => {
      window.removeEventListener("scroll", saveScrollPos);
      if (scrollSaveTimer !== null) clearTimeout(scrollSaveTimer);
    });

    // Detect back-nav: SPA traverse (via Astro ClientRouter) or native back_forward (full-page reload).
    // `substash:last-nav-type` is written by PageShell's astro:before-preparation handler.
    const spaNavType = sessionStorage.getItem("substash:last-nav-type");
    const perfNavType = (
      performance.getEntriesByType?.("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined
    )?.type;
    const isBackNav =
      spaNavType === "traverse" || perfNavType === "back_forward";
    // Consume the flag so a later same-tab hard reload doesn't falsely trigger.
    try {
      sessionStorage.removeItem("substash:last-nav-type");
    } catch {}

    if (isBackNav) {
      try {
        const rawY = sessionStorage.getItem(scrollKey);
        if (rawY) {
          const savedY = parseInt(rawY, 10);
          if (Number.isFinite(savedY) && savedY > 0) {
            // Double rAF: first frame lets SolidJS flush, second lets browser reflow.
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                window.scrollTo({ top: savedY, behavior: "instant" });
              });
            });
          }
        }
      } catch {}
    }
    // ---- End scroll save/restore ----

    // Scroll-based prefetch: triggers at 70% of loaded content height. This ensures the next page is in flight well before the user hits the last item avoiding stall
    let rafPending = false;
    function checkScroll() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const el = document.documentElement;
        const progress = (el.scrollTop + el.clientHeight) / el.scrollHeight;
        if (progress >= 0.5 && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      });
    }
    checkScrollFn = checkScroll;
    window.addEventListener("scroll", checkScroll, { passive: true });
    onCleanup(() => {
      window.removeEventListener("scroll", checkScroll);
      checkScrollFn = null;
    });

    // Pull-to-refresh
    function onTouchStart(e: TouchEvent) {
      touchStartY = window.scrollY < 2 ? e.touches[0].clientY : 0;
    }
    function onTouchMove(e: TouchEvent) {
      if (touchStartY === 0 || refreshing()) return;
      const delta = e.touches[0].clientY - touchStartY;
      if (delta > 0) {
        setPullY(Math.min(delta * 0.5, 72));
      } else {
        touchStartY = 0;
        setPullY(0);
      }
    }
    function onTouchEnd() {
      if (pullY() >= 60 && !refreshing()) {
        setRefreshing(true);
        setPullY(0);
        // Clear cache + saved scroll so back-nav after refresh starts fresh.
        try {
          sessionStorage.removeItem(
            feedCacheKey(
              props.sort,
              props.tagId,
              props.studioId,
              props.performerId,
            ),
          );
          sessionStorage.removeItem(
            feedScrollKey(
              props.sort,
              props.tagId,
              props.studioId,
              props.performerId,
            ),
          );
        } catch {}
        if (props.sort === "random") {
          setRefreshKey((k) => k + 1);
        } else {
          query.refetch().finally(() => setRefreshing(false));
        }
      } else {
        setPullY(0);
      }
      touchStartY = 0;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    onCleanup(() => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    });
  });

  createEffect(() => {
    const pages = query.data?.pages ?? [];
    const allItems = pages.flatMap((p) => p.items) as FeedItem[];
    const targets = allItems
      .slice(-3)
      .map((item) => {
        if (item.type === "scene") return proxyImage(item.paths.screenshot);
        // Image: preview first, then thumbnail
        const raw = item.paths.preview || item.paths.thumbnail;
        return raw ? proxyImage(raw) : null;
      })
      .filter(Boolean) as string[];
    for (const url of targets) {
      if (preloadMap.has(url)) continue;
      if (preloadOrder.length >= MAX_PRELOADS) {
        const evicted = preloadOrder.shift()!;
        preloadMap.get(evicted)?.remove();
        preloadMap.delete(evicted);
      }
      const link = Object.assign(document.createElement("link"), {
        rel: "preload",
        as: "image",
        href: url,
      });
      document.head.appendChild(link);
      preloadMap.set(url, link);
      preloadOrder.push(url);
    }
  });

  const allItems = () =>
    (query.data?.pages ?? []).flatMap((p) => p.items) as FeedItem[];

  return (
    <div>
      {/* Pull-to-refresh indicator */}
      <div
        class="flex items-center justify-center overflow-hidden"
        style={{
          height: refreshing() ? "56px" : refreshed() ? "40px" : `${pullY()}px`,
          transition: pullY() === 0 ? "height 300ms ease" : "none",
        }}
      >
        <Show when={refreshing()}>
          <div class="w-5 h-5 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
        </Show>
        <Show when={refreshed()}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            stroke-width="2.5"
            class="refresh-success"
          >
            <polyline
              stroke-linecap="round"
              stroke-linejoin="round"
              points="20 6 9 17 4 12"
            />
          </svg>
        </Show>
        <Show when={!refreshing() && !refreshed() && pullY() > 8}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            style={{
              opacity: Math.min(pullY() / 60, 1),
              color:
                pullY() >= 60
                  ? "var(--color-accent)"
                  : "var(--color-text-muted)",
              transform: `rotate(${pullY() >= 60 ? "180deg" : "0deg"})`,
              transition: "transform 220ms ease, color 220ms ease",
            }}
          >
            <polyline
              stroke-linecap="round"
              stroke-linejoin="round"
              points="23 4 23 10 17 10"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"
            />
          </svg>
        </Show>
      </div>

      <For each={allItems()}>
        {(item, index) => (
          <Switch>
            <Match when={item.type === "scene"}>
              <SceneCard
                scene={item as import("@/lib/stash/feed-item").SceneFeedItem}
                class={
                  mounted && index() >= mountedItemCount
                    ? "feed-enter"
                    : undefined
                }
              />
            </Match>
            <Match when={item.type === "image"}>
              <ImageCard
                image={item as unknown as ImageFeedItem}
                class={
                  mounted && index() >= mountedItemCount
                    ? "feed-enter"
                    : undefined
                }
              />
            </Match>
          </Switch>
        )}
      </For>

      {/* Full-page skeleton: no items yet (initial load, refresh, or stash error) */}
      <Show
        when={allItems().length === 0 && (query.isLoading || hasStashError())}
      >
        <FeedSkeleton />
        <FeedSkeleton />
        <FeedSkeleton />
      </Show>

      {/* Retry countdown shown below skeletons when Stash is unreachable */}
      <Show when={hasStashError() && !query.isFetching}>
        <div class="flex flex-col items-center gap-2 py-4 text-[var(--color-text-muted)]">
          <Show when={retryIn() !== null}>
            <p class="text-xs">Stash unreachable · Retrying in {retryIn()}s</p>
          </Show>
          <button
            onClick={() => {
              setRetryIn(null);
              query.refetch();
            }}
            class="text-xs text-[var(--color-accent)] hover:underline min-h-0 h-auto"
          >
            Retry now
          </button>
        </div>
      </Show>

      <Show when={query.isFetchingNextPage}>
        <FeedSkeleton />
      </Show>

      <div class="h-1" aria-hidden="true" />

      <Show
        when={!query.hasNextPage && allItems().length > 0 && !query.isLoading}
      >
        <div class="end-of-feed-appear flex flex-col items-center gap-2 py-10 text-[var(--color-text-muted)]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="opacity-40"
          >
            <polyline
              stroke-linecap="round"
              stroke-linejoin="round"
              points="20 6 9 17 4 12"
              class="checkmark-draw"
            />
          </svg>
          <p class="text-xs font-medium">{endMessage()}</p>
        </div>
      </Show>
    </div>
  );
}

export default function Feed(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedInner {...props} />
    </QueryClientProvider>
  );
}
