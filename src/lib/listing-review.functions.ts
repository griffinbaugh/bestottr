import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  reviewAction,
  REVIEW_BUCKET,
  reviewSummary,
  reviewReadiness,
  type ListingReview,
  REVIEW_STATES,
} from "./listing-review";
import type { Json } from "@/integrations/supabase/types";
const token = z.string().min(20).max(10000),
  id = z.string().uuid();
export const getSellerReviews = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const activeStates = ["preparing", "in_review", "approved", "published"] as const;
    const [active, archived] = await Promise.all([
      db
        .from("listing_reviews")
        .select("*")
        .eq("seller_id", user.id)
        .in("state", activeStates)
        .order("created_at", { ascending: false }),
      db
        .from("listing_reviews")
        .select("*")
        .eq("seller_id", user.id)
        .not("state", "in", "(" + activeStates.join(",") + ")")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (active.error || archived.error)
      throw new Error("Your listing reviews could not be loaded.");
    return [...(active.data ?? []), ...(archived.data ?? [])].map(reviewSummary);
  });
export const getAdminReviews = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token,
      state: z.enum(REVIEW_STATES).default("in_review"),
      page: z.number().int().min(0).max(1000).default(0),
    }),
  )
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { requireModerator, publicationEnabled } = await import("./listing-review.server");
    await requireModerator(user.id);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const rows = await db
      .from("listing_reviews")
      .select("*")
      .eq("state", data.state)
      .order("created_at")
      .range(data.page * 25, data.page * 25 + 24);
    if (rows.error) throw new Error("The review queue could not be loaded.");
    return {
      publicationEnabled: publicationEnabled(),
      reviews: (rows.data ?? []).map(reviewSummary),
      hasMore: rows.data?.length === 25,
    };
  });
export const getReviewDetails = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, id }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { authorizedReview, reviewDetails } = await import("./listing-review.server");
    return reviewDetails(await authorizedReview(user.id, data.id));
  });
export const submitListingReview = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token,
      reviewId: id,
      draftId: id,
      expectedUpdatedAt: z.string().datetime({ offset: true }),
      confirmRights: z.literal(true),
    }),
  )
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const existing = await db
      .from("listing_reviews")
      .select("*")
      .eq("id", data.reviewId)
      .eq("seller_id", user.id)
      .maybeSingle();
    if (existing.error) throw new Error("Existing submission could not be checked.");
    if (existing.data) {
      if (existing.data.draft_id !== data.draftId)
        throw new Error("Submission does not match this draft.");
      return reviewSummary(existing.data);
    }
    const d = await db
      .from("listing_drafts")
      .select("*")
      .eq("id", data.draftId)
      .eq("seller_id", user.id)
      .maybeSingle();
    if (d.error || !d.data) throw new Error("This draft could not be found.");
    if (d.data.updated_at !== data.expectedUpdatedAt)
      throw new Error("The saved draft changed. Refresh before submitting.");
    const assets = await db
      .from("listing_assets")
      .select("*")
      .eq("draft_id", data.draftId)
      .eq("seller_id", user.id);
    if (assets.error) throw new Error("Draft uploads could not be checked.");
    const problems = reviewReadiness(d.data, assets.data ?? []);
    if (problems.length) throw new Error(problems.join(" "));
    const { freshReviewOwnership, snapshotReviewAssets } = await import("./listing-review.server");
    const proof = await freshReviewOwnership(d.data);
    const reserved = await db.rpc("reserve_listing_review", {
      p_review: data.reviewId,
      p_draft: data.draftId,
      p_actor: user.id,
      p_updated: data.expectedUpdatedAt,
      p_proof: proof as Json,
      p_rights: true,
    });
    if (reserved.error || !reserved.data)
      throw new Error(
        "The draft changed, is already under review, or its snapshot storage limit was reached. Refresh and try again.",
      );
    const result = reserved.data as unknown as { created: boolean; review: ListingReview };
    if (!result.created) return reviewSummary(result.review);
    try {
      await snapshotReviewAssets(result.review);
      const sent = await db.rpc("transition_listing_review", {
        p_review: result.review.id,
        p_actor: user.id,
        p_version: result.review.version,
        p_action: "submit",
      });
      if (sent.error || !sent.data) throw new Error("Review changed during preparation.");
      return reviewSummary(sent.data);
    } catch {
      await db.rpc("transition_listing_review", {
        p_review: result.review.id,
        p_actor: user.id,
        p_version: result.review.version,
        p_action: "fail",
        p_note: "Attachment preparation did not complete. The listing was not submitted.",
      });
      throw new Error("Submission did not complete. Refresh the review status before retrying.");
    }
  });
