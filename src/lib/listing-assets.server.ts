import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { assetBucket, matchesImage, type ListingAsset, type AssetView } from "./listing-assets";
export async function ownedDraft(userId: string, draftId: string) {
  const { data, error } = await db
    .from("listing_drafts")
    .select("id,cover_asset_id")
    .eq("id", draftId)
    .eq("seller_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("This draft could not be found.");
  return data;
}
export async function ownedAsset(userId: string, id: string) {
  const { data, error } = await db
    .from("listing_assets")
    .select("*")
    .eq("id", id)
    .eq("seller_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("This upload could not be found.");
  await ownedDraft(userId, data.draft_id);
  return data;
}
export async function listAssets(userId: string, draftId: string): Promise<AssetView[]> {
  await ownedDraft(userId, draftId);
  const { data, error } = await db
    .from("listing_assets")
    .select("*")
    .eq("draft_id", draftId)
    .eq("seller_id", userId)
    .order("position")
    .order("created_at");
  if (error) throw new Error("Uploads could not be loaded.");
  return Promise.all(
    (data ?? []).map(async (item) => {
      const { path, seller_id, ...view } = item;
      let url: string | null = null;
      if (item.category === "image" && item.status === "ready") {
        const signed = await db.storage.from(assetBucket("image")).createSignedUrl(path, 3600);
        if (signed.error) throw new Error("Image previews could not be loaded.");
        url = signed.data.signedUrl;
      }
      return { ...view, url };
    }),
  );
}
export async function removeAsset(item: ListingAsset) {
  const { error } = await db.storage.from(assetBucket(item.category)).remove([item.path]);
  if (error) throw new Error("Upload could not be removed. Please try again.");
  const deleted = await db
    .from("listing_assets")
    .delete()
    .eq("id", item.id)
    .eq("seller_id", item.seller_id);
  if (deleted.error) throw new Error("Upload could not be removed. Please try again.");
}
export async function deleteDraftAssets(userId: string, draftId: string) {
  await ownedDraft(userId, draftId);
  const { data, error } = await db
    .from("listing_assets")
    .select("*")
    .eq("draft_id", draftId)
    .eq("seller_id", userId);
  if (error) throw new Error("Draft uploads could not be loaded.");
  for (const item of data ?? []) await removeAsset(item);
}
export async function completeAsset(item: ListingAsset) {
  if (item.status === "ready") return;
  const bucket = db.storage.from(assetBucket(item.category));
  const { data: info, error } = await bucket.info(item.path);
  if (error || !info) throw new Error("Upload is incomplete. Try uploading again.");
  if (info.size !== item.size_bytes || info.contentType !== item.content_type) {
    await removeAsset(item);
    throw new Error("The uploaded file did not match its size or type. Please upload again.");
  }
  if (item.category === "image") {
    const downloaded = await bucket.download(item.path);
    if (downloaded.error) throw new Error("Image could not be checked. Try again.");
    const header = new Uint8Array(await downloaded.data.slice(0, 12).arrayBuffer());
    if (!matchesImage(header, item.content_type)) {
      await removeAsset(item);
      throw new Error("Choose a valid PNG, JPEG or WebP image.");
    }
  }
  const saved = await db
    .from("listing_assets")
    .update({ status: "ready" })
    .eq("id", item.id)
    .eq("seller_id", item.seller_id);
  if (saved.error) throw new Error("Upload could not be attached. Try again.");
}
