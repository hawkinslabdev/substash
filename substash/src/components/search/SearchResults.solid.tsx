import {
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
  Switch,
  Match,
} from "solid-js";
import {
  createInfiniteQuery,
  createQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/solid-query";
import SceneCard from "@/components/feed/SceneCard.solid";
import ImageCard from "@/components/feed/ImageCard.solid";
import type {
  FeedItem,
  ImageFeedItem,
  SceneFeedItem,
} from "@/lib/stash/feed-item";
import { proxyImage } from "@/lib/stash/image";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType =
  | "all"
  | "scenes"
  | "images"
  | "tags"
  | "performers"
  | "studios"
  | "comments";

interface EntityResult {
  stashId: string;
  entityType: "tag" | "performer" | "studio";
  name: string;
  imagePath: string | null;
  count: number;
}

interface CommentHit {
  commentId: string;
  body: string;
  createdAt: number;
  stashId: string;
  mediaType: "scene" | "image";
  mediaItem: FeedItem | null;
}

interface PageResult {
  items: FeedItem[];
  entities: EntityResult[];
  commentHits: CommentHit[];
  nextCursor: string | null;
  total: number;
  syncing?: boolean;
}

interface SyncStatus {
  inProgress: boolean;
  totalIndexed: number;
  isEmpty: boolean;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchSearchPage(
  cursor: string | null,
  q: string,
  type: FilterType,
): Promise<PageResult> {
  const url = new URL("/api/stash/search", location.origin);
  url.searchParams.set("q", q);
  url.searchParams.set("type", type);
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

async function fetchSubredditPage(
  cursor: string | null,
  subreddit: string,
  type: "all" | "scenes" | "images",
  sort: string,
): Promise<PageResult> {
  const url = new URL("/api/stash/search", location.origin);
  url.searchParams.set("subreddit", subreddit);
  url.searchParams.set("type", type);
  url.searchParams.set("sort", sort);
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

async function fetchSyncStatus(): Promise<SyncStatus> {
  const res = await fetch("/api/search/sync-status");
  if (!res.ok) throw new Error("Status check failed");
  return res.json();
}

// ── Recent searches ───────────────────────────────────────────────────────────

const RECENT_KEY = "substash:recent-searches";
const MAX_RECENT = 8;
const MIN_Q = 2;

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(q: string) {
  const list = getRecent().filter((s) => s !== q);
  list.unshift(q);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}
function clearRecent() {
  localStorage.removeItem(RECENT_KEY);
}
function removeRecentItem(q: string) {
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(getRecent().filter((s) => s !== q)),
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SearchSkeleton() {
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

function SyncingBanner(props: { totalIndexed: number }) {
  return (
    <div class="mx-4 mt-4 px-4 py-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center gap-3">
      <div class="w-4 h-4 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin shrink-0" />
      <div>
        <p class="text-xs font-semibold text-[var(--color-text)]">
          Building search index…
        </p>
        <p class="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          {props.totalIndexed > 0
            ? `${props.totalIndexed.toLocaleString()} items indexed so far`
            : "Scanning your library"}
        </p>
      </div>
    </div>
  );
}

function EntityCard(props: { entity: EntityResult }) {
  const { entity } = props;
  const href =
    entity.entityType === "tag"
      ? `/tags/${entity.stashId}`
      : entity.entityType === "performer"
        ? `/performers/${entity.stashId}`
        : `/studios/${entity.stashId}`;
  const thumb = entity.imagePath ? proxyImage(entity.imagePath) : null;

  return (
    <a
      href={href}
      class="flex items-center gap-3.5 px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-3)] transition-colors"
    >
      <span class="w-10 h-10 rounded-full bg-[var(--color-surface-3)] border border-[var(--color-border)] shrink-0 overflow-hidden flex items-center justify-center">
        <Show
          when={thumb}
          fallback={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              class="text-[var(--color-text-muted)]"
            >
              {entity.entityType === "performer" ? (
                <>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                  />
                  <circle cx="12" cy="7" r="4" />
                </>
              ) : entity.entityType === "studio" ? (
                <>
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path stroke-linecap="round" d="M8 21h8M12 17v4" />
                </>
              ) : (
                <>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
                  />
                  <line stroke-linecap="round" x1="7" y1="7" x2="7.01" y2="7" />
                </>
              )}
            </svg>
          }
        >
          <img
            src={thumb!}
            alt={entity.name}
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </Show>
      </span>
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-medium text-[var(--color-text)] truncate">
          {entity.name}
        </span>
        <span class="block text-xs text-[var(--color-text-muted)]">
          {entity.count} {entity.count === 1 ? "item" : "items"}
        </span>
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="text-[var(--color-text-muted)] shrink-0"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m9 18 6-6-6-6"
        />
      </svg>
    </a>
  );
}

function timeAgo(epochSeconds: number): string {
  const s = Math.floor(Date.now() / 1000 - epochSeconds);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function CommentCard(props: { hit: CommentHit }) {
  const { hit } = props;
  const title =
    hit.mediaItem?.title ||
    hit.mediaItem?.subredditDisplay ||
    (hit.mediaType === "scene" ? "Video" : "Photo");
  const href = `/${hit.mediaType === "scene" ? "scenes" : "images"}/${hit.stashId}`;
  const excerpt =
    hit.body.length > 140 ? hit.body.slice(0, 140) + "…" : hit.body;

  const rawThumb = hit.mediaItem
    ? hit.mediaType === "scene"
      ? (hit.mediaItem as SceneFeedItem).paths.screenshot
      : (hit.mediaItem as ImageFeedItem).paths.thumbnail
    : null;
  const thumb = rawThumb ? proxyImage(rawThumb) : null;

  return (
    <a
      href={href}
      class="flex items-start gap-3 px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-3)] transition-colors"
    >
      <Show
        when={thumb}
        fallback={
          <div class="w-12 h-12 rounded-lg bg-[var(--color-surface-3)] shrink-0 flex items-center justify-center mt-0.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-[var(--color-text-muted)]"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              />
            </svg>
          </div>
        }
      >
        <img
          src={thumb!}
          alt=""
          width="48"
          height="48"
          class="w-12 h-12 rounded-lg object-cover shrink-0 bg-[var(--color-surface-3)] mt-0.5"
          loading="lazy"
        />
      </Show>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-[var(--color-accent)] truncate mb-0.5">
          {title}
        </p>
        <p class="text-sm text-[var(--color-text)] leading-snug">{excerpt}</p>
        <p class="text-[11px] text-[var(--color-text-muted)] mt-1">
          {timeAgo(hit.createdAt)}
        </p>
      </div>
    </a>
  );
}

// ── QueryClient ───────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2 * 60 * 1000, gcTime: 5 * 60 * 1000, retry: 1 },
  },
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface BrowseLink {
  href: string;
  label: string;
  desc: string;
  svg: string;
}

interface Props {
  initialQ?: string;
  initialFilter?: string;
  browseLinks: BrowseLink[];
  pageNameTags?: string;
  pageNamePerformers?: string;
  pageNameStudios?: string;
  initialSubreddit?: string;
  initialSubredditDisplay?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

function SearchResultsInner(props: Props) {
  const initial = props.initialQ?.trim() ?? "";
  const VALID: FilterType[] = [
    "all",
    "scenes",
    "images",
    "tags",
    "performers",
    "studios",
    "comments",
  ];
  const initialFilter = (
    VALID.includes(props.initialFilter as FilterType)
      ? props.initialFilter
      : "all"
  ) as FilterType;

  const isSubredditMode = () => !!props.initialSubreddit;

  const [q, setQ] = createSignal(initial);
  const [filter, setFilter] = createSignal<FilterType>(initialFilter);
  const [subFilter, setSubFilter] = createSignal<"all" | "scenes" | "images">(
    "all",
  );
  const [subSort, setSubSort] = createSignal<"date" | "rating" | "random">(
    "date",
  );
  const [sortOpen, setSortOpen] = createSignal(false);
  const [recent, setRecent] = createSignal<string[]>([]);
  const [isSyncing, setIsSyncing] = createSignal(false);

  onMount(() => {
    setRecent(getRecent());
    if (initial.length >= MIN_Q) {
      pushRecent(initial);
      setRecent(getRecent());
    }
    // Close sort dropdown on outside click
    function onOutsideClick(e: MouseEvent) {
      const dd = document.getElementById("sub-sort-dd");
      if (dd && !dd.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("click", onOutsideClick);
    onCleanup(() => document.removeEventListener("click", onOutsideClick));
  });

  // Sync q+filter when Astro form navigates (popstate) or back/forward
  onMount(() => {
    function onPopState() {
      const p = new URLSearchParams(location.search);
      const newQ = p.get("q")?.trim() ?? "";
      const newF = p.get("filter") as FilterType | null;
      setQ(newQ);
      if (newF && VALID.includes(newF)) setFilter(newF);
    }
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));
  });

  // Persist filter in URL (text search mode only)
  createEffect(() => {
    if (isSubredditMode()) return;
    const f = filter();
    const url = new URL(location.href);
    if (f === "all") url.searchParams.delete("filter");
    else url.searchParams.set("filter", f);
    history.replaceState({}, "", url.toString());
  });

  // ── Infinite search query ──────────────────────────────────────────────────

  const searchQuery = createInfiniteQuery(() => ({
    queryKey: ["search", q(), filter()],
    queryFn: ({ pageParam }) =>
      fetchSearchPage(pageParam as string | null, q(), filter()),
    initialPageParam: null as string | null,
    getNextPageParam: (last: PageResult) => last.nextCursor ?? undefined,
    enabled: !isSubredditMode() && q().length >= MIN_Q,
  }));

  // ── Subreddit browse query ─────────────────────────────────────────────────

  const subredditQuery = createInfiniteQuery(() => ({
    queryKey: ["subreddit", props.initialSubreddit, subFilter(), subSort()],
    queryFn: ({ pageParam }) =>
      fetchSubredditPage(
        pageParam as string | null,
        props.initialSubreddit!,
        subFilter(),
        subSort(),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last: PageResult) => last.nextCursor ?? undefined,
    enabled: isSubredditMode(),
  }));

  // ── Sync status polling ────────────────────────────────────────────────────

  const syncStatus = createQuery(() => ({
    queryKey: ["sync-status"],
    queryFn: fetchSyncStatus,
    enabled: isSyncing(),
    refetchInterval: 2000,
    staleTime: 0,
  }));

  createEffect(() => {
    const syncing = isSubredditMode()
      ? (subredditQuery.data?.pages.some((p) => p.syncing) ?? false)
      : (searchQuery.data?.pages.some((p) => p.syncing) ?? false);
    setIsSyncing(syncing);
  });

  createEffect(() => {
    const s = syncStatus.data;
    if (s && isSyncing() && !s.inProgress && !s.isEmpty) {
      setIsSyncing(false);
      if (isSubredditMode()) {
        queryClient.invalidateQueries({ queryKey: ["subreddit"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["search"] });
      }
    }
  });

  // ── Scroll pagination ──────────────────────────────────────────────────────

  onMount(() => {
    let raf = false;
    function check() {
      if (raf) return;
      raf = true;
      requestAnimationFrame(() => {
        raf = false;
        const el = document.documentElement;
        if ((el.scrollTop + el.clientHeight) / el.scrollHeight < 0.7) return;
        if (isSubredditMode()) {
          if (subredditQuery.hasNextPage && !subredditQuery.isFetchingNextPage)
            subredditQuery.fetchNextPage();
        } else {
          if (searchQuery.hasNextPage && !searchQuery.isFetchingNextPage)
            searchQuery.fetchNextPage();
        }
      });
    }
    window.addEventListener("scroll", check, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", check));
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const allItems = () =>
    (searchQuery.data?.pages ?? []).flatMap((p) => p.items) as FeedItem[];
  const allEntities = () =>
    (searchQuery.data?.pages ?? []).flatMap((p) => p.entities ?? []);
  const allComments = () =>
    (searchQuery.data?.pages ?? []).flatMap((p) => p.commentHits ?? []);
  const totalCount = () => searchQuery.data?.pages[0]?.total ?? 0;

  const subItems = () =>
    (subredditQuery.data?.pages ?? []).flatMap((p) => p.items) as FeedItem[];
  const subTotal = () => subredditQuery.data?.pages[0]?.total ?? 0;

  const isEntityFilter = () =>
    filter() === "tags" || filter() === "performers" || filter() === "studios";

  const showEmpty = () => q().length < MIN_Q;
  const showLoading = () =>
    q().length >= MIN_Q &&
    searchQuery.isLoading &&
    allItems().length === 0 &&
    allEntities().length === 0 &&
    allComments().length === 0;
  const showNoResults = () => {
    if (
      q().length < MIN_Q ||
      searchQuery.isLoading ||
      searchQuery.isFetching ||
      isSyncing()
    )
      return false;
    if (filter() === "comments") return allComments().length === 0;
    if (isEntityFilter()) return allEntities().length === 0;
    return allItems().length === 0;
  };
  const hasResults = () => {
    if (filter() === "comments") return allComments().length > 0;
    if (isEntityFilter()) return allEntities().length > 0;
    return allItems().length > 0;
  };

  // ── Filter tabs ────────────────────────────────────────────────────────────

  const tabs = () => [
    { value: "all" as FilterType, label: "All" },
    { value: "scenes" as FilterType, label: "Videos" },
    { value: "images" as FilterType, label: "Photos" },
    { value: "tags" as FilterType, label: props.pageNameTags ?? "Tags" },
    {
      value: "performers" as FilterType,
      label: props.pageNamePerformers ?? "Creators",
    },
    {
      value: "studios" as FilterType,
      label: props.pageNameStudios ?? "Studios",
    },
    { value: "comments" as FilterType, label: "Comments" },
  ];

  const subTabs = () => [
    { value: "all" as const, label: "All" },
    { value: "scenes" as const, label: "Videos" },
    { value: "images" as const, label: "Photos" },
  ];

  const SORT_OPTIONS = [
    { key: "date" as const, label: "Recent" },
    { key: "rating" as const, label: "Top" },
    { key: "random" as const, label: "Random" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Filter tabs */}
      <Show
        when={isSubredditMode()}
        fallback={
          <Show when={q().length >= MIN_Q}>
            <div class="sticky top-[57px] lg:top-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur border-b border-[var(--color-border)]">
              <div class="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-hide">
                <For each={tabs()}>
                  {(tab) => (
                    <button
                      onClick={() => setFilter(tab.value)}
                      class={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        filter() === tab.value
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  )}
                </For>
                <Show when={totalCount() > 0 && !searchQuery.isLoading}>
                  <span class="ml-auto shrink-0 text-xs text-[var(--color-text-muted)] pr-1">
                    {totalCount().toLocaleString()}
                  </span>
                </Show>
              </div>
            </div>
          </Show>
        }
      >
        <div class="sticky top-[57px] lg:top-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur border-b border-[var(--color-border)]">
          {/* Filter indicator row */}
          <div class="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-[var(--color-accent)] shrink-0"
            >
              <polygon
                stroke-linecap="round"
                stroke-linejoin="round"
                points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
              />
            </svg>
            <span class="text-xs text-[var(--color-text-muted)]">
              Filtering by
            </span>
            <span class="text-xs font-bold text-[var(--color-accent)] truncate">
              {props.initialSubredditDisplay ?? props.initialSubreddit}
            </span>
            <a
              href="/search"
              class="ml-auto shrink-0 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Clear
            </a>
          </div>
          {/* Type tabs row */}
          <div class="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto scrollbar-hide">
            <For each={subTabs()}>
              {(tab) => (
                <button
                  onClick={() => setSubFilter(tab.value)}
                  class={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    subFilter() === tab.value
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {tab.label}
                </button>
              )}
            </For>
            <Show when={subTotal() > 0 && !subredditQuery.isLoading}>
              <span class="ml-auto shrink-0 text-xs text-[var(--color-text-muted)] pr-1">
                {subTotal().toLocaleString()}
              </span>
            </Show>
          </div>
        </div>
      </Show>

      {/* Syncing banner */}
      <Show when={isSyncing()}>
        <SyncingBanner totalIndexed={syncStatus.data?.totalIndexed ?? 0} />
      </Show>

      {/* ── Subreddit browse mode ── */}
      <Show when={isSubredditMode()}>
        {/* Sort bar */}
        <div class="px-4 py-2 border-b border-[var(--color-border)] flex items-center">
          <div id="sub-sort-dd" class="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSortOpen(!sortOpen());
              }}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface-3)] active:scale-95 transition-all cursor-pointer select-none"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="text-[var(--color-text-muted)] shrink-0"
              >
                <polygon
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                />
              </svg>
              <span class="text-[var(--color-text-muted)]">
                Sort:{" "}
                <span class="text-[var(--color-text)] font-semibold">
                  {SORT_OPTIONS.find((s) => s.key === subSort())?.label}
                </span>
              </span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="text-[var(--color-text-muted)] shrink-0"
                style={{
                  transform: sortOpen() ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              >
                <polyline
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  points="6 9 12 15 18 9"
                />
              </svg>
            </button>
            <Show when={sortOpen()}>
              <div class="absolute top-full left-0 mt-1.5 z-50 min-w-[150px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
                <For each={SORT_OPTIONS}>
                  {(opt) => (
                    <button
                      onClick={() => {
                        setSubSort(opt.key);
                        setSortOpen(false);
                      }}
                      class={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        subSort() === opt.key
                          ? "text-[var(--color-accent)] font-semibold bg-[var(--color-surface-2)]"
                          : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                      }`}
                    >
                      {opt.label}
                      <Show when={subSort() === opt.key}>
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          class="text-[var(--color-accent)] shrink-0"
                        >
                          <polyline
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            points="20 6 9 17 4 12"
                          />
                        </svg>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        <Show when={subredditQuery.isLoading && subItems().length === 0}>
          <SearchSkeleton />
          <SearchSkeleton />
          <SearchSkeleton />
        </Show>

        <Show
          when={
            !subredditQuery.isLoading &&
            !subredditQuery.isFetching &&
            subItems().length === 0 &&
            !isSyncing()
          }
        >
          <div class="px-4 py-14 flex flex-col items-center gap-2 text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-[var(--color-text-muted)] opacity-40"
            >
              <circle cx="11" cy="11" r="8" />
              <path stroke-linecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <p class="text-sm font-semibold text-[var(--color-text)] mt-1">
              Nothing from{" "}
              {props.initialSubredditDisplay ?? props.initialSubreddit}
            </p>
            <p class="text-xs text-[var(--color-text-muted)] max-w-[220px] leading-relaxed">
              Content may not be indexed yet. Try again after the search index
              syncs.
            </p>
          </div>
        </Show>

        <For each={subItems()}>
          {(item) => (
            <Switch>
              <Match when={item.type === "scene"}>
                <SceneCard scene={item as SceneFeedItem} />
              </Match>
              <Match when={item.type === "image"}>
                <ImageCard image={item as unknown as ImageFeedItem} />
              </Match>
            </Switch>
          )}
        </For>

        <Show when={subredditQuery.isFetchingNextPage}>
          <SearchSkeleton />
        </Show>

        <Show
          when={
            !subredditQuery.hasNextPage &&
            !subredditQuery.isLoading &&
            !subredditQuery.isFetchingNextPage &&
            subItems().length > 0
          }
        >
          <div class="flex flex-col items-center gap-1 py-10 text-[var(--color-text-muted)]">
            <svg
              width="16"
              height="16"
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
            <p class="text-xs font-medium">All posts shown</p>
          </div>
        </Show>
      </Show>

      {/* ── Text search mode ── */}
      <Show when={!isSubredditMode()}>
        {/* Empty state (no query) */}
        <Show when={showEmpty()}>
          <div class="px-4 py-4">
            <Show when={recent().length > 0}>
              <div class="mb-5">
                <div class="flex items-center justify-between mb-2">
                  <p class="text-[10px] font-bold tracking-widest text-[var(--color-text-muted)] uppercase">
                    Recent
                  </p>
                  <button
                    onClick={() => {
                      clearRecent();
                      setRecent([]);
                    }}
                    class="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div class="flex flex-col gap-0.5">
                  <For each={recent()}>
                    {(item) => (
                      <div class="flex items-center group">
                        <a
                          href={`/search?q=${encodeURIComponent(item)}`}
                          class="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--color-surface-3)] active:scale-[0.98] transition-all"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            class="text-[var(--color-text-muted)] shrink-0"
                          >
                            <polyline
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              points="12 8 12 12 14 14"
                            />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                          <span class="text-sm text-[var(--color-text)] truncate">
                            {item}
                          </span>
                        </a>
                        <button
                          onClick={() => {
                            removeRecentItem(item);
                            setRecent(getRecent());
                          }}
                          aria-label={`Remove "${item}"`}
                          class="opacity-0 group-hover:opacity-100 px-3 py-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                          >
                            <line
                              stroke-linecap="round"
                              x1="18"
                              y1="6"
                              x2="6"
                              y2="18"
                            />
                            <line
                              stroke-linecap="round"
                              x1="6"
                              y1="6"
                              x2="18"
                              y2="18"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <p class="text-[10px] font-bold tracking-widest text-[var(--color-text-muted)] uppercase mb-3">
              Browse
            </p>
            <div class="flex flex-col gap-1">
              <For each={props.browseLinks}>
                {({ href, label, desc, svg }) => (
                  <a
                    href={href}
                    class="flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]/30 hover:bg-[var(--color-surface-3)] active:scale-[0.98] transition-all"
                  >
                    <span class="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-surface-3)] text-[var(--color-accent)] shrink-0">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.75"
                        innerHTML={svg}
                      />
                    </span>
                    <span class="flex-1 min-w-0">
                      <span class="block text-sm font-medium text-[var(--color-text)]">
                        {label}
                      </span>
                      <span class="block text-xs text-[var(--color-text-muted)]">
                        {desc}
                      </span>
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      class="text-[var(--color-text-muted)] shrink-0"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m9 18 6-6-6-6"
                      />
                    </svg>
                  </a>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Loading skeletons */}
        <Show when={showLoading()}>
          <SearchSkeleton />
          <SearchSkeleton />
          <SearchSkeleton />
        </Show>

        {/* No results */}
        <Show when={showNoResults()}>
          <div class="px-4 py-14 flex flex-col items-center gap-2 text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-[var(--color-text-muted)] opacity-40"
            >
              <circle cx="11" cy="11" r="8" />
              <path stroke-linecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <p class="text-sm font-semibold text-[var(--color-text)] mt-1">
              Nothing found for "{q()}"
            </p>
            <p class="text-xs text-[var(--color-text-muted)] max-w-[220px] leading-relaxed">
              Try different keywords or browse by category.
            </p>
          </div>
        </Show>

        {/* Media results (all / scenes / images) */}
        <Show when={!isEntityFilter() && filter() !== "comments"}>
          <For each={allItems()}>
            {(item) => (
              <Switch>
                <Match when={item.type === "scene"}>
                  <SceneCard scene={item as SceneFeedItem} />
                </Match>
                <Match when={item.type === "image"}>
                  <ImageCard image={item as unknown as ImageFeedItem} />
                </Match>
              </Switch>
            )}
          </For>
        </Show>

        {/* Entity results (tags / performers / studios) */}
        <Show when={isEntityFilter()}>
          <For each={allEntities()}>
            {(entity) => <EntityCard entity={entity} />}
          </For>
        </Show>

        {/* Comment results */}
        <Show when={filter() === "comments"}>
          <For each={allComments()}>{(hit) => <CommentCard hit={hit} />}</For>
        </Show>

        {/* Loading next page */}
        <Show when={searchQuery.isFetchingNextPage}>
          <SearchSkeleton />
        </Show>

        {/* End of results */}
        <Show
          when={
            !searchQuery.hasNextPage &&
            !searchQuery.isLoading &&
            !searchQuery.isFetchingNextPage &&
            hasResults()
          }
        >
          <div class="flex flex-col items-center gap-1 py-10 text-[var(--color-text-muted)]">
            <svg
              width="16"
              height="16"
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
            <p class="text-xs font-medium">All results shown</p>
          </div>
        </Show>
      </Show>
    </div>
  );
}

export default function SearchResults(props: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <SearchResultsInner {...props} />
    </QueryClientProvider>
  );
}
