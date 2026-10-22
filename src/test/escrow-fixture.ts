import type { SandboxOrder } from "@/lib/escrow-sandbox";
export const escrowOrder: SandboxOrder = {
  id: "aa000000-0000-4000-8000-000000000001",
  request_id: "bb000000-0000-4000-8000-000000000002",
  reference: "bt_aaaaaaaaaaaaaaaaaaaa",
  mode: "sandbox",
  seller_id: "seller",
  buyer_id: "buyer",
  draft_id: null,
  title: "Test project",
  kind: "file",
  amount_cents: 12345,
  currency: "usd",
  inspection_seconds: 259200,
  buyer_email: "buyer@test.escrow.com",
  seller_email: "seller@test.escrow.com",
  asset_id: null,
  roblox_url: "",
  target_roblox_id: null,
  state: "awaiting_funding",
  provider_id: "123",
  checkout_url: "https://www.escrow-sandbox.com/pay?token=test-checkout",
  provider_summary: {},
  checked_at: null,
  last_error: null,
  sync_claim: null,
  last_sync_attempt_at: null,
  ownership_checked_at: null,
  ownership_matches: null,
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T00:00:00Z",
};
export function escrowTransaction() {
  return {
    id: 123,
    reference: escrowOrder.reference,
    currency: "usd",
    is_cancelled: false,
    parties: [
      { role: "buyer", customer: escrowOrder.buyer_email, agreed: true },
      { role: "seller", customer: escrowOrder.seller_email, agreed: true },
    ],
    items: [
      {
        type: "general_merchandise",
        quantity: 1,
        inspection_period: 259200,
        schedule: [
          {
            amount: "123.45",
            payer_customer: escrowOrder.buyer_email,
            beneficiary_customer: escrowOrder.seller_email,
            status: {
              secured: false,
              disbursed_to_beneficiary: false,
              disbursed_to_payer: false,
              refund_created: false,
              refund_resolved: false,
            },
          },
        ],
        status: {
          accepted: false,
          received: false,
          shipped: false,
          rejected: false,
          in_dispute: false,
          canceled: false,
          shipped_returned: false,
        },
      },
    ],
  };
}
