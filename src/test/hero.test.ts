import { describe, expect, it } from "vitest";
import { heroBackgroundImages, heroListings } from "@/lib/hero";
import { DEFAULT_HERO_IMAGES, img } from "@/lib/images";
import { coverImage } from "@/lib/gallery";
import { seedState } from "@/lib/data";
const seedListings = () => seedState().listings;

describe("hero rotation", () => {
  it("rotates the three selected defaults when there are no listings", () => {
    expect(heroBackgroundImages([])).toEqual(DEFAULT_HERO_IMAGES);
    expect(new Set(DEFAULT_HERO_IMAGES.map(img)).size).toBe(3);
  });
  it("keeps all defaults alongside eligible listing covers without duplicates", () => {
    const listings = seedListings();
    const out = heroBackgroundImages(listings);
    expect(out).toEqual([...new Set([...heroListings(listings).map(coverImage), ...DEFAULT_HERO_IMAGES])]);
    expect(DEFAULT_HERO_IMAGES.every((image) => out.includes(image))).toBe(true);
    expect(out.length).toBeGreaterThan(DEFAULT_HERO_IMAGES.length);
  });
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
