import { coverImage } from "./gallery";
import type { Listing } from "./data";
import { DEFAULT_HERO_IMAGES } from "./images";

/** Keep the default artwork in the rotation even as live listings become available. */
export function heroBackgroundImages(listings: Listing[]): string[] {
  return [...new Set([...heroListings(listings).map(coverImage), ...DEFAULT_HERO_IMAGES])];
}

/** Top live Experience listings for the hero rotation (files excluded), unique artwork, ranked by revenue. */
export function heroListings(listings: Listing[], max = 5): Listing[] {
  const seen = new Set<string>();
  return listings
    .filter((l) => l.kind === "experience" && l.status === "live" && !!coverImage(l))
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .filter((l) => (seen.has(coverImage(l)) ? false : (seen.add(coverImage(l)), true)))
    .slice(0, max);
}
