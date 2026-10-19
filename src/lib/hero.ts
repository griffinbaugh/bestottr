import type { Listing } from "./data";

/** Top live Experience listings for the hero rotation (files excluded), unique artwork, ranked by revenue. */
export function heroListings(listings: Listing[], max = 5): Listing[] {
  const seen = new Set<string>();
  return listings
    .filter((l) => l.kind === "experience" && l.status === "live" && !!l.image)
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .filter((l) => (seen.has(l.image) ? false : (seen.add(l.image), true)))
    .slice(0, max);
}
