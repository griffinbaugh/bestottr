import { useEffect, useState } from "react";

export function useNow(interval = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

export function Countdown({ endsAt, className }: { endsAt: number; className?: string }) {
  const now = useNow();
  if (now === null) return <span className={className}>--:--:--</span>;
  const diff = endsAt - now;
  if (diff <= 0) return <span className={className}>Ended</span>;
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className={`num ${className ?? ""}`}>{d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`}</span>;
}
