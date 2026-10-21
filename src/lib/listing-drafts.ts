import { z } from "zod";

export const draftFields = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(["experience", "community", "file"]),
    url: z.string().trim().max(500),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(10000),
    format: z.enum(["buy_now", "auction"]),
    priceCents: z.number().int().min(0).max(99_999_999_99),
    auctionEndsAt: z.number().int().min(0).max(8640000000000000).nullable().optional(),
    reserveCents: z.number().int().min(0).max(99_999_999_99).nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.kind !== "file" && !parseDraftAsset(d.kind, d.url))
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Paste a full Roblox game or community link.",
      });
    if (d.format === "auction" && d.reserveCents !== null && d.reserveCents < d.priceCents)
      ctx.addIssue({
        code: "custom",
        path: ["reserveCents"],
        message: "Reserve must be at least the starting bid.",
      });
  });
export type DraftInput = z.infer<typeof draftFields>;
export type ListingDraft = {
  id: string;
  seller_id: string;
  kind: "experience" | "community" | "file";
  asset_id: string | null;
  place_id: string | null;
  roblox_user_id: string | null;
  creator_type: "User" | "Group" | null;
  creator_id: string | null;
  asset_name: string;
  title: string;
  description: string;
  format: "buy_now" | "auction";
  price_cents: number;
  reserve_cents: number | null;
  ownership_checked_at: string | null;
  auction_ends_at: number | null;
  cover_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Game links contain place IDs. Creator Dashboard links contain universe IDs and are deliberately not interpreted as places. */
export function parseDraftAsset(kind: DraftInput["kind"], input: string): string | null {
  if (kind === "file") return null;
  try {
    const u = new URL(input.trim());
    if (
      u.protocol !== "https:" ||
      !["www.roblox.com", "roblox.com"].includes(u.hostname) ||
      u.username ||
      u.password ||
      u.port
    )
      return null;
    const match =
      kind === "experience"
        ? u.pathname.match(/^\/games\/([1-9]\d{0,18})(?:\/|$)/)
        : u.pathname.match(/^\/(?:groups|communities)\/([1-9]\d{0,18})(?:\/|$)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
