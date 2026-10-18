const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const numFmt = new Intl.NumberFormat("en-US");

export const usd = (n: number) => usdFmt.format(n);
export const compact = (n: number) => compactFmt.format(n);
export const usdCompact = (n: number) => "$" + compactFmt.format(n);
export const num = (n: number) => numFmt.format(n);

export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
