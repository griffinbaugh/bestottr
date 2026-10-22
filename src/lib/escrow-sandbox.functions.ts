import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createSandboxFields,
  mayDownload,
  SANDBOX_FILES,
  type SandboxOrder,
} from "./escrow-sandbox";
const token = z.string().min(20).max(10000);
const orderRequest = z.object({ token, id: z.string().uuid() });
export const getEscrowSandbox = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { sandboxAdmin, orderView } = await import("./escrow-sandbox.server");
    const admin = await sandboxAdmin(user.id);
    const configured =
      process.env["ESCROW_SANDBOX_ENABLED"] === "true" &&
      !!process.env["ESCROW_SANDBOX_EMAIL"] &&
      !!process.env["ESCROW_SANDBOX_API_KEY"];
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const rows = await db
      .from("escrow_sandbox_orders")
      .select("*")
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (rows.error)
      throw new Error("Escrow sandbox database setup is not complete. Your drafts are unchanged.");
    return {
      admin,
      configured,
      orders: await Promise.all((rows.data ?? []).map((o) => orderView(o, user.id))),
    };
  });
export const createEscrowSandboxOrder = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, order: createSandboxFields }))
  .handler(async ({ data }) => {
    const { verifiedAccount, siteOrigin } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { sandboxAdmin, orderView, snapshotFiles } = await import("./escrow-sandbox.server");
    if (!(await sandboxAdmin(user.id)))
      throw new Error("Only an administrator can create sandbox orders.");
    const { sandboxConfig, escrowSandboxClient } = await import("./escrow-provider.server");
    sandboxConfig();
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const input = data.order;
    const old = await db
      .from("escrow_sandbox_orders")
      .select("*")
      .eq("seller_id", user.id)
      .eq("request_id", input.requestId)
      .maybeSingle();
    if (old.error) throw new Error("Sandbox order could not be checked.");
    if (old.data) return orderView(old.data, user.id);
    const draft = await db
      .from("listing_drafts")
      .select("*")
      .eq("id", input.draftId)
      .eq("seller_id", user.id)
      .maybeSingle();
    if (draft.error || !draft.data) throw new Error("Choose one of your saved drafts.");
    const d = draft.data;
    if (d.format !== "buy_now" || d.price_cents <= 0)
      throw new Error("Sandbox checkout currently requires a fixed-price draft greater than zero.");
    const buyer = await db
      .from("profiles")
      .select("id")
      .eq("handle", input.buyerHandle.replace(/^@/, "").toLowerCase())
      .maybeSingle();
    if (buyer.error || !buyer.data || buyer.data.id === user.id)
      throw new Error("Choose a different BestOttr account as the test buyer.");
    const files = await db
      .from("listing_assets")
      .select("filename,size_bytes,path,status")
      .eq("draft_id", d.id)
      .eq("seller_id", user.id)
      .eq("category", "file");
    if (files.error || files.data?.some((f) => f.status !== "ready"))
      throw new Error("Finish or remove incomplete deliverable uploads first.");
    if (d.kind === "file" && !files.data?.length)
      throw new Error("Attach a deliverable file before testing checkout.");
    let target: string | null = null;
    if (d.kind !== "file") {
      const [{ data: sellerLink }, { data: buyerLink }] = await Promise.all([
        db.from("roblox_accounts").select("roblox_user_id").eq("user_id", user.id).maybeSingle(),
        db
          .from("roblox_accounts")
          .select("roblox_user_id")
          .eq("user_id", buyer.data.id)
          .maybeSingle(),
      ]);
      if (!sellerLink || !buyerLink)
        throw new Error("Both test accounts must connect Roblox before testing a transfer.");
      const { verifyDraftOwnership } = await import("./listing-ownership.server");
      const url =
        d.kind === "experience"
          ? `https://www.roblox.com/games/${d.place_id}`
          : `https://www.roblox.com/communities/${d.asset_id}`;
      const proof = await verifyDraftOwnership(d.kind, url, sellerLink.roblox_user_id);
      if (proof.asset_id !== d.asset_id)
        throw new Error("The draft asset changed. Re-save it first.");
      target = buyerLink.roblox_user_id;
    }
    const id = crypto.randomUUID();
    const inserted = await db
      .from("escrow_sandbox_orders")
      .insert({
        id,
        request_id: input.requestId,
        reference: "bt_" + id.replaceAll("-", "").slice(0, 20),
        mode: "sandbox",
        seller_id: user.id,
        buyer_id: buyer.data.id,
        draft_id: d.id,
        title: d.title,
        kind: d.kind,
        amount_cents: d.price_cents,
        currency: "usd",
        inspection_seconds: input.inspectionDays * 86400,
        buyer_email: input.buyerEmail.toLowerCase(),
        seller_email: input.sellerEmail.toLowerCase(),
        asset_id: d.asset_id,
        target_roblox_id: target,
        roblox_url:
          d.kind === "file"
            ? ""
            : d.kind === "experience"
              ? `https://www.roblox.com/games/${d.place_id}`
              : `https://www.roblox.com/communities/${d.asset_id}`,
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      // A concurrent request with the same key can only reuse the original order.
      const existing = await db
        .from("escrow_sandbox_orders")
        .select("*")
        .eq("seller_id", user.id)
        .eq("request_id", input.requestId)
        .maybeSingle();
      if (existing.data) return orderView(existing.data, user.id);
      throw new Error(
        "This test buyer already has an active checkout for the draft, or the order could not be created.",
      );
    }
    let order = inserted.data;
    try {
      await snapshotFiles(order, files.data ?? []);
      const claim = await db
        .from("escrow_sandbox_orders")
        .update({ state: "creating" })
        .eq("id", id)
        .eq("state", "preparing")
        .select("*")
        .single();
      if (claim.error || !claim.data) throw new Error("Checkout creation could not be claimed.");
      order = claim.data;
      const checkout = await escrowSandboxClient().create(order, siteOrigin() + "/account/escrow");
      const saved = await db
        .from("escrow_sandbox_orders")
        .update({ ...checkout, state: "awaiting_agreement", last_error: null })
        .eq("id", id)
        .eq("state", "creating")
        .select("*")
        .single();
      if (saved.error || !saved.data)
        throw new Error("Checkout could not be recorded. Reconcile the existing order.");
      return orderView(saved.data, user.id);
    } catch {
      const state = order.state === "creating" ? "creation_uncertain" : "preparing";
      const saved = await db
        .from("escrow_sandbox_orders")
        .update({
          state,
          last_error:
            state === "preparing"
              ? "File preparation failed before checkout creation. Discard this preparation and try again."
              : "Checkout creation may have completed. Reconcile this order; do not create another checkout.",
        })
        .eq("id", id)
        .select("*")
        .single();
      if (saved.error || !saved.data)
        throw new Error("Order needs reconciliation. Refresh before trying again.");
      return orderView(saved.data, user.id);
    }
  });
export const reconcileEscrowSandbox = createServerFn({ method: "POST" })
  .inputValidator(orderRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, orderView, syncSandboxOrder } =
      await import("./escrow-sandbox.server");
    let order = await participantOrder(user.id, data.id);
    if (!order.provider_id) {
      if (!["creating", "creation_uncertain"].includes(order.state))
        throw new Error("This order has no checkout to reconcile.");
      const { escrowSandboxClient } = await import("./escrow-provider.server");
      const checkout = await escrowSandboxClient().recover(order.reference);
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const saved = await db
        .from("escrow_sandbox_orders")
        .update({ ...checkout, state: "awaiting_agreement", last_error: null })
        .eq("id", order.id)
        .is("provider_id", null)
        .select("*")
        .single();
      if (saved.error || !saved.data)
        throw new Error("Order changed during reconciliation. Refresh and retry.");
      order = saved.data;
    }
    order = await syncSandboxOrder(order);
    return orderView(order, user.id);
  });
