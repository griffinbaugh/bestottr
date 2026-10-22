import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import {
  REVIEW_BUCKET,
  reviewSummary,
  snapshotUrl,
  type ListingReview,
  type ReviewDetails,
  type ReviewAsset,
  type PublicListing,
  type ReviewState,
} from "./listing-review";
import { assetBucket } from "./listing-assets";
import type { ListingDraft } from "./listing-drafts";
export const publicationEnabled = () => process.env["LISTING_PUBLICATION_ENABLED"] === "true";
export async function requireModerator(userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Moderator access is required.");
}
export async function editableDraft(userId: string, draftId: string) {
  const { data, error } = await db
    .from("listing_reviews")
    .select("id")
    .eq("seller_id", userId)
    .eq("draft_id", draftId)
    .in("state", ["preparing", "in_review", "approved", "published"])
    .limit(1);
  if (error) throw new Error("Review status could not be checked. Refresh before editing.");
  if (data.length)
    throw new Error("Withdraw or unpublish the reviewed version before changing this draft.");
}
export async function freshReviewOwnership(d: ListingDraft) {
  if (d.kind === "file") return {};
  const { data: link, error } = await db
    .from("roblox_accounts")
    .select("roblox_user_id")
    .eq("user_id", d.seller_id)
    .maybeSingle();
  if (error || !link || link.roblox_user_id !== d.roblox_user_id)
    throw new Error(
      "The seller's connected Roblox identity changed. Withdraw and re-save this draft.",
    );
  const { verifyDraftOwnership } = await import("./listing-ownership.server");
  const proof = await verifyDraftOwnership(d.kind, snapshotUrl(d)!, link.roblox_user_id);
  if (proof.asset_id !== d.asset_id)
    throw new Error("Roblox returned a different asset. Withdraw and re-save the draft.");
  return proof;
}
export async function authorizedReview(userId: string, id: string) {
  const result = await db.from("listing_reviews").select("*").eq("id", id).maybeSingle();
  if (result.error || !result.data) throw new Error("This review could not be found.");
  if (result.data.seller_id !== userId) await requireModerator(userId);
  return result.data;
}
export async function snapshotReviewAssets(r: ListingReview) {
  for (const source of r.snapshot.assets) {
    const id = crypto.randomUUID(),
      path = r.id + "/" + id;
    const record: ReviewAsset = {
      id,
      review_id: r.id,
      source_asset_id: source.id,
      category: source.category,
      filename: source.filename,
      content_type: source.content_type,
      size_bytes: source.size_bytes,
      path,
      position: source.position,
      ready: false,
    };
    const saved = await db.from("listing_review_assets").insert(record);
    if (saved.error) throw new Error("The review changed or an attachment could not be reserved.");
    const copied = await db.storage
      .from(assetBucket(source.category))
      .copy(source.path, path, { destinationBucket: REVIEW_BUCKET });
    if (copied.error)
      throw new Error("An attachment could not be copied. No review was submitted.");
    const info = await db.storage.from(REVIEW_BUCKET).info(path);
    if (
      info.error ||
      !info.data ||
      info.data.size !== source.size_bytes ||
      info.data.contentType !== source.content_type
    )
      throw new Error("An attachment snapshot could not be verified.");
    const ready = await db
      .from("listing_review_assets")
      .update({ ready: true })
      .eq("id", id)
      .eq("review_id", r.id);
    if (ready.error) throw new Error("The review changed before preparation completed.");
  }
}
async function attachments(id: string) {
  const r = await db
    .from("listing_review_assets")
    .select("*")
    .eq("review_id", id)
    .eq("ready", true)
    .order("position")
    .order("id");
  if (r.error) throw new Error("Reviewed attachments could not be loaded.");
  return r.data ?? [];
}
async function sellerHandle(id: string) {
  const p = await db.from("profiles").select("handle").eq("id", id).maybeSingle();
  if (p.error) throw new Error("Seller details could not be loaded.");
  return p.data?.handle ?? "seller";
}
export async function reviewDetails(r: ListingReview): Promise<ReviewDetails> {
  const assets = await attachments(r.id),
    images = assets.filter((a) => a.category === "image"),
    cover = images.find((a) => a.source_asset_id === r.snapshot.cover_asset_id) ?? images[0];
  const events = await db
    .from("listing_review_events")
    .select("*")
    .eq("review_id", r.id)
    .order("created_at")
    .order("id");
  if (events.error) throw new Error("Review history could not be loaded.");
  return {
    review: reviewSummary(r),
    description: r.snapshot.description,
    seller_handle: await sellerHandle(r.seller_id),
    ownership_checked_at: r.ownership_checked_at,
    auction_ends_at: r.snapshot.auction_ends_at,
    reserve_cents: r.snapshot.reserve_cents,
    roblox_url: snapshotUrl(r.snapshot),
    images: await Promise.all(
      images.map(async (a) => {
        const link = await db.storage.from(REVIEW_BUCKET).createSignedUrl(a.path, 300);
        if (link.error) throw new Error("Review images could not be loaded.");
        return { id: a.id, url: link.data.signedUrl, cover: a.id === cover?.id };
      }),
    ),
    files: assets
      .filter((a) => a.category === "file")
      .map((a) => ({ id: a.id, filename: a.filename, size_bytes: a.size_bytes })),
    events: events.data ?? [],
  };
}
/** Allowlist only. Never spread the snapshot or return deliverable paths to the public. */
export async function publicListing(r: ListingReview): Promise<PublicListing> {
  const assets = await attachments(r.id),
    images = assets.filter((a) => a.category === "image"),
    cover = images.find((a) => a.source_asset_id === r.snapshot.cover_asset_id) ?? images[0];
  return {
    id: r.id,
    title: r.snapshot.title,
    description: r.snapshot.description,
    kind: r.snapshot.kind,
    price_cents: r.snapshot.price_cents,
    seller_handle: await sellerHandle(r.seller_id),
    published_at: r.published_at!,
    ownership_checked_at: r.ownership_checked_at,
    roblox_url: snapshotUrl(r.snapshot),
    images: images.map((a) => ({
      id: a.id,
      url: `/api/listing-media/${a.id}`,
      cover: a.id === cover?.id,
    })),
    file_count: assets.filter((a) => a.category === "file").length,
  };
}
export async function publicReview(id: string) {
  if (!publicationEnabled()) return null;
  const r = await db
    .from("listing_reviews")
    .select("*")
    .eq("id", id)
    .eq("state", "published")
    .maybeSingle();
  if (r.error) throw new Error("The listing could not be loaded.");
  return r.data;
}
export async function publicImage(id: string) {
  if (!publicationEnabled()) return new Response(null, { status: 404 });
  const a = await db
    .from("listing_review_assets")
    .select("*")
    .eq("id", id)
    .eq("category", "image")
    .eq("ready", true)
    .maybeSingle();
  if (a.error) return new Response(null, { status: 503 });
  if (!a.data) return new Response(null, { status: 404 });
  const parent = await publicReview(a.data.review_id);
  if (!parent) return new Response(null, { status: 404 });
  const file = await db.storage.from(REVIEW_BUCKET).download(a.data.path);
  if (file.error) return new Response(null, { status: 503 });
  return new Response(file.data, {
    headers: {
      "Content-Type": a.data.content_type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export const ACTIVE_REVIEW_STATES: ReviewState[] = [
  "preparing",
  "in_review",
  "approved",
  "published",
];
