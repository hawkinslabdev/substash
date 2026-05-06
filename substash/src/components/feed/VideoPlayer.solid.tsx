import { createSignal, onMount, onCleanup } from "solid-js";
import { cn } from "@/lib/utils/cn";

interface Props {
  src: string;
  poster: string | null | undefined;
  class?: string;
  id?: string;
  onPlay?: () => void;
}

export default function VideoPlayer(props: Props) {
  let videoEl: HTMLVideoElement | undefined;
  const [muted, setMuted] = createSignal(true);
  const [playing, setPlaying] = createSignal(false);
  const [preload, setPreload] = createSignal<"none" | "metadata">("none");

  onMount(() => {
    if (!videoEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) setPreload("metadata");
        if (entry.intersectionRatio >= 0.5) {
          videoEl!.play().catch(() => {});
          setPlaying(true);
          props.onPlay?.();
        } else {
          videoEl!.pause();
          // Reset to muted so returning to this card never auto-resumes audio
          videoEl!.muted = true;
          setMuted(true);
          setPlaying(false);
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(videoEl);

    // Stop immediately when Astro begins navigating away — prevents audio
    // overlap during view transitions and rapid multi-tap navigation.
    function stopOnNavigate() {
      if (!videoEl) return;
      if (props.id && videoEl.currentTime > 0) {
        sessionStorage.setItem(
          `substash:video-time:${props.id}`,
          String(videoEl.currentTime),
        );
      }
      videoEl.pause();
      videoEl.muted = true;
      setMuted(true);
      setPlaying(false);
    }
    document.addEventListener("astro:before-preparation", stopOnNavigate);

    onCleanup(() => {
      observer.disconnect();
      document.removeEventListener("astro:before-preparation", stopOnNavigate);
    });
  });

  function toggleMute() {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    setMuted(videoEl.muted);
  }

  return (
    <div class={cn("relative", props.class)}>
      <video
        ref={videoEl}
        src={props.src}
        poster={props.poster ?? undefined}
        muted
        playsinline
        loop
        preload={preload()}
        class="w-full h-full object-contain"
      />
      <button
        onClick={toggleMute}
        aria-label={muted() ? "Unmute" : "Mute"}
        class="absolute bottom-3 right-3 p-2 rounded-full bg-[var(--color-surface)]/75 text-[var(--color-text)] opacity-70 focus:opacity-100 active:opacity-100 transition-opacity"
      >
        {muted() ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polygon
              stroke-linejoin="round"
              points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
            />
            <line stroke-linecap="round" x1="23" y1="9" x2="17" y2="15" />
            <line stroke-linecap="round" x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polygon
              stroke-linejoin="round"
              points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
            />
            <path stroke-linecap="round" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path stroke-linecap="round" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>
    </div>
  );
}
