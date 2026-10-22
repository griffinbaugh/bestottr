import { z } from "zod";
export const SANDBOX_ORIGIN = "https://api.escrow-sandbox.com";
export const SANDBOX_FILES = "bestottr-sandbox-deliverables";
export const createSandboxFields = z
  .object({
    requestId: z.string().uuid(),
    draftId: z.string().uuid(),
    buyerHandle: z.string().trim().min(2).max(32),
    buyerEmail: z.string().trim().email().max(254),
    sellerEmail: z.string().trim().email().max(254),
    inspectionDays: z.number().int().min(1).max(30).default(3),
  })
  .refine(
    (d) => d.buyerEmail.toLowerCase() !== d.sellerEmail.toLowerCase(),
    "Use different sandbox buyer and seller accounts.",
  );
export type SandboxState =
  | "preparing"
  | "creating"
  | "creation_uncertain"
  | "awaiting_agreement"
  | "awaiting_funding"
  | "funded"
  | "inspection"
  | "completed"
  | "cancelled"
  | "refunded"
  | "review";
export type SandboxOrder = {
  id: string;
  request_id: string;
  reference: string;
  mode: "sandbox";
  seller_id: string;
  buyer_id: string;
  draft_id: string | null;
  title: string;
  kind: "file" | "experience" | "community";
  amount_cents: number;
  currency: "usd";
  inspection_seconds: number;
  buyer_email: string;
  seller_email: string;
  asset_id: string | null;
  roblox_url: string;
  target_roblox_id: string | null;
  state: SandboxState;
  provider_id: string | null;
  checkout_url: string | null;
  provider_summary: Record<string, unknown>;
  checked_at: string | null;
  last_error: string | null;
  sync_claim: string | null;
  last_sync_attempt_at: string | null;
  ownership_checked_at: string | null;
  ownership_matches: boolean | null;
  created_at: string;
  updated_at: string;
};
export type SandboxFile = {
  id: string;
  order_id: string;
  filename: string;
  size_bytes: number;
  path: string;
  ready: boolean;
};
export type SandboxEvent = { id: number; order_id: string; state: string; created_at: string };
export type SandboxOrderView = Omit<
  SandboxOrder,
  "sync_claim" | "provider_summary" | "buyer_email" | "seller_email"
> & { files: Omit<SandboxFile, "path">[]; events: SandboxEvent[] };
export const stateLabel: Record<SandboxState, string> = {
  preparing: "Preparing order",
  creating: "Creating sandbox checkout",
  creation_uncertain: "Checkout needs reconciliation",
  awaiting_agreement: "Waiting for agreement",
  awaiting_funding: "Waiting for test funding",
  funded: "Test funds secured",
  inspection: "Buyer inspection",
  completed: "Sandbox payment completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  review: "Review required",
};
export const mayDownload = (state: SandboxState) =>
  ["funded", "inspection", "completed"].includes(state);
export function safeCheckoutUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "www.escrow-sandbox.com" ||
    u.port ||
    u.username ||
    u.password ||
    u.pathname !== "/pay" ||
    !u.searchParams.get("token")
  )
    throw new Error("Escrow returned an unexpected checkout address.");
  return u.href;
}
export function centsFromProvider(value: unknown): number {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Invalid escrow amount.");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Invalid escrow amount.");
  return cents;
}
const schedule = z.object({
  amount: z.union([z.string(), z.number()]),
  payer_customer: z.string(),
  beneficiary_customer: z.string(),
  status: z
    .object({
      secured: z.boolean().optional(),
      disbursed_to_beneficiary: z.boolean().optional(),
      disbursed_to_payer: z.boolean().optional(),
      refund_created: z.boolean().optional(),
      refund_resolved: z.boolean().optional(),
    })
    .default({}),
});
const transaction = z.object({
  id: z.number().int().positive().safe(),
  reference: z.string(),
  currency: z.literal("usd"),
  is_cancelled: z.boolean(),
  parties: z.array(
    z.object({ role: z.string(), customer: z.string(), agreed: z.boolean().optional() }),
  ),
  items: z.array(
    z.object({
      type: z.string(),
      quantity: z.number(),
      inspection_period: z.number().int().optional(),
      schedule: z.array(schedule),
      status: z
        .object({
          accepted: z.boolean().optional(),
          received: z.boolean().optional(),
          shipped: z.boolean().optional(),
          rejected: z.boolean().optional(),
          in_dispute: z.boolean().optional(),
          canceled: z.boolean().optional(),
          shipped_returned: z.boolean().optional(),
        })
        .default({}),
    }),
  ),
});
/** Consume only the authenticated fetch response, never webhook/redirect payloads. */
export function verifyProviderTransaction(raw: unknown, order: SandboxOrder) {
  const t = transaction.parse(raw);
  if (String(t.id) !== order.provider_id || t.reference !== order.reference)
    throw new Error("Escrow transaction does not match this order.");
  const buyer = t.parties.filter((p) => p.role === "buyer"),
    seller = t.parties.filter((p) => p.role === "seller");
  if (
    buyer.length !== 1 ||
    seller.length !== 1 ||
    buyer[0]!.customer.toLowerCase() !== order.buyer_email.toLowerCase() ||
    seller[0]!.customer.toLowerCase() !== order.seller_email.toLowerCase()
  )
    throw new Error("Escrow participants do not match this order.");
  const goods = t.items.filter(
    (i) => !["broker_fee", "partner_fee", "shipping_fee"].includes(i.type),
  );
  if (
    goods.length !== 1 ||
    goods[0]!.type !== "general_merchandise" ||
    goods[0]!.quantity !== 1 ||
    goods[0]!.inspection_period !== order.inspection_seconds
  )
    throw new Error("Escrow goods do not match this order.");
  const item = goods[0]!,
    s = item.schedule;
  if (
    s.length !== 1 ||
    centsFromProvider(s[0]!.amount) !== order.amount_cents ||
    s[0]!.payer_customer.toLowerCase() !== order.buyer_email.toLowerCase() ||
    s[0]!.beneficiary_customer.toLowerCase() !== order.seller_email.toLowerCase()
  )
    throw new Error("Escrow payment does not match this order.");
  const paid = s[0]!.status;
  let state: SandboxState;
  if (paid.disbursed_to_payer || paid.refund_resolved) state = "refunded";
  else if (
    item.status.in_dispute ||
    item.status.rejected ||
    item.status.shipped_returned ||
    paid.refund_created
  )
    state = "review";
  else if (t.is_cancelled || item.status.canceled) state = "cancelled";
  else if (paid.disbursed_to_beneficiary && paid.secured) state = "completed";
  else if (paid.secured && (item.status.received || item.status.accepted)) state = "inspection";
  else if (paid.secured) state = "funded";
  else if (buyer[0]!.agreed && seller[0]!.agreed) state = "awaiting_funding";
  else state = "awaiting_agreement";
  return {
    state,
    summary: {
      secured: paid.secured === true,
      accepted: item.status.accepted === true,
      received: item.status.received === true,
      disbursed: paid.disbursed_to_beneficiary === true,
    },
  };
}
