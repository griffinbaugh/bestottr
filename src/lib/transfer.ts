// Experience acquisition transfer state machine.
// Pure, deterministic functions (time is always passed in) so the same engine can
// run inside a server job/worker with a transactional row lock. Money moves only
// through the PaymentProvider, and only as a consequence of verified Roblox
// ownership (payout) or of cancellation/expiry before confirmation (refund).

import { idempotencyKey, mockPaymentProvider, createLedger, type PaymentLedger, type PaymentProvider } from "./payment-provider";

export const TRANSFER_WINDOW_MS = 72 * 3600_000;
export const EXTENSION_MS = 24 * 3600_000;
export const WARNING_MS = 24 * 3600_000;
export const URGENT_MS = 6 * 3600_000;
export const MANUAL_CHECK_COOLDOWN_MS = 30_000;
export const AMBIGUOUS_LIMIT = 3;

export type TransferState =
  | "awaiting_funding"
  | "funded_locked"
  | "transfer_in_progress"
  | "verifying_ownership"
  | "ownership_confirmed"
  | "payout_releasing"
  | "completed"
  | "refunding"
  | "refunded"
  | "cancelled"
  | "manual_review";

export type OwnershipMode = "user" | "group";

export type AssetIdentity = {
  placeId: string;
  universeId: string;
  groupId: string | null;
  mode: OwnershipMode;
  originalOwnerId: string;
  originalOwnerName: string;
  /** Demo fixtures read from the deterministic demo Roblox world instead of live APIs. */
  demo: boolean;
};

export type TargetAccount = {
  userId: string;
  username: string;
  displayName: string;
  profileUrl: string;
  avatarUrl: string | null;
  source: "connected" | "profile_url";
};

export type Observation = {
  placeId: string | null;
  universeId: string | null;
  creatorType: "User" | "Group" | null;
  creatorId: string | null;
  /** Owner of the creator group (group mode only). Roles/ranks are deliberately not part of this shape. */
  groupOwnerId: string | null;
  source: string;
  checkedAt: number;
};

export type OwnershipResult = "match" | "mismatch" | "ambiguous";

export type Evidence = {
  targetUserId: string;
  observedOwnerId: string | null;
  placeId: string | null;
  universeId: string | null;
  groupId: string | null;
  source: string;
  checkedAt: number;
  result: OwnershipResult;
};

export type TransferEvent = { at: number; kind: string; text: string };

export type ExperienceTransfer = {
  dealId: string;
  state: TransferState;
  asset: AssetIdentity;
  target: TargetAccount | null;
  targetConfirmed: boolean;
  targetLockedAt: number | null;
  fundedAt: number | null;
  transferStartedAt: number | null;
  expiresAt: number | null;
  extensionUsed: boolean;
  extensionRequests: { buyer: boolean; seller: boolean };
  payment: PaymentLedger;
  verification: {
    lastCheckedAt: number | null;
    nextCheckAt: number | null;
    lastResult: OwnershipResult | "error" | null;
    consecutiveErrors: number;
    ambiguousCount: number;
    lastManualCheckAt: number | null;
    evidence: Evidence | null;
    confirmedAt: number | null;
  };
  paidOutAt: number | null;
  refundedAt: number | null;
  cancelledAt: number | null;
  events: TransferEvent[];
};

export type Party = "buyer" | "seller";
export type StepResult = { ok: boolean; t: ExperienceTransfer; error?: string };

/** States in which the transfer is funded, unconfirmed, and the monitor is running. */
export const MONITORED: TransferState[] = ["funded_locked", "transfer_in_progress", "verifying_ownership"];
export const TERMINAL: TransferState[] = ["completed", "refunded", "cancelled"];

export const STATE_LABELS: Record<TransferState, string> = {
  awaiting_funding: "Awaiting funding",
  funded_locked: "Funds protected",
  transfer_in_progress: "Transfer in progress",
  verifying_ownership: "Verifying ownership",
  ownership_confirmed: "Ownership confirmed",
  payout_releasing: "Releasing payout",
  completed: "Completed",
  refunding: "Refunding buyer",
  refunded: "Refunded",
  cancelled: "Cancelled",
  manual_review: "Manual review",
};

const ev = (t: ExperienceTransfer, at: number, kind: string, text: string): ExperienceTransfer => ({ ...t, events: [{ at, kind, text }, ...t.events] });
const ok = (t: ExperienceTransfer): StepResult => ({ ok: true, t });
const fail = (t: ExperienceTransfer, error: string): StepResult => ({ ok: false, t, error });