export const checkSandboxOwnership = createServerFn({ method: "POST" })
  .inputValidator(orderRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, syncSandboxOrder, orderView } =
      await import("./escrow-sandbox.server");
    let order = await syncSandboxOrder(await participantOrder(user.id, data.id));
    if (order.kind === "file" || !order.target_roblox_id || !mayDownload(order.state))
      throw new Error("Ownership checks start after test funding for an experience or community.");
    const { verifyDraftOwnership } = await import("./listing-ownership.server");
    let matches = false;
    try {
      const proof = await verifyDraftOwnership(
        order.kind,
        order.roblox_url,
        order.target_roblox_id,
      );
      matches = proof.asset_id === order.asset_id;
    } catch {
      throw new Error(
        "Buyer ownership could not be confirmed. No escrow acceptance or release has been sent.",
      );
    }
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const saved = await db
      .from("escrow_sandbox_orders")
      .update({ ownership_matches: matches, ownership_checked_at: new Date().toISOString() })
      .eq("id", order.id)
      .select("*")
      .single();
    if (saved.error || !saved.data) throw new Error("Ownership result could not be recorded.");
    order = saved.data;
    return orderView(order, user.id);
  });
export const downloadSandboxPurchase = createServerFn({ method: "POST" })
  .inputValidator(orderRequest.extend({ fileId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, syncSandboxOrder } = await import("./escrow-sandbox.server");
    const original = await participantOrder(user.id, data.id);
    if (original.buyer_id !== user.id)
      throw new Error("Only the test buyer can download this purchase.");
    const order = await syncSandboxOrder(original, true);
    if (!mayDownload(order.state))
      throw new Error(
        "Files unlock only after Escrow confirms secured test funds, with no cancellation, refund or review.",
      );
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const item = await db
      .from("escrow_sandbox_files")
      .select("*")
      .eq("id", data.fileId)
      .eq("order_id", order.id)
      .eq("ready", true)
      .maybeSingle();
    if (item.error || !item.data) throw new Error("This deliverable could not be found.");
    const signed = await db.storage
      .from(SANDBOX_FILES)
      .createSignedUrl(item.data.path, 60, { download: item.data.filename });
    if (signed.error) throw new Error("Download could not be prepared.");
    return { url: signed.data.signedUrl };
  });
export const discardSandboxPreparation = createServerFn({ method: "POST" })
  .inputValidator(orderRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder } = await import("./escrow-sandbox.server");
    const order = await participantOrder(user.id, data.id);
    if (order.seller_id !== user.id || order.state !== "preparing" || order.provider_id)
      throw new Error("An existing escrow checkout cannot be discarded here.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const result = await db
      .from("escrow_sandbox_orders")
      .update({ state: "cancelled", last_error: null })
      .eq("id", order.id)
      .eq("state", "preparing")
      .is("provider_id", null)
      .select("id")
      .single();
    if (result.error || !result.data) throw new Error("Preparation could not be discarded.");
    return { ok: true };
  });

export const connectSandboxUpdates = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { verifiedAccount, siteOrigin } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { sandboxAdmin } = await import("./escrow-sandbox.server");
    if (!(await sandboxAdmin(user.id))) throw new Error("Administrator access is required.");
    const { escrowSandboxClient } = await import("./escrow-provider.server");
    await escrowSandboxClient().ensureWebhook(siteOrigin() + "/api/escrow/sandbox/webhook");
    return { ok: true };
  });
