// Provider-neutral payment interface for Experience acquisitions.
// bestottr does not itself hold funds: a payment provider authorizes/holds,
// captures (releases to seller) or refunds. The mock below simulates that
// lifecycle with strict exactly-once semantics for demos and tests; a real
// provider maps holdFunds → authorization/hold, releaseToSeller → capture/transfer,
// refundBuyer → void/refund, keyed by the same idempotency keys.

export type PaymentStatus = "none" | "held" | "released" | "refunded";

export type PaymentLedger = {
  provider: "mock";
  providerTxnId: string;
  amount: number;
  status: PaymentStatus;
  /** Idempotency keys already applied → resulting status. */
  ops: Record<string, PaymentStatus>;
  heldAt: number | null;
  releasedAt: number | null;
  refundedAt: number | null;
  releaseCount: number;
  refundCount: number;
  /** Demo/test hook: make the next release or refund call fail once. */
  failNext: "release" | "refund" | null;
};

export type PaymentResult = { ok: true; ledger: PaymentLedger } | { ok: false; ledger: PaymentLedger; error: string };

export interface PaymentProvider {
  holdFunds(ledger: PaymentLedger, idempotencyKey: string, now: number): PaymentResult;
  releaseToSeller(ledger: PaymentLedger, idempotencyKey: string, now: number): PaymentResult;
  refundBuyer(ledger: PaymentLedger, idempotencyKey: string, now: number): PaymentResult;
  getPaymentStatus(ledger: PaymentLedger): PaymentStatus;
}

export function createLedger(dealId: string, amount: number): PaymentLedger {
  return {
    provider: "mock",
    providerTxnId: `pt_${dealId}`,
    amount,
    status: "none",
    ops: {},
    heldAt: null,
    releasedAt: null,
    refundedAt: null,
    releaseCount: 0,
    refundCount: 0,
    failNext: null,
  };
}

export const idempotencyKey = (l: PaymentLedger, op: "hold" | "release" | "refund") => `${l.providerTxnId}:${op}`;

export const mockPaymentProvider: PaymentProvider = {
  holdFunds(l, key, now) {
    if (l.ops[key]) return { ok: true, ledger: l };
    if (l.status !== "none") return { ok: false, ledger: l, error: "Funds were already processed for this transaction." };
    return { ok: true, ledger: { ...l, status: "held", heldAt: now, ops: { ...l.ops, [key]: "held" } } };
  },
  releaseToSeller(l, key, now) {
    if (l.ops[key]) return { ok: true, ledger: l };
    if (l.status !== "held") return { ok: false, ledger: l, error: `Cannot release funds that are ${l.status}.` };
    if (l.failNext === "release") return { ok: false, ledger: { ...l, failNext: null }, error: "Payment provider unavailable." };
    return { ok: true, ledger: { ...l, status: "released", releasedAt: now, releaseCount: l.releaseCount + 1, ops: { ...l.ops, [key]: "released" } } };
  },
  refundBuyer(l, key, now) {
    if (l.ops[key]) return { ok: true, ledger: l };
    if (l.status !== "held") return { ok: false, ledger: l, error: `Cannot refund funds that are ${l.status}.` };
    if (l.failNext === "refund") return { ok: false, ledger: { ...l, failNext: null }, error: "Payment provider unavailable." };
    return { ok: true, ledger: { ...l, status: "refunded", refundedAt: now, refundCount: l.refundCount + 1, ops: { ...l.ops, [key]: "refunded" } } };
  },
  getPaymentStatus: (l) => l.status,
};
