import {
  createSignal,
  createEffect,
  on,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import {
  createInfiniteQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/solid-query";
import VideoPlayer from "./VideoPlayer.solid";
import MediaActionRail from "./MediaActionRail.solid";
import { fetchPage, type PageResult } from "./Feed.solid";
import { anySheetOpen } from "@/components/post/CommentSheet.solid";
import { useVote } from "@/lib/hooks/useVote";
import { proxyImage } from "@/lib/stash/image";
import type { FeedItem } from "@/lib/stash/feed-item";

interface Props {
  sort?: string;
  initialData?: PageResult;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, retry: 1 },
  },
});

/** Clears the bottom nav pill: pill top ≈ safe-area + 76px */
const OVERLAY_BOTTOM = "calc(env(safe-area-inset-bottom, 0px) + 88px)";

const CACHE_TTL = 30 * 60 * 1000;

interface ImmersiveCache {
  pages: PageResult[];
  pageParams: (string | null)[];
  savedAt: number;
}

const cacheKey = (sort?: string) => `substash:immersive:${sort ?? "random"}`;
const indexKey = (sort?: string) =>
  `substash:immersive-index:${sort ?? "random"}`;

// /api/stash/feed ignores the cursor seed, so caching pages is the only way to keep place
function loadCache(sort?: string): ImmersiveCache | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(sort));
    if (!raw) return null;
    const data: ImmersiveCache = JSON.parse(raw);
    if (Date.now() - data.savedAt > CACHE_TTL) {
      sessionStorage.removeItem(cacheKey(sort));
      return null;
    }
    return data.pages?.length ? data : null;
  } catch {
    return null;
  }
}

function loadIndex(sort?: string): number {
  try {
    const n = Number(sessionStorage.getItem(indexKey(sort)));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function originHref(item: FeedItem): string {
  if (!item.subredditExtracted) return "/discover";
  return item.subreddit.startsWith("u_")
    ? `/search?user=${encodeURIComponent(item.subreddit.slice(2))}`
    : `/search?r=${encodeURIComponent(item.subreddit)}`;
}

function ImmersiveItem(props: {
  item: FeedItem;
  near: boolean;
  nearish: boolean;
}) {
  let wrapper: HTMLDivElement | undefined;
  const item = () => props.item;
  const isScene = () => item().type === "scene";
  const poster = () => {
    const it = item();
    const raw = it.type === "scene" ? it.paths.screenshot : it.paths.thumbnail;
    return raw ? proxyImage(raw) : null;
  };
  const videoSrc = () => {
    const it = item();
    if (it.type === "scene") return it.paths.stream;
    return it.paths.preview ? proxyImage(it.paths.preview) : null;
  };
  const detailHref = () =>
    `/${item().type === "scene" ? "scenes" : "images"}/${item().id}`;

  // Single tap: play/pause. Double tap: like + heart burst.
  const vote = useVote({
    id: props.item.id,
    mediaType: props.item.type,
    initialCount: props.item.o_counter ?? 0,
    title: props.item.title ?? undefined,
    thumbnailUrl: poster() ?? undefined,
  });
  const [heart, setHeart] = createSignal(false);
  let tapTimer: number | undefined;

  function handleTap(e: MouseEvent) {
    if ((e.target as Element).closest("button, a")) return;
    if (tapTimer !== undefined) {
      clearTimeout(tapTimer);
      tapTimer = undefined;
      setHeart(false);
      requestAnimationFrame(() => setHeart(true));
      setTimeout(() => setHeart(false), 800);
      vote.vote();
      return;
    }
    tapTimer = window.setTimeout(() => {
      tapTimer = undefined;
      const video = wrapper?.querySelector("video");
      if (video) {
        video.paused ? video.play().catch(() => {}) : video.pause();
      }
    }, 260);
  }

  return (
    <div ref={wrapper} class="w-full h-full" onClick={handleTap}>
      {/* Blurred backdrop fills letterbox */}
      <Show when={props.nearish && poster()}>
        {(url) => (
          <img
            src={url()}
            alt=""
            class="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-50"
            aria-hidden="true"
            decoding="async"
          />
        )}
      </Show>

      {/* Media: full video only within the ±1 window, poster otherwise */}
      <Show
        when={props.near && videoSrc()}
        fallback={
          <Show when={props.nearish && poster()}>
            {(url) => (
              <img
                src={url()}
                alt={item().title ?? ""}
                class="relative z-10 w-full h-full object-contain"
                decoding="async"
              />
            )}
          </Show>
        }
      >
        {(src) => (
          <Show
            when={isScene()}
            fallback={
              <video
                src={src()}
                poster={poster() ?? undefined}
                class="relative z-10 w-full h-full object-contain"
                preload="metadata"
                autoplay
                loop
                muted
                playsinline
              />
            }
          >
            <VideoPlayer
              id={item().id}
              src={src()}
              poster={poster()}
              class="relative z-10 w-full h-full"
              mutePos="top-right"
              warm
            />
          </Show>
        )}
      </Show>

      <MediaActionRail
        mediaId={item().id}
        mediaType={item().type}
        initialLikes={item().o_counter ?? 0}
        commentCount={item().commentCount}
        title={item().title}
        thumbnailUrl={poster() ?? undefined}
        bottomOffset={OVERLAY_BOTTOM}
        persistent
      />

      {/* Title + origin overlay */}
      <div
        class="absolute left-4 right-20 z-20 flex flex-col gap-1"
        style={{ bottom: OVERLAY_BOTTOM }}
      >
        <a
          href={originHref(item())}
          class="text-xs font-bold text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] w-fit"
        >
          {item().originDisplay}
        </a>
        <a href={detailHref()} data-astro-prefetch="viewport" class="w-fit">
          <h2 class="text-[17px] font-semibold leading-snug tracking-[-0.01em] line-clamp-2 text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.75)]">
            {item().title ?? "Untitled"}
          </h2>
        </a>
      </div>

      {/* Double-tap heart burst */}
      <Show when={heart()}>
        <div class="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <svg
            class="heart-burst"
            width="84"
            height="84"
            viewBox="0 0 24 24"
            fill="white"
            style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.45))" }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
      </Show>
    </div>
  );
}

