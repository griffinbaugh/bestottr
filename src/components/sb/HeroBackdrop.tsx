import { useEffect, useState } from "react";
import { img } from "@/lib/images";

const DWELL = 6500;

/** Ambient, decorative crossfading backdrop. Renders nothing when no images. */
export function HeroBackdrop({ images }: { images: string[] }) {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (reduced || images.length < 2) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const start = () => { t = setInterval(() => setI((n) => (n + 1) % images.length), DWELL); };
    const stop = () => { if (t) clearInterval(t); t = undefined; };
    const vis = () => (document.hidden ? stop() : (stop(), start()));
    start();
    document.addEventListener("visibilitychange", vis);
    return () => { stop(); document.removeEventListener("visibilitychange", vis); };
  }, [reduced, images.length]);

  // Preload next image
  useEffect(() => {
    if (images.length < 2) return;
    const n = new Image();
    n.src = img(images[(i + 1) % images.length]!);
  }, [i, images]);

  if (!images.length) return null;
  const active = reduced ? 0 : i;
  const next = (active + 1) % images.length;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {images.map((key, idx) => {
        if (idx !== active && idx !== next) return null;
        const on = idx === active;
        return (
          <img
            key={key}
            src={img(key)}
            alt=""
            decoding="async"
            className={`hero-bg absolute inset-0 h-full w-full object-cover ${on ? "opacity-100" : "opacity-0"} ${on && !reduced ? "hero-kb" : ""}`}
          />
        );
      })}
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
