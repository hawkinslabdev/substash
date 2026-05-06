import { createSignal, For } from "solid-js";
import { cn } from "@/lib/utils/cn";

interface Props {
  images: Array<{ src: string; alt: string }>;
  class?: string;
}

export default function ImageCarousel(props: Props) {
  const [index, setIndex] = createSignal(0);
  let trackEl: HTMLDivElement | undefined;

  function scrollTo(i: number) {
    if (!trackEl) return;
    const child = trackEl.children[i] as HTMLElement;
    child?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    setIndex(i);
  }

  function onScroll() {
    if (!trackEl) return;
    requestAnimationFrame(() => {
      if (!trackEl) return;
      const width = trackEl.offsetWidth;
      setIndex(Math.round(trackEl.scrollLeft / width));
    });
  }

  return (
    <div class={cn("relative", props.class)}>
      <div
        ref={trackEl}
        onScroll={onScroll}
        class="flex overflow-x-scroll snap-x snap-mandatory scrollbar-none"
        style={{ "scroll-snap-type": "x mandatory" }}
      >
        <For each={props.images}>
          {(img) => (
            <div class="flex-none w-full snap-center snap-always">
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                decoding="async"
                class="w-full h-full object-cover"
              />
            </div>
          )}
        </For>
      </div>

      {/* Dot indicators */}
      {props.images.length > 1 && (
        <div class="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
          <For each={props.images}>
            {(_, i) => (
              <button
                onClick={() => scrollTo(i())}
                aria-label={`Image ${i() + 1}`}
                class="flex items-center justify-center"
              >
                <span
                  class={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    i() === index()
                      ? "bg-[var(--color-text)] scale-125"
                      : "bg-[var(--color-text)]/40",
                  )}
                />
              </button>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