function ImmersiveInner(props: Props) {
  let container: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;
  const [active, setActive] = createSignal(0);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshKey, setRefreshKey] = createSignal(0);
  let touchStartY = 0;

  // Read before any effect runs — the index effect below would overwrite it
  const cached = loadCache(props.sort);
  const savedIndex = cached ? loadIndex(props.sort) : 0;

  const query = createInfiniteQuery(() => ({
    queryKey: ["immersive-feed", props.sort, refreshKey()],
    queryFn: ({ pageParam }) =>
      fetchPage(pageParam as string | null, { sort: props.sort }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: PageResult) => last.nextCursor ?? undefined,
    // Cached pages beat SSR initialData: they carry every page the user scrolled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData: (refreshKey() === 0
      ? cached
        ? { pages: cached.pages, pageParams: cached.pageParams }
        : props.initialData
          ? { pages: [props.initialData], pageParams: [null as string | null] }
          : undefined
      : undefined) as any,
    initialDataUpdatedAt: refreshKey() === 0 ? Date.now() : undefined,
  }));

  const items = () =>
    (query.data?.pages ?? []).flatMap((p) => p.items) as FeedItem[];

  function getObserver(): IntersectionObserver {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
              const idx = Number((entry.target as HTMLElement).dataset.index);
              if (!Number.isNaN(idx)) setActive(idx);
            }
          }
        },
        { root: container, threshold: [0.6] },
      );
    }
    return observer;
  }

  // Fetch the next page two items before the end
  createEffect(() => {
    if (
      items().length > 0 &&
      items().length - active() <= 3 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      query.fetchNextPage();
    }
  });

  createEffect(() => {
    if (refreshing() && !query.isFetching) setRefreshing(false);
  });

  // Persist pages + position so returning from a media page lands where you left
  createEffect(() => {
    const data = query.data;
    if (!data || data.pages.length === 0) return;
    try {
      sessionStorage.setItem(
        cacheKey(props.sort),
        JSON.stringify({
          pages: data.pages,
          pageParams: data.pageParams as (string | null)[],
          savedAt: Date.now(),
        } satisfies ImmersiveCache),
      );
    } catch {
      /* storage quota */
    }
  });

  createEffect(() => {
    try {
      sessionStorage.setItem(indexKey(props.sort), String(active()));
    } catch {
      /* storage quota */
    }
  });

  // Refresh restarts from the top with a fresh random page
  createEffect(
    on(
      refreshKey,
      () => {
        setActive(0);
        container?.scrollTo({ top: 0, behavior: "instant" });
        try {
          sessionStorage.removeItem(cacheKey(props.sort));
        } catch {
          /* storage unavailable */
        }
      },
      { defer: true },
    ),
  );

  onMount(() => {
    document.querySelector("[data-immersive-skeleton]")?.remove();

    // Restore position after the restored pages have rendered
    if (savedIndex > 0) {
      setActive(savedIndex);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!container) return;
          container.scrollTo({
            top: savedIndex * container.clientHeight,
            behavior: "instant",
          });
        }),
      );
    }

    // Keyboard paging (desktop)
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (anySheetOpen()) return;
      if ((e.target as Element)?.closest("input, textarea, [contenteditable]"))
        return;
      e.preventDefault();
      container?.scrollBy({
        top:
          e.key === "ArrowDown"
            ? container.clientHeight
            : -container.clientHeight,
        behavior: "smooth",
      });
    }
    document.addEventListener("keydown", onKeydown);

    // Pull-to-refresh at the first item
    function onTouchStart(e: TouchEvent) {
      touchStartY = (container?.scrollTop ?? 1) < 2 ? e.touches[0].clientY : 0;
    }
    function onTouchEnd(e: TouchEvent) {
      if (touchStartY === 0 || refreshing()) return;
      const delta = e.changedTouches[0].clientY - touchStartY;
      if (delta > 90 && (container?.scrollTop ?? 1) < 2) {
        setRefreshing(true);
        setRefreshKey((k) => k + 1);
      }
      touchStartY = 0;
    }
    container?.addEventListener("touchstart", onTouchStart, { passive: true });
    container?.addEventListener("touchend", onTouchEnd, { passive: true });

    onCleanup(() => {
      document.removeEventListener("keydown", onKeydown);
      container?.removeEventListener("touchstart", onTouchStart);
      container?.removeEventListener("touchend", onTouchEnd);
      observer?.disconnect();
    });
  });

  return (
    <div ref={container} class="immersive-container">
      {/* Refresh spinner */}
      <Show when={refreshing()}>
        <div class="fixed top-[calc(env(safe-area-inset-top,0px)+16px)] left-1/2 -translate-x-1/2 z-40">
          <div class="glass rounded-full p-2.5">
            <div class="w-5 h-5 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
          </div>
        </div>
      </Show>

      <For each={items()}>
        {(item, index) => (
          <section
            class="immersive-item"
            data-index={index()}
            ref={(el) => getObserver().observe(el)}
          >
            <ImmersiveItem
              item={item}
              near={Math.abs(index() - active()) <= 1}
              nearish={Math.abs(index() - active()) <= 2}
            />
          </section>
        )}
      </For>

      {/* Initial load / error */}
      <Show when={items().length === 0}>
        <section class="immersive-item flex flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
          <Show
            when={query.isLoading || query.isFetching}
            fallback={
              <>
                <p class="text-sm">Nothing to show</p>
                <button
                  onClick={() => query.refetch()}
                  class="text-sm text-[var(--color-accent)]"
                >
                  Retry
                </button>
              </>
            }
          >
            <div class="w-6 h-6 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
          </Show>
        </section>
      </Show>

      {/* End of feed */}
      <Show when={!query.hasNextPage && items().length > 0}>
        <section class="immersive-item flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
          <svg
            width="22"
            height="22"
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
          <p class="text-sm font-medium">You've seen it all</p>
        </section>
      </Show>
    </div>
  );
}

export default function ImmersiveFeed(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <ImmersiveInner {...props} />
    </QueryClientProvider>
  );
}
