import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createSandboxFields,
  mayDownload,
  SANDBOX_FILES,
  type SandboxOrder,
} from "./trustap-sandbox";
const token = z.string().min(20).max(10000);
const orderRequest = z.object({ token, id: z.string().uuid() });
export const getTrustapSandbox = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { sandboxAdmin, orderView } = await import("./trustap-sandbox.server");
    const admin = await sandboxAdmin(user.id);
    const configured =
      process.env["TRUSTAP_SANDBOX_ENABLED"] === "true" &&
      !!process.env["TRUSTAP_CLIENT_ID"] &&
      !!process.env["TRUSTAP_SANDBOX_API_KEY"];
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const rows = await db
      .from("trustap_sandbox_orders")
      .select("*")
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (rows.error)
      throw new Error("Trustap sandbox database setup is not complete. Your drafts are unchanged.");
    const { data: connection } = await db
      .from("trustap_sandbox_accounts")
      .select("connected_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return {
      connected: !!connection,
      payoutUrl: process.env["TRUSTAP_CLIENT_ID"]
        ? "https://app.stage.trustap.com/profile/payout/personal?edit=true&client_id=" +
          encodeURIComponent(process.env["TRUSTAP_CLIENT_ID"])
        : null,
      admin,
      configured,
      orders: await Promise.all((rows.data ?? []).map((o) => orderView(o, user.id))),
    };
  });
export const createTrustapSandboxOrder = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, order: createSandboxFields }))
  .handler(async ({ data }) => {
    const { verifiedAccount, siteOrigin } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { sandboxAdmin, orderView, snapshotFiles } = await import("./trustap-sandbox.server");
    if (!(await sandboxAdmin(user.id)))
      throw new Error("Only an administrator can create sandbox orders.");
    const { sandboxConfig, trustapSandboxClient } = await import("./trustap-provider.server");
    const config = sandboxConfig();
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const input = data.order;
    const old = await db
      .from("trustap_sandbox_orders")
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
    const identities = await db
      .from("trustap_sandbox_accounts")
      .select("user_id,provider_user_id")
      .in("user_id", [user.id, buyer.data.id]);
    const sellerIdentity = identities.data?.find((x) => x.user_id === user.id),
      buyerIdentity = identities.data?.find((x) => x.user_id === buyer.data!.id);
    if (identities.error || !sellerIdentity || !buyerIdentity)
      throw new Error(
        "Both BestOttr accounts must connect their own Trustap sandbox account first.",
      );
    const fees = await trustapSandboxClient().fees(d.price_cents);
    if (fees.seller > d.price_cents || !Number.isSafeInteger(fees.buyer + d.price_cents))
      throw new Error("Trustap seller fees exceed this test price.");
    const id = crypto.randomUUID();
    const inserted = await db
      .from("trustap_sandbox_orders")
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
        buyer_provider_id: buyerIdentity.provider_user_id,
        seller_provider_id: sellerIdentity.provider_user_id,
        client_id: config.clientId,
        fees_buyer: fees.buyer,
        fees_seller: fees.seller,
        fees_config: fees.config,
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
        .from("trustap_sandbox_orders")
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
        .from("trustap_sandbox_orders")
        .update({ state: "creating" })
        .eq("id", id)
        .eq("state", "preparing")
        .select("*")
        .single();
      if (claim.error || !claim.data) throw new Error("Checkout creation could not be claimed.");
      order = claim.data;
      const client = trustapSandboxClient();
      const raw = await client.create(order);
      const { transactionSchema, verifyProviderTransaction } = await import("./trustap-sandbox");
      const transaction = transactionSchema.parse(raw);
      verifyProviderTransaction(transaction, { ...order, provider_id: transaction.id });
      if (!transaction.payment_link) throw new Error("Trustap payment link missing.");
      const checkout = {
        provider_id: transaction.id,
        checkout_url: client.checkout(
          transaction.payment_link,
          transaction.id,
          siteOrigin() + "/account/payments",
        ),
      };
      const saved = await db
        .from("trustap_sandbox_orders")
        .update({ ...checkout, state: "awaiting_funding", last_error: null })
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
        .from("trustap_sandbox_orders")
        .update({
          state,
          last_error:
            state === "preparing"
              ? "File preparation failed before checkout creation. Discard this preparation and try again."
              : "Checkout creation may have completed. Reconcile this order; do not create another checkout.",
        })
        .eq("id", id)
        .eq("state", order.state)
        .select("*")
        .single();
      if (saved.error || !saved.data)
        throw new Error("Order needs reconciliation. Refresh before trying again.");
      return orderView(saved.data, user.id);
    }
  });
