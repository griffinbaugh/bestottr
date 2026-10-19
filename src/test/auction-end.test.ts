import { describe, expect, it } from "vitest";
import { computeEndsAt, formatAuctionEnd, isFutureEnd, toLocalInputValue, validateAuctionEnd } from "@/lib/auction-end";

// Local-time constructor so assertions hold in any timezone.
const NOW = new Date("2026-10-19T12:00:00").getTime();

describe("auction end scheduling", () => {
  it("duration mode adds whole days from now", () => {
    expect(computeEndsAt("duration", 7, "", NOW)).toBe(NOW + 7 * 86400000);
    expect(validateAuctionEnd("duration", 3, "", NOW).ok).toBe(true);
  });
  it("exact datetime in the future is accepted and resolves to an absolute timestamp", () => {
    const local = toLocalInputValue(NOW + 2 * 86400000);
    const r = validateAuctionEnd("datetime", 7, local, NOW);
    expect(r.ok).toBe(true);
    expect(r.endsAt).toBeGreaterThan(NOW);
  });
  it("past datetime is blocked with a clear error", () => {
    const r = validateAuctionEnd("datetime", 7, toLocalInputValue(NOW - 60000), NOW);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/future/i);
  });
  it("missing or invalid datetime is blocked", () => {
    expect(validateAuctionEnd("datetime", 7, "", NOW).ok).toBe(false);
    expect(validateAuctionEnd("datetime", 7, "not-a-date", NOW).ok).toBe(false);
    expect(computeEndsAt("datetime", 7, "", NOW)).toBeNull();
  });
  it("datetime-local value round-trips within a minute", () => {
    const ts = NOW + 3 * 86400000;
    expect(Math.abs(new Date(toLocalInputValue(ts)).getTime() - ts)).toBeLessThan(60000);
  });
  it("formats a human-readable end including timezone", () => {
    const s = formatAuctionEnd(NOW);
    expect(s).toContain("2026");
    expect(s.length).toBeGreaterThan(10);
  });
  it("isFutureEnd guards the boundary", () => {
    expect(isFutureEnd(NOW + 1000, NOW)).toBe(true);
    expect(isFutureEnd(NOW - 1000, NOW)).toBe(false);
    expect(isFutureEnd(null, NOW)).toBe(false);
  });
  it("stores the exact selected local date and time as an absolute timestamp", () => {
    const selected = "2026-10-21T16:45";
    expect(validateAuctionEnd("datetime", 7, selected, NOW)).toEqual({
      ok: true,
      endsAt: new Date(2026, 9, 21, 16, 45).getTime(),
    });
  });
  it("rejects an end that has elapsed while the seller is reviewing", () => {
    const selected = toLocalInputValue(NOW + 60000);
    expect(validateAuctionEnd("datetime", 7, selected, NOW).ok).toBe(true);
    expect(validateAuctionEnd("datetime", 7, selected, NOW + 60000).ok).toBe(false);
  });
});
