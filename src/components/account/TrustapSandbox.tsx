import { Link } from "@tanstack/react-router";
import { getAccountOrder } from "@/lib/account-orders.functions";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { AccountLayout, AccountPanel, Field, Message, RequireAccount } from "./AccountLayout";
import { Button, buttonVariants } from "@/components/sb/ui";
import {
  getTrustapSandbox,
  createTrustapSandboxOrder,
  reconcileTrustapSandbox,
  acceptSandboxPayment,
  checkSandboxOwnership,
  confirmSandboxFiles,
  downloadSandboxPurchase,
  discardSandboxPreparation,
  startTrustapConnection,
} from "@/lib/trustap-sandbox.functions";
import { getListingDrafts } from "@/lib/listing-drafts.functions";
import { stateLabel, mayDownload, type SandboxOrderView } from "@/lib/trustap-sandbox";
import type { ListingDraft } from "@/lib/listing-drafts";
import { formatSandboxMoney as centsToDisplay } from "@/lib/trustap-sandbox";
export function TrustapSandbox() {
  const { session } = useAuth();
  return (
    <AccountLayout
      title="Payments — Trustap sandbox"
      description="Test protected purchases and delivery. Live payments remain closed."
    >
      <Content key={session?.user.id} />
    </AccountLayout>
  );
}
export function PrivateOrderPage({ id }: { id: string }) {
  const { session } = useAuth();
  return (
    <RequireAccount>
      <div className="mx-auto max-w-5xl space-y-5 px-5 py-10">
        <h1 className="text-3xl font-semibold">Private order</h1>
        <div className="flex gap-4 text-sm underline">
          <Link to="/dashboard">Buying</Link>
          <Link to="/seller">Selling</Link>
        </div>
        <Content key={(session?.user.id ?? "") + id} orderId={id} />
      </div>
    </RequireAccount>
  );
}
async function load(accessToken: string, orderId?: string) {
  if (orderId) {
    const r = await getAccountOrder({ data: { token: accessToken, id: orderId } });
    return {
      orders: [r.order],
      admin: r.admin,
      configured: false,
      connected: false,
      payoutUrl: null,
    };
  }
  return getTrustapSandbox({ data: { token: accessToken } });
}