export function createTransfer(dealId: string, asset: AssetIdentity, amount: number, now: number): ExperienceTransfer {
  return ev(
    {
      dealId,
      state: "awaiting_funding",
      asset,
      target: null,
      targetConfirmed: false,
      targetLockedAt: null,
      fundedAt: null,
      transferStartedAt: null,
      expiresAt: null,
      extensionUsed: false,
      extensionRequests: { buyer: false, seller: false },
      payment: createLedger(dealId, amount),
      verification: { lastCheckedAt: null, nextCheckAt: null, lastResult: null, consecutiveErrors: 0, ambiguousCount: 0, lastManualCheckAt: null, evidence: null, confirmedAt: null },
      paidOutAt: null,
      refundedAt: null,
      cancelledAt: null,
      events: [],
    },
    now,
    "opened",
    "Deal opened — buyer must choose the destination Roblox account before funding",
  );
}

/** Buyer chooses the destination account. Only allowed before funding. */
export function chooseTarget(t: ExperienceTransfer, target: TargetAccount, now: number): StepResult {
  if (t.state !== "awaiting_funding" || t.targetLockedAt) return fail(t, "The destination account is locked once funds are protected.");
  if (!/^\d{1,19}$/.test(target.userId)) return fail(t, "Invalid Roblox user ID.");
  return ok(ev({ ...t, target, targetConfirmed: false }, now, "target_selected", `Destination selected: @${target.username} (ID ${target.userId})`));
}

export function confirmTarget(t: ExperienceTransfer, now: number): StepResult {
  if (t.state !== "awaiting_funding" || !t.target) return fail(t, "Choose a destination account first.");
  if (t.targetConfirmed) return ok(t);
  return ok(ev({ ...t, targetConfirmed: true }, now, "target_confirmed", `Buyer confirmed destination @${t.target.username} (ID ${t.target.userId})`));
}

/** Hold buyer funds with the provider, lock the destination and start the 72h window. */
export function fundTransfer(t: ExperienceTransfer, now: number, provider: PaymentProvider = mockPaymentProvider): StepResult {
  if (t.state !== "awaiting_funding") return t.fundedAt ? ok(t) : fail(t, "This transaction can no longer be funded.");
  if (!t.target || !t.targetConfirmed) return fail(t, "Confirm the destination Roblox account before funding.");
  const r = provider.holdFunds(t.payment, idempotencyKey(t.payment, "hold"), now);
  if (!r.ok) return fail({ ...t, payment: r.ledger }, r.error);
  let n: ExperienceTransfer = {
    ...t,
    payment: r.ledger,
    state: "funded_locked",
    fundedAt: now,
    targetLockedAt: now,
    expiresAt: now + TRANSFER_WINDOW_MS,
    verification: { ...t.verification, nextCheckAt: now + 60_000 },
  };
  n = ev(n, now, "funded", "Funds protected — held by the payment provider until Roblox ownership is confirmed");
  n = ev(n, now, "target_locked", `Destination locked: @${t.target.username} (ID ${t.target.userId})`);
  return ok(n);
}

/** Seller's claim. Updates status only — it never moves money. */
export function markTransferStarted(t: ExperienceTransfer, now: number): StepResult {
  if (t.state === "transfer_in_progress" || t.state === "verifying_ownership") return ok(t);
  if (t.state !== "funded_locked") return fail(t, "Transfer can only be started while funds are protected.");
  if (t.expiresAt !== null && now >= t.expiresAt) return fail(t, "The transfer window has expired.");
  return ok(ev({ ...t, state: "transfer_in_progress", transferStartedAt: now }, now, "transfer_claimed", "Seller reported the Roblox transfer as started — payment still waits for automatic verification"));
}

function refund(t: ExperienceTransfer, now: number, provider: PaymentProvider, reason: string): StepResult {
  let n = t.state === "refunding" ? t : ev({ ...t, state: "refunding" }, now, "refunding", reason);
  const r = provider.refundBuyer(n.payment, idempotencyKey(n.payment, "refund"), now);
  n = { ...n, payment: r.ledger };
  if (!r.ok) return ok(ev(n, now, "refund_retry", "Refund pending — payment provider will be retried automatically"));
  return ok(ev({ ...n, state: "refunded", refundedAt: now }, now, "refunded", "Buyer funds released back by the payment provider"));
}

