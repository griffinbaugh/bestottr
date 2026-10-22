import { z } from "zod";
export const SANDBOX_ORIGIN = "https://api.test.trustap.com";
export const SANDBOX_FILES = "bestottr-trustap-test-files";
export const providerId = z.string().regex(/^tx_[a-zA-Z0-9]{1,80}$/);
export const createSandboxFields = z.object({
  requestId: z.string().uuid(),
  draftId: z.string().uuid(),
  buyerHandle: z.string().trim().min(2).max(32),
});
export type SandboxState =
  | "preparing"
  | "creating"
  | "creation_uncertain"
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
  buyer_provider_id: string;
  seller_provider_id: string;
  client_id: string;
  fees_buyer: number;
  fees_seller: number;
  fees_config: number;
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
  sync_pending: boolean;
  last_sync_attempt_at: string | null;
  ownership_checked_at: string | null;
  ownership_matches: boolean | null;
  delivery_submitted_at: string | null;
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
  | "sync_claim"
  | "sync_pending"
  | "provider_summary"
  | "buyer_provider_id"
  | "seller_provider_id"
  | "client_id"
> & {
  files: Omit<SandboxFile, "path">[];
  events: SandboxEvent[];
  complaint_deadline: string | null;
};
export const stateLabel: Record<SandboxState, string> = {
  preparing: "Preparing order",
  creating: "Creating Trustap checkout",
  creation_uncertain: "Creation outcome needs checking",
  awaiting_funding: "Waiting for test payment",
  funded: "Test payment held",
  inspection: "Delivery confirmed; waiting for Trustap",
  completed: "Trustap reports funds released",
  cancelled: "Cancelled",
  refunded: "Refunded",
  review: "Provider review or dispute",
};
export const mayDownload = (state: SandboxState) =>
  ["funded", "inspection", "completed"].includes(state);
export const providerDescription = (o: Pick<SandboxOrder, "id" | "title">) =>
  `[BestOttr sandbox ${o.id}] ${o.title}`;
export function safeCheckoutUrl(raw: string, id: string) {
  const u = new URL(raw);
  if (
    u.origin !== "https://actions.stage.trustap.com" ||
    u.username ||
    u.password ||
    u.pathname !== `/transactions/${providerId.parse(id)}/pay` ||
    u.hash
  )
    throw new Error("Trustap returned an unexpected payment address.");
  // Never trust provider-returned redirect parameters.
  u.search = "";
  return u.href;
}
const cents = z.number().int().nonnegative().safe();
const timestamp = z.string().refine((s) => Number.isFinite(Date.parse(s)), "Invalid provider date");
export const transactionSchema = z.object({
  id: providerId,
  client_id: z.string(),
  description: z.string(),
  status: z.string(),
  buyer: z.object({ id: z.string(), is_guest: z.boolean() }),
  seller: z.object({ id: z.string(), is_guest: z.boolean() }),
  pricing: z.object({
    amount: cents,
    currency: z.literal("usd"),
    amount_extra: cents,
    amount_postage: cents.optional(),
    fees: z.object({
      buyer: cents,
      seller: cents,
      buyer_client: cents,
      seller_client: cents,
      international_payment: cents.optional(),
    }),
  }),
  contains_shipping: z.boolean().optional(),
  payment_link: z.string().optional(),
  events: z.object({ by_key: z.record(timestamp), by_time: z.array(z.unknown()).optional() }),
  deadlines: z.object({ complaints: timestamp.nullable().optional() }),
  funds_release: z.object({
    released_to_seller: z.boolean(),
    refunds: z.array(z.object({ id: z.string(), amount: cents })),
  }),
  review: z.object({ approved: z.boolean() }).optional(),
  complaint: z.unknown().optional(),
  order_issue: z.unknown().optional(),
});
/** Only pass authenticated GET responses here. Webhooks/redirects never authorize fulfillment. */
export function verifyProviderTransaction(raw: unknown, o: SandboxOrder) {
  const t = transactionSchema.parse(raw);
  if (
    t.id !== o.provider_id ||
    t.client_id !== o.client_id ||
    t.description !== providerDescription(o) ||
    t.buyer.id !== o.buyer_provider_id ||
    t.seller.id !== o.seller_provider_id ||
    t.buyer.is_guest ||
    t.seller.is_guest
  )
    throw new Error("Trustap transaction identity does not match this order.");
  const p = t.pricing,
    f = p.fees;
  if (
    p.amount !== o.amount_cents ||
    p.amount_extra !== 0 ||
    (p.amount_postage ?? 0) !== 0 ||
    f.buyer !== o.fees_buyer ||
    f.seller !== o.fees_seller ||
    f.buyer_client !== 0 ||
    f.seller_client !== 0 ||
    (f.international_payment ?? 0) !== 0 ||
    t.contains_shipping === true
  )
    throw new Error("Trustap transaction price or fees do not match this order.");
  let state: SandboxState = "review";
  const e = t.events.by_key;
  if (t.status === "refunded") state = "refunded";
  else if (t.status === "cancelled" || t.status === "rejected") state = "cancelled";
  else if (
    t.funds_release.refunds.length ||
    t.review?.approved === false ||
    t.status === "review_flagged" ||
    t.status === "complaint_submitted" ||
    t.complaint ||
    t.order_issue
  )
    state = "review";
  else if (t.status === "funds_released" && t.funds_release.released_to_seller && e["paid"])
    state = "completed";
  else if (
    ["delivered", "complaint_period_ended"].includes(t.status) &&
    e["paid"] &&
    e["payment_accepted"] &&
    e["delivered"]
  )
    state = "inspection";
  else if (["paid", "payment_accepted"].includes(t.status) && e["paid"]) state = "funded";
  else if (
    ["created", "joined"].includes(t.status) &&
    !e["paid"] &&
    !t.funds_release.released_to_seller
  )
    state = "awaiting_funding";
  return {
    state,
    summary: {
      status: t.status,
      paid: !!e["paid"],
      payment_accepted: !!e["payment_accepted"],
      delivered: !!e["delivered"],
      released: t.funds_release.released_to_seller,
      complaint_deadline: t.deadlines.complaints ?? null,
    },
  };
}

/** Order totals include provider fees and must not be clamped to the listing-input limit. */
export function formatSandboxMoney(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid payment total.");
  return (
    "$" +
    Math.floor(cents / 100).toLocaleString("en-US") +
    "." +
    String(cents % 100).padStart(2, "0")
  );
}
