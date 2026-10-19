const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCentsFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const numFmt = new Intl.NumberFormat("en-US");

export const usd = (n: number) => usdFmt.format(n);
/** Whole dollars render as "$12,000"; values with cents render as "$12,000.50". */
export const usdPrecise = (n: number) => (Number.isInteger(n) ? usdFmt.format(n) : usdCentsFmt.format(n));
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
