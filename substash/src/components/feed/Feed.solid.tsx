import {
  createSignal,
  createEffect,
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
  // Incrementing this key forces a brand-new random fetch, discarding cached pages.
  const [refreshKey, setRefreshKey] = createSignal(0);

  const endMessage = createMemo(() => {
    // We access refreshKey so the memo updates when the feed is reset
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
    // SSR initial data is only valid for the first key (no refresh yet).
    // initialDataUpdatedAt=now so TanStack treats it as fresh for staleTime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData: (refreshKey() === 0 && props.initialData
      ? { pages: [props.initialData], pageParams: [null as string | null] }
      : undefined) as any,
    initialDataUpdatedAt: refreshKey() === 0 ? Date.now() : undefined,
  }));

  // Clear the pull-to-refresh spinner once the new query finishes loading.
  createEffect(() => {
    if (refreshing() && !query.isFetching) {
      setRefreshing(false);
    }
  });

  onMount(() => {
    // Scroll-based prefetch: triggers at 70% of loaded content height.
    // This ensures the next page is in flight well before the user hits the
    // last item, avoiding any visible stall.
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
    window.addEventListener("scroll", checkScroll, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", checkScroll));

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
        if (props.sort === "random") {
          // New key → new query → completely fresh shuffle.
          // The createEffect above clears refreshing when isFetching drops.
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
          height: refreshing() ? "56px" : `${pullY()}px`,
          transition: pullY() === 0 ? "height 300ms ease" : "none",
        }}
      >
        <Show when={refreshing()}>
          <div class="w-5 h-5 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
        </Show>
        <Show when={!refreshing() && pullY() > 8}>
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
                  index() >= (query.data?.pages.length ?? 1) * 20 - 20 &&
                  index() < (query.data?.pages.length ?? 1) * 20
                    ? "feed-enter"
                    : undefined
                }
              />
            </Match>
            <Match when={item.type === "image"}>
              <ImageCard
                image={item as unknown as ImageFeedItem}
                class={
                  index() >= (query.data?.pages.length ?? 1) * 20 - 20 &&
                  index() < (query.data?.pages.length ?? 1) * 20
                    ? "feed-enter"
                    : undefined
                }
              />
            </Match>
          </Switch>
        )}
      </For>

      {/* Loading skeleton — shimmer, shown after refresh */}
      <Show when={query.isLoading && refreshKey() > 0}>
        <FeedSkeleton />
        <FeedSkeleton />
      </Show>

      <Show when={query.isFetchingNextPage}>
        <FeedSkeleton />
      </Show>

      <div class="h-1" aria-hidden="true" />

      <Show
        when={!query.hasNextPage && allItems().length > 0 && !query.isLoading}
      >
        <div class="flex flex-col items-center gap-2 py-10 text-[var(--color-text-muted)]">
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