export function cancelTransfer(t: ExperienceTransfer, by: Party, now: number, provider: PaymentProvider = mockPaymentProvider): StepResult {
  if (t.state === "awaiting_funding") return ok(ev({ ...t, state: "cancelled", cancelledAt: now }, now, "cancelled", `Cancelled by ${by} before funding`));
  if (t.state === "funded_locked") return refund({ ...t, cancelledAt: now }, now, provider, `Cancelled by ${by} before the transfer started — refunding buyer`);
  if (t.state === "transfer_in_progress" || t.state === "verifying_ownership")
    return fail(t, "The seller has started the transfer. Funds stay protected until ownership is confirmed or the window expires. Contact support for exceptional cases.");
  return fail(t, "This transaction can no longer be cancelled.");
}

/** One 24h extension, only with both parties' approval, before expiry and confirmation. */
export function requestExtension(t: ExperienceTransfer, by: Party, now: number): StepResult {
  if (!MONITORED.includes(t.state) || t.expiresAt === null) return fail(t, "Extensions are only available during an active transfer.");
  if (t.extensionUsed) return fail(t, "The one-time extension has already been used.");
  if (now >= t.expiresAt) return fail(t, "The transfer window has already expired.");
  const req = { ...t.extensionRequests, [by]: true };
  let n = ev({ ...t, extensionRequests: req }, now, "extension_request", `${by === "buyer" ? "Buyer" : "Seller"} approved a 24-hour extension`);
  if (req.buyer && req.seller) {
    n = ev({ ...n, extensionUsed: true, expiresAt: t.expiresAt + EXTENSION_MS, extensionRequests: { buyer: false, seller: false } }, now, "extended", "Both parties approved — deadline extended by 24 hours (one-time)");
  }
  return ok(n);
}

/** Strict ownership comparison against the immutable asset identity and locked target. */
export function evaluateOwnership(asset: AssetIdentity, targetUserId: string, o: Observation): OwnershipResult {
  if (!o.universeId || !o.creatorType || !o.creatorId) return "ambiguous";
  if (o.universeId !== asset.universeId) return "mismatch";
  if (o.placeId !== null && o.placeId !== asset.placeId) return "mismatch";
  if (asset.mode === "user") return o.creatorType === "User" && o.creatorId === targetUserId ? "match" : "mismatch";
  if (o.creatorType !== "Group" || o.creatorId !== asset.groupId) return "mismatch";
  if (!o.groupOwnerId) return "ambiguous";
  return o.groupOwnerId === targetUserId ? "match" : "mismatch";
}

export const checkInterval = (t: ExperienceTransfer, now: number) => (t.fundedAt !== null && now - t.fundedAt < 30 * 60_000 ? 60_000 : 180_000);
export const errorBackoff = (errors: number) => Math.min(60_000 * 2 ** Math.max(0, errors - 1), 600_000);

export function releasePayout(t: ExperienceTransfer, now: number, provider: PaymentProvider = mockPaymentProvider): StepResult {
  if (t.state === "completed") return ok(t);
  if (t.state !== "ownership_confirmed" && t.state !== "payout_releasing") return fail(t, "Payout requires confirmed ownership.");
  let n = t.state === "payout_releasing" ? t : ev({ ...t, state: "payout_releasing" }, now, "payout_releasing", "Releasing payment to seller");
  const r = provider.releaseToSeller(n.payment, idempotencyKey(n.payment, "release"), now);
  n = { ...n, payment: r.ledger };
  if (!r.ok) return ok(ev(n, now, "payout_retry", "Payout pending — payment provider will be retried automatically"));
  return ok(ev({ ...n, state: "completed", paidOutAt: now }, now, "paid_out", "Seller payment released automatically"));
}

export function expireIfDue(t: ExperienceTransfer, now: number, provider: PaymentProvider = mockPaymentProvider): StepResult {
  if (t.state === "refunding") return refund(t, now, provider, "");
  if (!MONITORED.includes(t.state) || t.expiresAt === null || now < t.expiresAt) return ok(t);
  return refund({ ...t, cancelledAt: now }, now, provider, "Transfer window expired before ownership was confirmed — refunding buyer");
}

export type CheckOutcome = { observation: Observation } | { error: string; checkedAt: number };

/**
 * Apply one verifier result. Idempotent: results arriving after a terminal or
 * confirmed state change nothing. An observation taken before the deadline wins;
 * one taken at/after the deadline cannot confirm ownership.
 */
