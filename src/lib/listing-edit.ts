import type { Listing } from "./data";
import { MAX_GALLERY_IMAGES, uniqueGallery } from "./gallery";

export type ExperienceChanges = Pick<Listing, "title" | "tagline" | "description" | "tags" | "gallery" | "monthlyRevenue" | "monthlyProfit" | "format" | "startingBid" | "reserve" | "buyNow" | "endsAt" | "assets" | "risks" | "genre" | "monthlyVisits" | "ccu" | "favorites" | "ageMonths" | "monetization"> & { financialsProvided?: boolean | undefined };
export function editExperience(listing: Listing, seller: string, changes: ExperienceChanges): Listing {
  if (listing.kind !== "experience" || listing.seller.handle !== seller) throw new Error("You can only edit your own Experience listings.");
  if (!changes.title.trim() || changes.title.trim().length < 3) throw new Error("Enter a listing title of at least 3 characters.");
  if (!changes.gallery?.length || changes.gallery.length > MAX_GALLERY_IMAGES) throw new Error("Choose between 1 and 5 images.");
  if ((changes.tags?.length ?? 0) > 8) throw new Error("Choose at most 8 tags.");
  if (changes.format === "auction" && changes.endsAt !== listing.endsAt && changes.endsAt <= Date.now()) throw new Error("Choose a future auction end.");
  if (changes.reserve !== undefined && changes.reserve < changes.startingBid) throw new Error("Reserve can't be below the starting bid.");
  const fields: (keyof ExperienceChanges)[] = ["title", "tagline", "description", "tags", "gallery", "monthlyRevenue", "monthlyProfit", "format", "startingBid", "reserve", "buyNow", "endsAt", "assets", "risks", "genre", "monthlyVisits", "ccu", "favorites", "ageMonths", "monetization", "financialsProvided"];
  const safe = Object.fromEntries(fields.map((key) => [key, changes[key]])) as ExperienceChanges;
  const gallery = uniqueGallery(changes.gallery);
  return { ...listing, ...safe, gallery, image: gallery[0]?.url ?? listing.image, currentBid: listing.bids.length ? listing.currentBid : changes.format === "buy_now" ? (changes.buyNow ?? changes.startingBid) : changes.startingBid };
}

export type CommunityChanges = Pick<Listing, "title" | "tagline" | "description" | "tags" | "format" | "startingBid" | "reserve" | "buyNow" | "endsAt" | "monthlyRevenue" | "monthlyProfit" | "financialsProvided" | "assets" | "risks">;
/** Seller-controlled Community fields only; the verified Community identity (ID, owner, name snapshot) stays locked. */
export function editCommunity(listing: Listing, seller: string, changes: CommunityChanges): Listing {
  if (listing.kind !== "community" || listing.seller.handle !== seller) throw new Error("You can only edit your own Community listings.");
  if (!changes.title.trim() || changes.title.trim().length < 3) throw new Error("Enter a listing title of at least 3 characters.");
  if ((changes.tags?.length ?? 0) > 8) throw new Error("Choose at most 8 tags.");
  if (changes.format === "auction" && changes.endsAt !== listing.endsAt && changes.endsAt <= Date.now()) throw new Error("Choose a future auction end.");
  if (changes.reserve !== undefined && changes.reserve < changes.startingBid) throw new Error("Reserve can't be below the starting bid.");
  const fields: (keyof CommunityChanges)[] = ["title", "tagline", "description", "tags", "format", "startingBid", "reserve", "buyNow", "endsAt", "monthlyRevenue", "monthlyProfit", "financialsProvided", "assets", "risks"];
  const safe = Object.fromEntries(fields.map((key) => [key, changes[key]])) as CommunityChanges;
  return { ...listing, ...safe, community: listing.community, currentBid: listing.bids.length ? listing.currentBid : changes.format === "buy_now" ? (changes.buyNow ?? changes.startingBid) : changes.startingBid };
}
