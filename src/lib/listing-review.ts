import { z } from "zod";
import type { ListingDraft } from "./listing-drafts";
import type { ListingAsset } from "./listing-assets";
export const REVIEW_BUCKET = "bestottr-review-assets";
export const REVIEW_STATES = [
  "preparing",
  "in_review",
  "approved",
  "rejected",
  "published",
  "withdrawn",
  "unpublished",
  "failed",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];
export const reviewLabel: Record<ReviewState, string> = {
  preparing: "Preparing review",
  in_review: "Awaiting review",
  approved: "Approved — not public",
  rejected: "Changes requested",
  published: "Published",
  withdrawn: "Withdrawn",
  unpublished: "Unpublished",
  failed: "Preparation failed",
};
export const reviewLocked = (s?: ReviewState) =>
  !!s && ["preparing", "in_review", "approved", "published"].includes(s);
export const reviewAction = z.enum(["approve", "reject", "withdraw", "publish", "unpublish"]);
export type ReviewAction = z.infer<typeof reviewAction>;
export type ReviewSnapshot = ListingDraft & { assets: ListingAsset[] };
export type ListingReview = {
  id: string;
  draft_id: string | null;
  seller_id: string;
  state: ReviewState;
  version: number;
  snapshot: ReviewSnapshot;
  rights_confirmed_at: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  decision_note: string;
  ownership_checked_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ReviewAsset = {
  id: string;
  review_id: string;
  source_asset_id: string;
  category: "image" | "file";
  filename: string;
  content_type: string;
  size_bytes: number;
  path: string;
  position: number;
  ready: boolean;
};
export type ReviewEvent = {
  id: number;
  review_id: string;
  actor_id: string;
  action: string;
  note: string;
  created_at: string;
};
export type ReviewSummary = Pick<
  ListingReview,
  | "id"
  | "draft_id"
  | "state"
  | "version"
  | "decision_note"
  | "created_at"
  | "reviewed_at"
  | "published_at"
> & {
  title: string;
  kind: ListingDraft["kind"];
  format: ListingDraft["format"];
  price_cents: number;
};
export type ReviewDetails = {
  review: ReviewSummary;
  description: string;
  seller_handle: string;
  ownership_checked_at: string | null;
  auction_ends_at: number | null;
  reserve_cents: number | null;
  roblox_url: string | null;
  images: { id: string; url: string; cover: boolean }[];
  files: { id: string; filename: string; size_bytes: number }[];
  events: ReviewEvent[];
};
export type PublicListing = {
  id: string;
  title: string;
  description: string;
  kind: ListingDraft["kind"];
  price_cents: number;
  seller_handle: string;
  published_at: string;
  ownership_checked_at: string | null;
  images: { id: string; url: string; cover: boolean }[];
  file_count: number;
  roblox_url: string | null;
};
export function snapshotUrl(d: Pick<ListingDraft, "kind" | "asset_id" | "place_id">) {
  return d.kind === "file"
    ? null
    : d.kind === "experience"
      ? `https://www.roblox.com/games/${d.place_id}`
      : `https://www.roblox.com/communities/${d.asset_id}`;
}
export function reviewSummary(r: ListingReview): ReviewSummary {
  return {
    id: r.id,
    draft_id: r.draft_id,
    state: r.state,
    version: r.version,
    decision_note: r.decision_note,
    created_at: r.created_at,
    reviewed_at: r.reviewed_at,
    published_at: r.published_at,
    title: r.snapshot.title,
    kind: r.snapshot.kind,
    format: r.snapshot.format,
    price_cents: r.snapshot.price_cents,
  };
}
export function reviewReadiness(d: ListingDraft, assets: ListingAsset[], now = Date.now()) {
  const problems: string[] = [];
  if (d.title.trim().length < 3 || !d.description.trim())
    problems.push("Add a title and description.");
  if (!Number.isSafeInteger(d.price_cents) || d.price_cents <= 0)
    problems.push("Set a price greater than zero.");
  const images = assets.filter((a) => a.category === "image" && a.status === "ready");
  if (!images.length) problems.push("Upload at least one listing image.");
  if (d.cover_asset_id && !images.some((a) => a.id === d.cover_asset_id))
    problems.push("Choose a completed listing image as the cover.");
  if (assets.some((a) => a.status !== "ready"))
    problems.push("Finish or remove incomplete uploads.");
  if (d.kind === "file" && !assets.some((a) => a.category === "file" && a.status === "ready"))
    problems.push("Attach a deliverable file.");
  if (d.format === "auction" && (!d.auction_ends_at || d.auction_ends_at <= now))
    problems.push("Choose a future auction closing time.");
  if (d.format === "auction" && d.reserve_cents !== null && d.reserve_cents < d.price_cents)
    problems.push("Reserve must be at least the starting bid.");
  return problems;
}
