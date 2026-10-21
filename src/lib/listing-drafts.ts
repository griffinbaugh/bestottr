import { z } from "zod";

export const draftFields = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(["experience", "community"]),
    url: z.string().trim().min(1).max(500),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(10000),
    format: z.enum(["buy_now", "auction"]),
    priceCents: z.number().int().min(0).max(99_999_999_99),
    reserveCents: z.number().int().min(0).max(99_999_999_99).nullable(),
  })
  .superRefine((d, ctx) => {
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
  kind: "experience" | "community";
  asset_id: string;
  place_id: string | null;
  roblox_user_id: string;
  creator_type: "User" | "Group";
  creator_id: string;
  asset_name: string;
  title: string;
  description: string;
  format: "buy_now" | "auction";
  price_cents: number;
  reserve_cents: number | null;
  ownership_checked_at: string;
  created_at: string;
  updated_at: string;
};

/** Game links contain place IDs. Creator Dashboard links contain universe IDs and are deliberately not interpreted as places. */
export function parseDraftAsset(kind: DraftInput["kind"], input: string): string | null {
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
