// Auction end scheduling. `endsAt` (ms epoch) stays the canonical stored
// timestamp; the wizard tracks a mode plus either a day count or a local
// datetime-local string, and resolves to an absolute timestamp at publish.

export type EndMode = "duration" | "datetime";

const DAY_MS = 86_400_000;

/** Resolve the canonical auction end timestamp. Returns null when the exact datetime is missing/invalid. */
export function computeEndsAt(mode: EndMode, durationDays: number, endAtLocal: string, now = Date.now()): number | null {
  if (mode === "duration") return now + durationDays * DAY_MS;
  const ts = new Date(endAtLocal).getTime(); // datetime-local is interpreted in the seller's local timezone
  return Number.isFinite(ts) ? ts : null;
}

export function isFutureEnd(ts: number | null, now = Date.now()): ts is number {
  return ts !== null && ts > now;
}

export function validateAuctionEnd(
  mode: EndMode,
  durationDays: number,
  endAtLocal: string,
  now = Date.now(),
): { ok: boolean; endsAt: number | null; error?: string } {
  const endsAt = computeEndsAt(mode, durationDays, endAtLocal, now);
  if (mode === "duration") return { ok: true, endsAt };
  if (endsAt === null) return { ok: false, endsAt: null, error: "Choose a date and time for the auction to end." };
  if (!isFutureEnd(endsAt, now)) return { ok: false, endsAt, error: "Auction end must be in the future." };
  return { ok: true, endsAt };
}

/** Human-readable end with timezone, e.g. "Oct 26, 2026, 3:00 PM PDT". */
export function formatAuctionEnd(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ts));
}

/** Seller's local timezone abbreviation, e.g. "PDT". */
export function localTimezone(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** Format a timestamp as a datetime-local input value in local time (minute precision). */
export function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Sensible default for the exact-date mode: one week out, local time. */
export function defaultEndLocal(now = Date.now()): string {
  return toLocalInputValue(now + 7 * DAY_MS);
}