export const actOnListingReview = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token,
      id,
      version: z.number().int().nonnegative(),
      action: reviewAction,
      note: z.string().trim().max(2000).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { authorizedReview, requireModerator, publicationEnabled, freshReviewOwnership } =
      await import("./listing-review.server");
    const review = await authorizedReview(user.id, data.id);
    if (review.version !== data.version)
      throw new Error("This review changed. Refresh before continuing.");
    if (["approve", "reject", "publish"].includes(data.action)) await requireModerator(user.id);
    if (data.action === "withdraw" && review.seller_id !== user.id)
      throw new Error("Only the seller can withdraw a submission.");
    if (["reject", "unpublish"].includes(data.action) && data.note.length < 10)
      throw new Error("Give a reason of at least 10 characters.");
    let proof: unknown = {};
    if (data.action === "publish") {
      if (!publicationEnabled())
        throw new Error("Public publication is disabled while marketplace setup is completed.");
      if (review.state !== "approved") throw new Error("Approve this version before publishing.");
      const problems = reviewReadiness(review.snapshot, review.snapshot.assets);
      if (problems.length) throw new Error(problems.join(" "));
      if (review.snapshot.format === "auction")
        throw new Error("Auction publication stays closed until real bidding is available.");
      proof = await freshReviewOwnership(review.snapshot);
    }
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const changed = await db.rpc("transition_listing_review", {
      p_review: review.id,
      p_actor: user.id,
      p_version: data.version,
      p_action: data.action,
      p_note: data.note,
      p_publish_allowed: publicationEnabled(),
      p_proof: proof as Json,
    });
    if (changed.error || !changed.data)
      throw new Error(
        "The review changed or this action is no longer available. Refresh and try again.",
      );
    return reviewSummary(changed.data);
  });
export const downloadReviewFile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, reviewId: id, fileId: id }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { authorizedReview } = await import("./listing-review.server");
    await authorizedReview(user.id, data.reviewId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const f = await db
      .from("listing_review_assets")
      .select("*")
      .eq("id", data.fileId)
      .eq("review_id", data.reviewId)
      .eq("category", "file")
      .eq("ready", true)
      .maybeSingle();
    if (f.error || !f.data) throw new Error("Review file unavailable.");
    const signed = await db.storage
      .from(REVIEW_BUCKET)
      .createSignedUrl(f.data.path, 60, { download: f.data.filename });
    if (signed.error) throw new Error("Review download could not be prepared.");
    return { url: signed.data.signedUrl };
  });
export const getPublishedListings = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      q: z.string().trim().max(120).default(""),
      kind: z.enum(["all", "experience", "community", "file"]).default("all"),
      page: z.number().int().min(0).max(1000).default(0),
    }),
  )
  .handler(async ({ data }) => {
    const { publicationEnabled, publicListing } = await import("./listing-review.server");
    if (!publicationEnabled()) return { enabled: false, listings: [], hasMore: false };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    let query = db.from("listing_reviews").select("*").eq("state", "published");
    if (data.kind !== "all") query = query.eq("snapshot->>kind", data.kind);
    if (data.q)
      query = query.ilike("snapshot->>title", "%" + data.q.replace(/[\\%_]/g, "\\$&") + "%");
    const rows = await query
      .order("published_at", { ascending: false })
      .order("id")
      .range(data.page * 24, data.page * 24 + 23);
    if (rows.error) throw new Error("Listings could not be loaded.");
    return {
      enabled: true,
      listings: await Promise.all((rows.data ?? []).map(publicListing)),
      hasMore: rows.data?.length === 24,
    };
  });
export const getPublishedListing = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id }))
  .handler(async ({ data }) => {
    const { publicReview, publicListing } = await import("./listing-review.server");
    const review = await publicReview(data.id);
    return review ? publicListing(review) : null;
  });
