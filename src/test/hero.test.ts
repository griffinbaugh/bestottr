import { describe, expect, it } from "vitest";
import { heroListings } from "@/lib/hero";
import { seedListings } from "@/lib/data";

describe("hero rotation", () => {
  it("uses only live experience listings, max 5", () => {
    const out = heroListings(seedListings());
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out.every((l) => l.kind === "experience" && l.status === "live")).toBe(true);
  });
  it("returns empty when no experiences", () => {
    expect(heroListings(seedListings().filter((l) => l.kind === "file"))).toEqual([]);
  });
});