export function applyCheck(t: ExperienceTransfer, outcome: CheckOutcome, now: number, provider: PaymentProvider = mockPaymentProvider): StepResult {
  if (t.state === "ownership_confirmed" || t.state === "payout_releasing") return releasePayout(t, now, provider);
  if (!MONITORED.includes(t.state) || !t.target || t.expiresAt === null) return ok(t);
  const checkedAt = "observation" in outcome ? outcome.observation.checkedAt : outcome.checkedAt;
  if (checkedAt >= t.expiresAt) return expireIfDue(t, Math.max(now, t.expiresAt), provider);
  const v = t.verification;
  if ("error" in outcome) {
    const errors = v.consecutiveErrors + 1;
    return ok(ev({ ...t, verification: { ...v, lastCheckedAt: checkedAt, lastResult: "error", consecutiveErrors: errors, nextCheckAt: now + errorBackoff(errors) } }, now, "check_error", `Roblox check failed (${outcome.error}) — retrying, no funds moved`));
  }
  const o = outcome.observation;
  const result = evaluateOwnership(t.asset, t.target.userId, o);
  const evidence: Evidence = {
    targetUserId: t.target.userId,
    observedOwnerId: t.asset.mode === "group" ? o.groupOwnerId : o.creatorId,
    placeId: o.placeId,
    universeId: o.universeId,
    groupId: t.asset.groupId,
    source: o.source,
    checkedAt,
    result,
  };
  const base = { ...v, lastCheckedAt: checkedAt, lastResult: result, consecutiveErrors: 0, evidence };
  if (result === "match") {
    const n = ev({ ...t, state: "ownership_confirmed", verification: { ...base, ambiguousCount: 0, nextCheckAt: null, confirmedAt: checkedAt } }, now, "confirmed", `Ownership confirmed: Roblox reports ${t.asset.mode === "group" ? "group owner" : "owner"} ${evidence.observedOwnerId} = locked destination`);
    return releasePayout(n, now, provider);
  }
  if (result === "ambiguous") {
    const amb = v.ambiguousCount + 1;
    if (amb >= AMBIGUOUS_LIMIT) return ok(ev({ ...t, state: "manual_review", verification: { ...base, ambiguousCount: amb, nextCheckAt: null } }, now, "manual_review", "Roblox data was inconsistent repeatedly — sent to manual review, no funds moved"));
    return ok(ev({ ...t, verification: { ...base, ambiguousCount: amb, nextCheckAt: now + checkInterval(t, now) } }, now, "check_ambiguous", "Roblox data incomplete — will check again"));
  }
  const state = t.state === "transfer_in_progress" ? "verifying_ownership" : t.state;
  return ok(ev({ ...t, state, verification: { ...base, ambiguousCount: 0, nextCheckAt: now + checkInterval(t, now) } }, now, "check", `Checked Roblox: owner ${evidence.observedOwnerId ?? "unknown"} — not yet the destination account`));
}

export function canCheckNow(t: ExperienceTransfer, now: number): boolean {
  return MONITORED.includes(t.state) && (t.verification.lastManualCheckAt === null || now - t.verification.lastManualCheckAt >= MANUAL_CHECK_COOLDOWN_MS);
}

export const isCheckDue = (t: ExperienceTransfer, now: number) =>
  MONITORED.includes(t.state) && t.verification.nextCheckAt !== null && now >= t.verification.nextCheckAt;

/** Background-monitor step: retries pending provider calls, enforces expiry, then runs a due check. */
export function tick(t: ExperienceTransfer, now: number, observe: () => CheckOutcome, provider: PaymentProvider = mockPaymentProvider): StepResult {
  if (t.state === "payout_releasing") return releasePayout(t, now, provider);
  if (t.state === "refunding") return expireIfDue(t, now, provider);
  const e = expireIfDue(t, now, provider);
  if (e.t !== t) return e;
  if (isCheckDue(t, now)) return applyCheck(t, observe(), now, provider);
  return ok(t);
}

export function deadlineLevel(t: ExperienceTransfer, now: number): "none" | "normal" | "warning" | "urgent" | "expired" {
  if (t.expiresAt === null || !MONITORED.includes(t.state)) return "none";
  const left = t.expiresAt - now;
  if (left <= 0) return "expired";
  if (left <= URGENT_MS) return "urgent";
  if (left <= WARNING_MS) return "warning";
  return "normal";
}