function Content({ orderId }: { orderId?: string } = {}) {
  const { session } = useAuth(),
    token = session?.access_token;
  const [orders, setOrders] = useState<SandboxOrderView[]>([]),
    [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [admin, setAdmin] = useState(false),
    [configured, setConfigured] = useState(false),
    [connected, setConnected] = useState(false),
    [payoutUrl, setPayoutUrl] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    requestId: crypto.randomUUID(),
    draftId: "",
    buyerHandle: "",
  });
  const [recovery, setRecovery] = useState<Record<string, string>>({}),
    [confirm, setConfirm] = useState<string | null>(null),
    [discard, setDiscard] = useState<string | null>(null);
  async function refresh() {
    if (!token) return;
    const r = await load(token, orderId);
    setOrders(r.orders);
    setAdmin(r.admin);
    setConfigured(r.configured);
    setConnected(r.connected);
    setPayoutUrl(r.payoutUrl ?? null);
    if (r.admin && !orderId) setDrafts(await getListingDrafts({ data: { token } }));
  }
  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return;
    }
    void load(token, orderId)
      .then(async (r) => {
        if (!active) return;
        setOrders(r.orders);
        setAdmin(r.admin);
        setConfigured(r.configured);
        setConnected(r.connected);
        setPayoutUrl(r.payoutUrl ?? null);
        if (r.admin && !orderId) {
          const rows = await getListingDrafts({ data: { token } });
          if (active) setDrafts(rows);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Orders could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const result = new URL(window.location.href).searchParams.get("trustap");
    if (result && !orderId) {
      setSuccess(result === "connected" ? "Trustap sandbox account connected." : "");
      if (result === "failed")
        setError(
          "Trustap connection failed. Retry, or check that this identity is not linked to another BestOttr account.",
        );
      window.history.replaceState({}, "", "/account/payments");
    }
    return () => {
      active = false;
    };
  }, [token, orderId]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    await run(async () => {
      const order = await createTrustapSandboxOrder({ data: { token, order: form } });
      setSuccess(
        order.last_error ??
          "Test order prepared. The buyer can review fees and open checkout in their account.",
      );
      setForm((f) => ({ ...f, requestId: crypto.randomUUID() }));
    });
  }
  if (!token) return null;
  return (
    <>
      <div className="mb-5 rounded-md border border-warning/40 bg-warning/5 p-4 text-sm">
        <strong>Sandbox only — no real money</strong>
        <p className="mt-1">
          Use Trustap test accounts and disposable test assets. Public purchases are closed. Trustap
          controls release under its configured protection rules.
        </p>
      </div>
      <Message error={error} success={success} />
      {!orderId && (
        <AccountPanel
          title="Trustap account"
          description="Connect your own sandbox account. Identity checks and bank details stay with Trustap."
        >
          <p className="mb-3 text-sm">
            {connected
              ? "Your Trustap sandbox identity is connected."
              : "Both buyer and seller must connect their own Trustap sandbox identities before a test order can be created."}
          </p>
          {!configured && (
            <p className="mb-3 text-sm text-muted-foreground">
              Sandbox credentials have not been configured yet. Your saved drafts are unchanged.
            </p>
          )}
          <Button
            variant="outline"
            disabled={busy || !configured}
            onClick={() =>
              void run(async () => {
                const r = await startTrustapConnection({ data: { token } });
                window.location.assign(r.url);
              })
            }
          >
            {connected ? "Reconnect Trustap" : "Connect Trustap sandbox"}
          </Button>
          {payoutUrl && (
            <a
              className="ml-4 text-sm underline"
              href={payoutUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Complete sandbox payout setup
            </a>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Connecting authorizes this integration through Trustap. No card numbers, banking
            credentials, or identity documents are stored by BestOttr.
          </p>
        </AccountPanel>
      )}
      {admin && !orderId && (
        <AccountPanel
          title="Prepare a test purchase"
          description="Choose a saved fixed-price draft and another BestOttr account. Fees come from Trustap; this step does not charge the buyer."
        >
          <form onSubmit={create} className="space-y-4">
            <fieldset disabled={busy || !configured || !connected} className="space-y-4">
              <Field label="Draft">
                <select
                  required
                  value={form.draftId}
                  onChange={(e) => setForm({ ...form, draftId: e.target.value })}
                  className="w-full rounded-md border border-border bg-background p-3"
                >
                  <option value="">Choose a fixed-price draft</option>
                  {drafts
                    .filter((d) => d.format === "buy_now" && d.price_cents > 0)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} — {centsToDisplay(d.price_cents)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Buyer BestOttr handle">
                <input
                  required
                  value={form.buyerHandle}
                  onChange={(e) => setForm({ ...form, buyerHandle: e.target.value })}
                  className="w-full rounded-md border border-border bg-background p-3"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Roblox delivery is confirmed only after a fresh ownership check matches the buyer.
                There is no extra BestOttr inspection timer. Any Trustap hold or complaint deadline
                still applies. File buyers confirm receipt separately.
              </p>
              <Button type="submit">Prepare test order</Button>
            </fieldset>
          </form>
        </AccountPanel>
      )}
      <div className="my-4">
        <Button variant="outline" disabled={busy} onClick={() => void run(refresh)}>
          Refresh orders
        </Button>
      </div>
      {loading ? (
        <p role="status">Loading test orders…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No test orders yet.</p>
      ) : (
        orders.map((o) => {
          const buyer = o.buyer_id === session.user.id,
            seller = o.seller_id === session.user.id;
          return (
            <AccountPanel key={o.id} title={o.title} description={stateLabel[o.state]}>
              {!orderId && (
                <Link
                  to="/deal/$id"
                  params={{ id: o.id }}
                  className="mb-3 inline-block text-sm underline"
                >
                  Open private order
                </Link>
              )}
              <p className="mb-3 text-sm text-muted-foreground">
                {o.kind === "file"
                  ? "Downloadable project: files become available after a fresh payment check. Confirm receipt only after checking them."
                  : "Roblox ownership transfer: the seller transfers the experience or community to the pinned buyer. No game-file upload or download is required."}
              </p>
              <p className="text-sm">
                Price {centsToDisplay(o.amount_cents)} · Buyer fee {centsToDisplay(o.fees_buyer)} ·
                Seller fee {centsToDisplay(o.fees_seller)}
              </p>
              <p className="mt-1 text-sm">
                Buyer total {centsToDisplay(o.amount_cents + o.fees_buyer)} · Seller proceeds
                {centsToDisplay(o.amount_cents - o.fees_seller)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {o.checked_at
                  ? `Provider last checked ${new Date(o.checked_at).toLocaleString()}`
                  : "Payment status has not been checked."}
              </p>
              {o.last_error && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {o.last_error}
                </p>
              )}
              {o.complaint_deadline && (
                <p className="mt-3 text-sm">
                  Trustap complaint deadline: {new Date(o.complaint_deadline).toLocaleString()}.
                  This is set by Trustap.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {buyer && o.checkout_url && o.state === "awaiting_funding" && (
                  <a
                    className={buttonVariants()}
                    href={o.checkout_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Trustap test checkout
                  </a>
                )}
                {o.provider_id && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await reconcileTrustapSandbox({ data: { token, id: o.id } });
                      })
                    }
                  >
                    Check status
                  </Button>
                )}
                {seller && o.state === "funded" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await acceptSandboxPayment({ data: { token, id: o.id } });
                        setSuccess(
                          "Payment acceptance checked. Transfer the asset only when Trustap confirms the payment is accepted.",
                        );
                      })
                    }
                  >
                    Accept held test payment
                  </Button>
                )}
                {o.kind !== "file" && o.state === "funded" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await checkSandboxOwnership({ data: { token, id: o.id } });
                        setSuccess(
                          "Ownership verified and delivery confirmation checked. Trustap controls the release status.",
                        );
                      })
                    }
                  >
                    Verify buyer ownership & confirm delivery
                  </Button>
                )}
                {buyer && o.kind === "file" && o.state === "funded" && (
                  <Button variant="outline" disabled={busy} onClick={() => setConfirm(o.id)}>
                    Confirm files received
                  </Button>
                )}
                {seller && o.state === "preparing" && (
                  <Button variant="outline" disabled={busy} onClick={() => setDiscard(o.id)}>
                    Discard preparation
                  </Button>
                )}
              </div>
              {!o.provider_id &&
                ["creating", "creation_uncertain"].includes(o.state) &&
                seller &&
                admin && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm">
                      Locate the existing transaction in the Trustap dashboard using this order ID:{" "}
                      {o.id}. Do not create another transaction.
                    </p>
                    <Field label="Existing Trustap transaction ID">
                      <input
                        value={recovery[o.id] ?? ""}
                        onChange={(e) => setRecovery({ ...recovery, [o.id]: e.target.value })}
                        className="w-full rounded-md border border-border bg-background p-3"
                      />
                    </Field>
                    <Button
                      disabled={busy || !recovery[o.id]}
                      onClick={() =>
                        void run(async () => {
                          await reconcileTrustapSandbox({
                            data: { token, id: o.id, providerId: recovery[o.id] },
                          });
                        })
                      }
                    >
                      Reconcile existing transaction
                    </Button>
                  </div>
                )}
              {o.kind !== "file" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Expected Roblox buyer ID {o.target_roblox_id}.{" "}
                  {o.ownership_matches
                    ? "Ownership matched at " + new Date(o.ownership_checked_at!).toLocaleString()
                    : "Buyer ownership has not been confirmed."}
                </p>
              )}
              {buyer && o.files.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {o.files.map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-4 text-sm">
                      <span>{file.filename}</span>
                      <Button
                        variant="outline"
                        disabled={busy || !file.ready || !mayDownload(o.state)}
                        onClick={() =>
                          void run(async () => {
                            const r = await downloadSandboxPurchase({
                              data: { token, id: o.id, fileId: file.id },
                            });
                            window.location.assign(r.url);
                          })
                        }
                      >
                        Download
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <a
                className="mt-4 inline-block text-sm underline"
                href="https://app.stage.trustap.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Trustap sandbox for disputes and account details
              </a>
              {o.events.length > 0 && (
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary>Order history</summary>
                  <ul className="mt-2 space-y-1">
                    {o.events.map((e) => (
                      <li key={e.id}>
                        {new Date(e.created_at).toLocaleString()} — {e.state}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </AccountPanel>
          );
        })
      )}
      {confirm && (
        <AccountPanel title="Confirm delivery of your files">
          <p className="mb-3 text-sm">
            Confirm that you have downloaded and checked the files. This starts Trustap’s configured
            completion process and may release the test payment. Report a problem through Trustap
            instead if anything is missing.
          </p>
          <div className="flex gap-3">
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await confirmSandboxFiles({ data: { token, id: confirm, confirm: true } });
                  setConfirm(null);
                })
              }
            >
              I received and checked the files
            </Button>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Keep checking
            </Button>
          </div>
        </AccountPanel>
      )}
      {discard && (
        <AccountPanel title="Discard failed preparation?">
          <p className="mb-3 text-sm">
            This only discards preparation before a Trustap transaction exists.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await discardSandboxPreparation({ data: { token, id: discard } });
                setDiscard(null);
              })
            }
          >
            Discard preparation
          </Button>
          <Button variant="outline" onClick={() => setDiscard(null)}>
            Keep
          </Button>
        </AccountPanel>
      )}
    </>
  );
}
