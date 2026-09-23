import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { cn } from "@/lib/utils/cn";

interface Props {
  src: string;
  poster: string | null | undefined;
  class?: string;
  id?: string;
  onPlay?: () => void;
  /** Mute button corner, immersive mode uses top-right to clear the title overlay */
  mutePos?: "bottom-left" | "top-right";
  /** Buffer metadata immediately (immersive neighbors), instead of on intersect */
  warm?: boolean;
}

export default function VideoPlayer(props: Props) {
  let videoEl: HTMLVideoElement | undefined;
  let wrapEl: HTMLDivElement | undefined;
  const [muted, setMuted] = createSignal(true);
  const [playing, setPlaying] = createSignal(false);
  // iOS refuses autoplay in Low Power Mode or with Auto-Play Video Previews off,
  // and a never-played video paints nothing there: offer a play button instead
  const [blocked, setBlocked] = createSignal(false);
  // First real frame rendered, poster overlay can go
  const [started, setStarted] = createSignal(false);
  // A scene with no poster at all needs the stand-in too, not just one whose
  // poster resolves to the proxy's transparent pixel
  const [posterOk, setPosterOk] = createSignal(!!props.poster);
  const [preload, setPreload] = createSignal<"none" | "metadata">(
    props.warm ? "metadata" : "none",
  );
  // Scenes with no generated screenshot get a transparent pixel from the image
  // proxy, so the card's blurred backdrop is empty and portrait video sits in
  // black bars. Grab one frame off a hidden copy of the video to stand in for it.
  const [frameBg, setFrameBg] = createSignal<string | null>(null);
  // iOS paints letterbox bars black over the backdrop, so size the element to the video itself
  const [ratio, setRatio] = createSignal<number | null>(null);
  const [box, setBox] = createSignal<{ w: number; h: number } | null>(null);
  const fit = () => {
    const r = ratio();
    const b = box();
    if (!r || !b) return undefined;
    return {
      width: `${Math.min(b.w, b.h * r)}px`,
      height: `${Math.min(b.h, b.w / r)}px`,
    };
  };

  let grabbing = false;
  function grabFrameBackdrop() {
    if (grabbing || !props.src) return;
    grabbing = true;
    // Drawing the visible video into a canvas makes iOS stop painting it,
    // so read the frame from a detached copy instead
    const copy = document.createElement("video");
    copy.muted = true;
    copy.playsInline = true;
    copy.preload = "auto";
    copy.addEventListener(
      "loadeddata",
      () => {
        try {
          // Tiny canvas: it is blurred to mush anyway, and keeps the grab cheap
          const canvas = document.createElement("canvas");
          canvas.width = 48;
          canvas.height = Math.max(
            1,
            Math.round((48 * copy.videoHeight) / copy.videoWidth),
          );
          canvas
            .getContext("2d")
            ?.drawImage(copy, 0, 0, canvas.width, canvas.height);
          setFrameBg(canvas.toDataURL("image/jpeg", 0.6));
        } catch {
          // Cross-origin stream taints the canvas; leave the frame black
        }
        copy.removeAttribute("src");
        copy.load();
      },
      { once: true },
    );
    copy.src = props.src;
    copy.load();
  }

  onMount(() => {
    if (!videoEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) setPreload("metadata");
        if (entry.intersectionRatio >= 0.5) {
          videoEl!
            .play()
            .then(() => setBlocked(false))
            .catch((e: DOMException) => {
              if (e.name === "NotAllowedError") setBlocked(true);
            });
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

    const sizer = new ResizeObserver(([e]) =>
      setBox({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    sizer.observe(wrapEl!);
    // Metadata may have landed before hydration attached onLoadedMetadata
    if (videoEl.videoWidth && videoEl.videoHeight)
      setRatio(videoEl.videoWidth / videoEl.videoHeight);

    // Stop immediately when Astro begins navigating away prevents audio overlap during view transitions and rapid multi-tap navigation
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
      sizer.disconnect();
      document.removeEventListener("astro:before-preparation", stopOnNavigate);
    });
  });

  function toggleMute() {
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    setMuted(videoEl.muted);
  }

  return (
    <div
      ref={wrapEl}
      class={cn("relative flex items-center justify-center", props.class)}
    >
      <video
        ref={videoEl}
        src={props.src}
        poster={props.poster ?? undefined}
        muted
        playsinline
        loop
        preload={preload()}
        onLoadedMetadata={() => {
          const { videoWidth: w, videoHeight: h } = videoEl!;
          if (w && h) setRatio(w / h);
        }}
        onPlaying={() => {
          setStarted(true);
          if (!posterOk()) grabFrameBackdrop();
        }}
        onLoadedData={() => {
          if (!posterOk()) grabFrameBackdrop();
        }}
        class="relative z-[1] w-full h-full object-contain bg-transparent"
        style={fit()}
      />
      {/* Stand-in backdrop, only when the real poster never arrived */}
      <Show when={frameBg()}>
        {(bg) => (
          <img
            src={bg()}
            alt=""
            aria-hidden="true"
            class="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-60"
          />
        )}
      </Show>
      {/* Poster overlay: iOS Safari drops the native poster and shows a black
          player as soon as metadata loads, keep the thumbnail visible until
          the first real frame plays. */}
      <Show when={props.poster && !started() && posterOk()}>
        <img
          src={props.poster!}
          alt=""
          aria-hidden="true"
          class="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none"
          decoding="async"
        />
      </Show>
      {/* Off-screen probe: a 1x1 answer means "no screenshot", not "a black one" */}
      <img
        src={props.poster ?? undefined}
        alt=""
        aria-hidden="true"
        class="hidden"
        decoding="async"
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= 1) setPosterOk(false);
        }}
        onError={() => setPosterOk(false)}
      />
      <Show when={blocked()}>
        <button
          onClick={() => videoEl?.play().then(() => setBlocked(false))}
          aria-label="Play"
          class="glass absolute inset-0 m-auto z-20 w-16 h-16 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
          </svg>
        </button>
      </Show>
      <button
        onClick={toggleMute}
        aria-label={muted() ? "Unmute" : "Mute"}
        class="glass absolute z-20 p-2 rounded-full text-white opacity-80 focus:opacity-100 active:opacity-100 transition-opacity"
        classList={{
          "bottom-3 left-3": props.mutePos !== "top-right",
          "top-[calc(env(safe-area-inset-top,0px)+12px)] right-3":
            props.mutePos === "top-right",
        }}
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
