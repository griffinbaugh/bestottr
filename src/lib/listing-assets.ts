import { z } from "zod";
export const uploadFields = z
  .object({
    draftId: z.string().uuid(),
    category: z.enum(["image", "file"]),
    filename: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[^\x00-\x1f\x7f/\\]+$/, "Use a filename without folders or control characters."),
    contentType: z.string(),
    size: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
  })
  .superRefine((v, ctx) => {
    if (
      v.category === "image" &&
      (v.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(v.contentType))
    )
      ctx.addIssue({ code: "custom", message: "Images must be PNG, JPEG or WebP, up to 5 MB." });
    if (
      v.category === "file" &&
      (!/\.(zip|rbxm|rbxl|rbxmx|rbxlx)$/i.test(v.filename) ||
        v.contentType !== "application/octet-stream")
    )
      ctx.addIssue({
        code: "custom",
        message: "Deliverables must be ZIP or Roblox model/place files, up to 50 MB.",
      });
  });
export type ListingAsset = {
  id: string;
  draft_id: string;
  seller_id: string;
  category: "image" | "file";
  filename: string;
  content_type: string;
  size_bytes: number;
  path: string;
  status: "pending" | "ready";
  position: number;
  created_at: string;
};
export type AssetView = Omit<ListingAsset, "path" | "seller_id"> & { url: string | null };
export const assetBucket = (category: "image" | "file") =>
  category === "image" ? "bestottr-draft-images" : "bestottr-draft-files";
export function matchesImage(bytes: Uint8Array, type: string) {
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return (
    type === "image/webp" &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  );
}
export const bytesLabel = (n: number) =>
  n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
