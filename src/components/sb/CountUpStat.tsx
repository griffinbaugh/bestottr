import { useEffect, useRef, useState } from "react";

export function CountUpStat({
  target,
  prefix = "",
  suffix = "",
  decimals = 0,
  label,
  delay = 0,
  duration = 1100,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  delay?: number;
  duration?: number;
}) {
  const [v, setV] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(Math.max((now - t0) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration]);

  return (
    <div>
      <dd className="num text-lg font-semibold">{`${prefix}${v.toFixed(decimals)}${suffix}`}</dd>
      <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