export const reconcileTrustapSandbox = createServerFn({ method: "POST" })
  .inputValidator(orderRequest.extend({ providerId: z.string().optional() }))
  .handler(async ({ data }) => {
    const { verifiedAccount, siteOrigin } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, orderView, syncSandboxOrder, sandboxAdmin } =
      await import("./trustap-sandbox.server");
    let order = await participantOrder(user.id, data.id);
    if (!order.provider_id) {
      if (
        user.id !== order.seller_id ||
        !(await sandboxAdmin(user.id)) ||
        !data.providerId ||
        !["creating", "creation_uncertain"].includes(order.state)
      )
        throw new Error(
          "The seller must locate the transaction ID in the Trustap dashboard, then reconcile this existing order. Never retry creation.",
        );
      const { trustapSandboxClient } = await import("./trustap-provider.server");
      const client = trustapSandboxClient();
      const { verifyProviderTransaction, transactionSchema } = await import("./trustap-sandbox");
      const raw = transactionSchema.parse(await client.get(data.providerId));
      const proof = verifyProviderTransaction(raw, { ...order, provider_id: data.providerId });
      if (!raw.payment_link) throw new Error("Trustap payment link missing.");
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const saved = await db
        .from("trustap_sandbox_orders")
        .update({
          provider_id: raw.id,
          checkout_url: client.checkout(
            raw.payment_link,
            raw.id,
            siteOrigin() + "/account/payments",
          ),
          state: proof.state,
          last_error: null,
        })
        .eq("id", order.id)
        .is("provider_id", null)
        .in("state", ["creating", "creation_uncertain"])
        .select("*")
        .single();
      if (saved.error || !saved.data)
        throw new Error("Order changed. Refresh and reconcile again.");
      order = saved.data;
    }
    return orderView(await syncSandboxOrder(order), user.id);
  });
export const acceptSandboxPayment = createServerFn({ method: "POST" })
  .inputValidator(orderRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, runSandboxAction, orderView } =
      await import("./trustap-sandbox.server");
    const order = await participantOrder(user.id, data.id);
    if (order.seller_id !== user.id) throw new Error("Only the seller may accept this payment.");
    return orderView(await runSandboxAction(order, "accept"), user.id);
  });
export const checkSandboxOwnership = createServerFn({ method: "POST" })
  .inputValidator(orderRequest)
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, runSandboxAction, orderView } =
      await import("./trustap-sandbox.server");
    return orderView(
      await runSandboxAction(await participantOrder(user.id, data.id), "ownership"),
      user.id,
    );
  });
export const confirmSandboxFiles = createServerFn({ method: "POST" })
  .inputValidator(orderRequest.extend({ confirm: z.literal(true) }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, runSandboxAction, orderView } =
      await import("./trustap-sandbox.server");
    const order = await participantOrder(user.id, data.id);
    if (order.buyer_id !== user.id || order.kind !== "file")
      throw new Error("Only the buyer can confirm receipt of a file purchase.");
    return orderView(await runSandboxAction(order, "files"), user.id);
  });
export const downloadSandboxPurchase = createServerFn({ method: "POST" })
  .inputValidator(orderRequest.extend({ fileId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { verifiedAccount } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { participantOrder, syncSandboxOrder } = await import("./trustap-sandbox.server");
    const original = await participantOrder(user.id, data.id);
    if (original.buyer_id !== user.id)
      throw new Error("Only the test buyer can download this purchase.");
    const order = await syncSandboxOrder(original, true);
    if (!mayDownload(order.state))
      throw new Error(
        "Files unlock only after Trustap confirms secured test funds, with no cancellation, refund or review.",
      );
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const item = await db
      .from("trustap_sandbox_files")
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
    const { participantOrder } = await import("./trustap-sandbox.server");
    const order = await participantOrder(user.id, data.id);
    if (order.seller_id !== user.id || order.state !== "preparing" || order.provider_id)
      throw new Error("An existing Trustap checkout cannot be discarded here.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const result = await db
      .from("trustap_sandbox_orders")
      .update({ state: "cancelled", last_error: null })
      .eq("id", order.id)
      .eq("state", "preparing")
      .is("provider_id", null)
      .select("id")
      .single();
    if (result.error || !result.data) throw new Error("Preparation could not be discarded.");
    return { ok: true };
  });

export const startTrustapConnection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { verifiedAccount, siteOrigin } = await import("./account.server");
    const user = await verifiedAccount(data.token);
    const { oauthConfig, TRUSTAP_SSO } = await import("./trustap-oauth.server");
    const config = oauthConfig();
    const { getRequest, setCookie } = await import("@tanstack/react-start/server");
    if (new URL(getRequest().url).origin !== siteOrigin())
      throw new Error("Connect Trustap from bestottr.com.");
    const { newOAuthFlow, sealFlow } = await import("./oauth-state.server");
    const { flow, challenge } = await newOAuthFlow(data.token);
    const cookie = await sealFlow(flow, config.stateSecret, "bestottr-trustap-v1");
    if (cookie.length > 3800)
      throw new Error("Session too large to connect securely. Sign in again.");
    setCookie("__Secure-bestottr-trustap", cookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/trustap/callback",
      maxAge: 300,
    });
    const url = new URL(TRUSTAP_SSO + "/auth");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: siteOrigin() + "/api/trustap/callback",
      response_type: "code",
      scope: "openid",
      state: flow.state,
      nonce: flow.state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "consent",
      login_hint: user.email ?? "",
    }).toString();
    return { url: url.href };
  });
