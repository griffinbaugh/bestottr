import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { escrowSandboxClient, sandboxConfig } from "./escrow-provider.server";
import {
  verifyProviderTransaction,
  SANDBOX_FILES,
  type SandboxOrder,
  type SandboxOrderView,
} from "./escrow-sandbox";
export async function sandboxAdmin(userId: string) {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !error && data === true;
}
export async function participantOrder(userId: string, id: string): Promise<SandboxOrder> {
  const { data, error } = await db
    .from("escrow_sandbox_orders")
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
      .from("escrow_sandbox_files")
      .select("id,order_id,filename,size_bytes,ready")
      .eq("order_id", order.id),
    db.from("escrow_sandbox_events").select("*").eq("order_id", order.id).order("created_at"),
  ]);
  if (fe || ee) throw new Error("Sandbox order details could not be loaded.");
  const { sync_claim, provider_summary, buyer_email, seller_email, ...view } = order;
  return {
    ...view,
    checkout_url: userId === order.buyer_id ? order.checkout_url : null,
    files: files ?? [],
    events: events ?? [],
  };
}
export async function syncSandboxOrder(order: SandboxOrder, force = false): Promise<SandboxOrder> {
  sandboxConfig();
  if (!order.provider_id) throw new Error("Reconcile the sandbox checkout first.");
  const { data: claim, error } = await db.rpc("claim_escrow_sandbox_sync", {
    p_order: order.id,
    p_force: force,
  });
  if (error) throw new Error("Sandbox status could not be checked.");
  if (!claim)
    throw new Error(
      "A status check is in progress or was just completed. Try again in 15 seconds.",
    );
  try {
    const raw = await escrowSandboxClient().get(order.provider_id);
    const verified = verifyProviderTransaction(raw, order);
    const committed = await db.rpc("commit_escrow_sandbox_sync", {
      p_order: order.id,
      p_claim: claim,
      p_state: verified.state,
      p_summary: verified.summary,
    });
    if (committed.error || !committed.data)
      throw new Error("Sandbox status changed during this check. Refresh and try again.");
    const { data: saved, error: readError } = await db
      .from("escrow_sandbox_orders")
      .select("*")
      .eq("id", order.id)
      .single();
    if (readError || !saved) throw new Error("Sandbox order could not be refreshed.");
    return saved;
  } catch (e) {
    await db
      .from("escrow_sandbox_orders")
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
    const { error: recordError } = await db
      .from("escrow_sandbox_files")
      .insert({
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
      throw new Error("Deliverable snapshot could not be copied. No escrow checkout was created.");
    const stored = await db.storage.from(SANDBOX_FILES).info(path);
    if (stored.error || stored.data.size !== file.size_bytes)
      throw new Error(
        "Deliverable snapshot could not be verified. No escrow checkout was created.",
      );
    const saved = await db
      .from("escrow_sandbox_files")
      .update({ ready: true })
      .eq("id", id)
      .eq("order_id", order.id);
    if (saved.error) throw new Error("Deliverable snapshot could not be completed.");
  }
}
/** Webhooks are hints only. The same authenticated transaction validation runs as for a participant check. */
export async function sandboxWebhook(raw: unknown) {
  const event = raw as { event_type?: unknown; transaction_id?: unknown };
  if (
    !event ||
    event.event_type !== "transaction" ||
    !Number.isSafeInteger(event.transaction_id) ||
    Number(event.transaction_id) <= 0
  )
    return;
  const { data: order, error } = await db
    .from("escrow_sandbox_orders")
    .select("*")
    .eq("provider_id", String(event.transaction_id))
    .eq("mode", "sandbox")
    .maybeSingle();
  if (error) throw new Error("Order lookup failed");
  if (!order) return;
  // A cooldown or active check produces a retryable response, so funding events are not lost.
  await syncSandboxOrder(order);
}
