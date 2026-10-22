import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { trustapSandboxClient, sandboxConfig } from "./trustap-provider.server";
import {
  verifyProviderTransaction,
  SANDBOX_FILES,
  type SandboxOrder,
  type SandboxOrderView,
} from "./trustap-sandbox";
export async function sandboxAdmin(userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !error && data === true;
}
export async function participantOrder(userId: string, id: string): Promise<SandboxOrder> {
  const { data, error } = await db
    .from("trustap_sandbox_orders")
    .select("*")
    .eq("id", id)
    .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
    .maybeSingle();
  if (error || !data) throw new Error("This sandbox order could not be found.");
  return data;
}
export async function orderView(order: SandboxOrder, userId: string): Promise<SandboxOrderView> {
  const [{ data: files, error: fe }, { data: events, error: ee }] = await Promise.all([
    db
      .from("trustap_sandbox_files")
      .select("id,order_id,filename,size_bytes,ready")
      .eq("order_id", order.id),
    db.from("trustap_sandbox_events").select("*").eq("order_id", order.id).order("created_at"),
  ]);
  if (fe || ee) throw new Error("Sandbox order details could not be loaded.");
  const {
    sync_claim,
    sync_pending,
    provider_summary,
    buyer_provider_id,
    seller_provider_id,
    client_id,
    ...view
  } = order;
  return {
    ...view,
    complaint_deadline:
      typeof provider_summary["complaint_deadline"] === "string"
        ? provider_summary["complaint_deadline"]
        : null,
    checkout_url: userId === order.buyer_id ? order.checkout_url : null,
    files: files ?? [],
    events: events ?? [],
  };
}
export async function syncSandboxOrder(order: SandboxOrder, force = false): Promise<SandboxOrder> {
  sandboxConfig();
  if (!order.provider_id) throw new Error("Reconcile the sandbox checkout first.");
  const { data: claim, error } = await db.rpc("claim_trustap_sandbox_sync", {
    p_order: order.id,
    p_force: force,
  });
  if (error) throw new Error("Sandbox status could not be checked.");
  if (!claim)
    throw new Error(
      "A status check is in progress or was just completed. Try again in 15 seconds.",
    );
  try {
    const raw = await trustapSandboxClient().get(order.provider_id);
    const verified = verifyProviderTransaction(raw, order);
    const committed = await db.rpc("commit_trustap_sandbox_sync", {
      p_order: order.id,
      p_claim: claim,
      p_state: verified.state,
      p_summary: verified.summary,
    });
    if (committed.error || !committed.data)
      throw new Error("Sandbox status changed during this check. Refresh and try again.");
    const { data: saved, error: readError } = await db
      .from("trustap_sandbox_orders")
      .select("*")
      .eq("id", order.id)
      .single();
    if (readError || !saved) throw new Error("Sandbox order could not be refreshed.");
    return saved;
  } catch (e) {
    await db
      .from("trustap_sandbox_orders")
      .update({
        sync_claim: null,
        last_error: "Status could not be verified. Files remain subject to a fresh provider check.",
      })
      .eq("id", order.id)
      .eq("sync_claim", claim);
    throw e;
  }
}
export async function snapshotFiles(
  order: SandboxOrder,
  source: { filename: string; size_bytes: number; path: string }[],
) {
  for (const file of source) {
    const id = crypto.randomUUID(),
      path = order.id + "/" + id;
    const { error: recordError } = await db.from("trustap_sandbox_files").insert({
      id,
      order_id: order.id,
      filename: file.filename,
      size_bytes: file.size_bytes,
      path,
      ready: false,
    });
    if (recordError) throw new Error("Deliverable snapshot could not be recorded.");
    const copied = await db.storage
      .from("bestottr-draft-files")
      .copy(file.path, path, { destinationBucket: SANDBOX_FILES });
    if (copied.error)
      throw new Error("Deliverable snapshot could not be copied. No Trustap checkout was created.");
    const stored = await db.storage.from(SANDBOX_FILES).info(path);
    if (stored.error || stored.data.size !== file.size_bytes)
      throw new Error(
        "Deliverable snapshot could not be verified. No Trustap checkout was created.",
      );
    const saved = await db
      .from("trustap_sandbox_files")
      .update({ ready: true })
      .eq("id", id)
      .eq("order_id", order.id);
    if (saved.error) throw new Error("Deliverable snapshot could not be completed.");
  }
}
/** Serialize payment/delivery commands and reconcile provider state before retrying. */
export async function runSandboxAction(
  order: SandboxOrder,
  action: "accept" | "ownership" | "files",
) {
  sandboxConfig();
  if (!order.provider_id) throw new Error("Reconcile checkout creation first.");
  const lease = await db.rpc("claim_trustap_sandbox_sync", { p_order: order.id, p_force: true });
  if (lease.error || !lease.data)
    throw new Error("An order check is already running. Try again shortly.");
  const claim = lease.data,
    client = trustapSandboxClient();
  try {
    let verified = verifyProviderTransaction(await client.get(order.provider_id), order);
    if (!["funded", "inspection", "completed"].includes(verified.state))
      throw new Error(
        "Trustap has not confirmed a usable payment, or the transaction is under review.",
      );
    if (action === "accept") {
      if (verified.state === "funded" && !verified.summary.payment_accepted)
        await client.acceptPayment(order);
    } else if (!verified.summary.delivered && verified.state !== "completed") {
      if (!verified.summary.payment_accepted)
        throw new Error(
          "The seller must accept the held payment before delivery can be confirmed.",
        );
      if (action === "ownership") {
        if (order.kind === "file" || !order.target_roblox_id)
          throw new Error("This is not a Roblox transfer.");
        const { verifyDraftOwnership } = await import("./listing-ownership.server");
        const proof = await verifyDraftOwnership(
          order.kind,
          order.roblox_url,
          order.target_roblox_id,
        );
        if (proof.asset_id !== order.asset_id)
          throw new Error("The exact asset is not owned by the intended buyer.");
        const observed = await db
          .from("trustap_sandbox_orders")
          .update({ ownership_matches: true, ownership_checked_at: new Date().toISOString() })
          .eq("id", order.id)
          .eq("sync_claim", claim)
          .select("id")
          .single();
        if (observed.error || !observed.data)
          throw new Error("Ownership observation could not be recorded.");
      } else if (order.kind !== "file")
        throw new Error("Roblox transfers require ownership verification.");
      // Re-fetch after the external ownership lookup: a new dispute/refund must stop fulfillment.
      verified = verifyProviderTransaction(await client.get(order.provider_id), order);
      if (verified.state !== "funded" || !verified.summary.payment_accepted)
        throw new Error("Provider status changed. Delivery was not confirmed.");
      const ownsLease = await db
        .from("trustap_sandbox_orders")
        .select("sync_claim,last_sync_attempt_at")
        .eq("id", order.id)
        .eq("sync_claim", claim)
        .single();
      if (
        ownsLease.error ||
        !ownsLease.data ||
        Date.now() - Date.parse(ownsLease.data.last_sync_attempt_at ?? "") > 60000
      )
        throw new Error("Verification lease expired. Recheck before confirming delivery.");
      await client.confirmDelivery(order);
      // No local inspection timer or payout endpoint: Trustap enforces its configured release rules.
      await db
        .from("trustap_sandbox_orders")
        .update({ delivery_submitted_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("sync_claim", claim);
    }
    verified = verifyProviderTransaction(await client.get(order.provider_id), order);
    const commit = await db.rpc("commit_trustap_sandbox_sync", {
      p_order: order.id,
      p_claim: claim,
      p_state: verified.state,
      p_summary: verified.summary,
    });
    if (commit.error || !commit.data)
      throw new Error("Action outcome needs reconciliation. Refresh before retrying.");
    const result = await db.from("trustap_sandbox_orders").select("*").eq("id", order.id).single();
    if (result.error || !result.data) throw new Error("Order could not be refreshed.");
    return result.data;
  } catch (e) {
    await db
      .from("trustap_sandbox_orders")
      .update({
        sync_claim: null,
        last_error:
          "The action could not be confirmed. Check status before retrying; no release is assumed.",
      })
      .eq("id", order.id)
      .eq("sync_claim", claim);
    throw e;
  }
}
export async function processSandboxOrder(order: SandboxOrder) {
  const updated = await syncSandboxOrder(order);
  if (
    updated.kind !== "file" &&
    updated.state === "funded" &&
    updated.provider_summary["payment_accepted"] === true
  )
    return runSandboxAction(updated, "ownership");
  return updated;
}
export async function sandboxWebhook(raw: unknown) {
  const { z } = await import("zod");
  const hint = z
    .object({
      code: z.string().startsWith("tx."),
      target_id: z.string().regex(/^tx_[a-zA-Z0-9]{1,80}$/),
    })
    .safeParse(raw);
  if (!hint.success) return;
  const order = await db
    .from("trustap_sandbox_orders")
    .select("*")
    .eq("provider_id", hint.data.target_id)
    .maybeSingle();
  if (order.error) throw new Error("Order lookup failed.");
  if (!order.data) return;
  // Persist before processing because Trustap does not retry failed deliveries.
  const queued = await db
    .from("trustap_sandbox_orders")
    .update({ sync_pending: true })
    .eq("id", order.data.id);
  if (queued.error) throw new Error("Update could not be queued.");
  try {
    await processSandboxOrder(order.data);
  } catch {
    /* Durable flag + scheduled/manual reconciliation recover. */
  }
}
export async function reconcileSandboxBatch() {
  sandboxConfig();
  const batch = await db
    .from("trustap_sandbox_orders")
    .select("*")
    .not("provider_id", "is", null)
    .or("sync_pending.eq.true,state.not.in.(cancelled,refunded,completed)")
    .order("checked_at", { ascending: true, nullsFirst: true })
    .limit(5);
  if (batch.error) throw new Error("Sandbox reconciliation unavailable.");
  for (const order of batch.data ?? []) {
    try {
      await processSandboxOrder(order);
    } catch {
      /* Other orders must still progress; per-order last_error persists. */
    }
  }
  return { checked: batch.data?.length ?? 0 };
}
