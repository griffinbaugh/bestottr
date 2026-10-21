import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { uploadFields, assetBucket } from "./listing-assets";
const token = z.string().min(20).max(10000);
const assetRequest = z.object({ token, id: z.string().uuid() });
export const getDraftAssets = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, draftId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { listAssets } = await import("./listing-assets.server");
    return listAssets(user.id, data.draftId);
  });
export const prepareDraftUpload = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, upload: uploadFields }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const v = data.upload;
    const { data: item, error } = await db.rpc("reserve_listing_asset", {
      p_seller: user.id,
      p_draft: v.draftId,
      p_category: v.category,
      p_filename: v.filename,
      p_content_type: v.contentType,
      p_size: v.size,
    });
    if (error || !item)
      throw new Error(
        "Upload limit reached or draft unavailable. Each draft allows 8 images and 3 deliverables; account storage is limited to 150 MB. Remove unused or incomplete uploads and try again.",
      );
    const signed = await db.storage
      .from(assetBucket(item.category))
      .createSignedUploadUrl(item.path, { upsert: false });
    if (signed.error) {
      await db.from("listing_assets").delete().eq("id", item.id).eq("seller_id", user.id);
      throw new Error("Upload could not be started. Try again.");
    }
    return {
      id: item.id,
      path: item.path,
      token: signed.data.token,
      bucket: assetBucket(item.category),
    };
  });
export const finishDraftUpload = createServerFn({ method: "POST" })
  .inputValidator(assetRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { ownedAsset, completeAsset } = await import("./listing-assets.server");
    await completeAsset(await ownedAsset(user.id, data.id));
    return { ok: true };
  });
export const deleteDraftUpload = createServerFn({ method: "POST" })
  .inputValidator(assetRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { ownedAsset, removeAsset } = await import("./listing-assets.server");
    await removeAsset(await ownedAsset(user.id, data.id));
    return { ok: true };
  });
export const setDraftCover = createServerFn({ method: "POST" })
  .inputValidator(assetRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { ownedAsset } = await import("./listing-assets.server");
    const item = await ownedAsset(user.id, data.id);
    if (item.category !== "image" || item.status !== "ready")
      throw new Error("Choose a completed image for the cover.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db
      .from("listing_drafts")
      .update({ cover_asset_id: item.id })
      .eq("id", item.draft_id)
      .eq("seller_id", user.id);
    if (error) throw new Error("Cover could not be saved.");
    return { ok: true };
  });
export const moveDraftImage = createServerFn({ method: "POST" })
  .inputValidator(assetRequest.extend({ direction: z.enum(["earlier", "later"]) }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { ownedAsset } = await import("./listing-assets.server");
    const item = await ownedAsset(user.id, data.id);
    if (item.category !== "image" || item.status !== "ready")
      throw new Error("Choose a completed image.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.rpc("move_listing_image", {
      p_seller: user.id,
      p_asset: item.id,
      p_direction: data.direction,
    });
    if (error) throw new Error("Image order could not be saved.");
    return { ok: true };
  });
export const downloadDraftFile = createServerFn({ method: "POST" })
  .inputValidator(assetRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { ownedAsset } = await import("./listing-assets.server");
    const item = await ownedAsset(user.id, data.id);
    if (item.category !== "file" || item.status !== "ready")
      throw new Error("File is not ready to download.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const signed = await db.storage
      .from(assetBucket("file"))
      .createSignedUrl(item.path, 60, { download: item.filename });
    if (signed.error) throw new Error("Download could not be prepared.");
    return { url: signed.data.signedUrl };
  });
