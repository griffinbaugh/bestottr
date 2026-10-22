import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { AccountLayout, AccountPanel, Field, Message } from "./AccountLayout";
import { Button, buttonVariants } from "@/components/sb/ui";
import {
  getEscrowSandbox,
  createEscrowSandboxOrder,
  reconcileEscrowSandbox,
  checkSandboxOwnership,
  downloadSandboxPurchase,
  discardSandboxPreparation,
  connectSandboxUpdates,
} from "@/lib/escrow-sandbox.functions";
import { getListingDrafts } from "@/lib/listing-drafts.functions";
import {
  createSandboxFields,
  stateLabel,
  mayDownload,
  type SandboxOrderView,
} from "@/lib/escrow-sandbox";
import type { ListingDraft } from "@/lib/listing-drafts";
import { centsToDisplay } from "@/lib/currency";
import { bytesLabel } from "@/lib/listing-assets";
export function EscrowSandbox() {
  const { session } = useAuth();
  return (
    <AccountLayout
      title="Escrow sandbox"
      description="Test checkout, delivery and transfer tracking without real money."
    >
      <SandboxContent key={session?.user.id} />
    </AccountLayout>
  );
}
function SandboxContent() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [orders, setOrders] = useState<SandboxOrderView[]>([]),
    [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [admin, setAdmin] = useState(false),
    [configured, setConfigured] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    requestId: crypto.randomUUID(),
    draftId: "",
    buyerHandle: "",
    buyerEmail: "",
    sellerEmail: "",
    inspectionDays: 3,
  });
  const [discardId, setDiscardId] = useState<string | null>(null);
  async function refresh() {
    if (!token) return;
    const r = await getEscrowSandbox({ data: { token } });
    setAdmin(r.admin);
    setConfigured(r.configured);
    setOrders(r.orders);
    if (r.admin) setDrafts(await getListingDrafts({ data: { token } }));
  }
  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      return;
    }
    void getEscrowSandbox({ data: { token } })
      .then(async (r) => {
        if (!active) return;
        setAdmin(r.admin);
        setConfigured(r.configured);
        setOrders(r.orders);
        if (r.admin) {
          const rows = await getListingDrafts({ data: { token } });
          if (active) setDrafts(rows);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Sandbox orders could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This request could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const parsed = createSandboxFields.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the test details.");
      return;
    }
    await run(async () => {
      const order = await createEscrowSandboxOrder({ data: { token, order: parsed.data } });
      setSuccess(
        order.last_error ??
          "Sandbox order created. The buyer can open checkout from their account.",
      );
      setForm((f) => ({ ...f, requestId: crypto.randomUUID() }));
    });
  }
  if (!token) return null;
  return (
    <>
      <div className="mb-5 rounded-md border border-warning/40 bg-warning/5 p-4 text-sm">
        <strong>Sandbox only</strong>
        <p className="mt-1">
          No real payment, payout or live purchase occurs here. Use dedicated Escrow sandbox
          accounts and test files. Final acceptance, returns and disputes happen with Escrow;
          BestOttr does not automatically release funds.
        </p>
      </div>
      <Message error={error} success={success} />
      <div className="my-4">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void run(refresh)}>
          Refresh orders
        </Button>
      </div>
      {!configured && (
        <AccountPanel title="Sandbox setup">
          <p className="text-sm text-muted-foreground">
            The sandbox is not connected. Configure its account email and API key in the Worker,
            then enable it. Credentials never belong in this form. Existing draft listings remain
            private.
          </p>
          {admin && (
            <p className="mt-2 text-xs text-muted-foreground">
              Required runtime variables: ESCROW_SANDBOX_ENABLED=true, ESCROW_SANDBOX_EMAIL,
              ESCROW_SANDBOX_API_KEY.
            </p>
          )}
        </AccountPanel>
      )}
      {admin && configured && (
        <AccountPanel
          title="Sandbox updates"
          description="Connect provider notifications to keep stored order status current. Use Refresh orders to see the latest changes."
        >
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await connectSandboxUpdates({ data: { token } });
                setSuccess("Sandbox updates connected.");
              })
            }
          >
            Connect sandbox updates
          </Button>
        </AccountPanel>
      )}
      {admin && (
        <AccountPanel
          title="Create a test order"
          description="Choose your fixed-price draft and a second BestOttr account. The order freezes its price and deliverable files before opening checkout."
        >
          <form onSubmit={create} className="space-y-4">
            <fieldset
              disabled={busy || loading || !configured}
              className="space-y-4 disabled:opacity-60"
            >
              <Field label="Saved draft">
                <select
                  className="field"
                  required
                  value={form.draftId}
                  onChange={(e) => setForm((f) => ({ ...f, draftId: e.target.value }))}
                >
                  <option value="">Choose a fixed-price draft</option>
                  {drafts
                    .filter((d) => d.format === "buy_now" && d.price_cents > 0)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} · {centsToDisplay(d.price_cents)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Test buyer’s BestOttr handle">
                <input
                  className="field"
                  required
                  maxLength={32}
                  value={form.buyerHandle}
                  onChange={(e) => setForm((f) => ({ ...f, buyerHandle: e.target.value }))}
                />
              </Field>
              <Field label="Buyer’s Escrow sandbox email">
                <input
                  className="field"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                  value={form.buyerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, buyerEmail: e.target.value }))}
                />
              </Field>
              <Field label="Seller’s Escrow sandbox email">
                <input
                  className="field"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                  value={form.sellerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, sellerEmail: e.target.value }))}
                />
              </Field>
              <Field label="Inspection period">
                <select
                  className="field"
                  value={form.inspectionDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, inspectionDays: Number(e.target.value) }))
                  }
                >
                  {[1, 3, 7, 14, 30].map((d) => (
                    <option key={d} value={d}>
                      {d} {d === 1 ? "day" : "days"}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-xs text-muted-foreground">
                Use separate sandbox buyer, seller and broker accounts. Provider fees are presented
                in hosted checkout. This test does not set BestOttr’s future commission or bind a
                live sale.
              </p>
              <Button type="submit">
                {busy ? "Preparing test order…" : "Create sandbox checkout"}
              </Button>
            </fieldset>
          </form>
        </AccountPanel>
      )}
      {loading ? (
        <p role="status">Loading sandbox orders…</p>
      ) : orders.length === 0 ? (
        <AccountPanel title="No sandbox orders">
          <p className="text-sm text-muted-foreground">
            Orders will appear here when you are the selected test buyer or seller.
          </p>
        </AccountPanel>
      ) : (
        orders.map((order) => (
          <AccountPanel
            key={order.id}
            title={order.title}
            description={`${order.buyer_id === session?.user.id ? "Buying" : "Selling"} · ${centsToDisplay(order.amount_cents)} USD · ${stateLabel[order.state]}`}
          >
            <p className="text-xs text-muted-foreground">
              Reference {order.reference}
              {order.provider_id ? ` · Escrow sandbox #${order.provider_id}` : ""}
            </p>
            {order.last_error && <p className="mt-3 text-sm text-warning">{order.last_error}</p>}
            <p className="mt-3 text-sm text-muted-foreground">
              Inspection period: {order.inspection_seconds / 86400} days.{" "}
              {order.checked_at
                ? `Provider status checked ${new Date(order.checked_at).toLocaleString()}.`
                : "Payment status has not been verified."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.checkout_url &&
                order.buyer_id === session?.user.id &&
                !["completed", "cancelled", "refunded", "review"].includes(order.state) && (
                  <a
                    className={buttonVariants()}
                    href={order.checkout_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open sandbox checkout
                  </a>
                )}
              {(order.provider_id || ["creating", "creation_uncertain"].includes(order.state)) && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !configured}
                  onClick={() =>
                    void run(async () => {
                      await reconcileEscrowSandbox({ data: { token, id: order.id } });
                    })
                  }
                >
                  {order.provider_id ? "Check escrow status" : "Reconcile existing checkout"}
                </Button>
              )}
              <a
                className={buttonVariants({ variant: "outline" })}
                href="https://www.escrow-sandbox.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Escrow sandbox
              </a>
              {order.state === "preparing" && order.seller_id === session?.user.id && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setDiscardId(order.id)}
                >
                  Discard incomplete preparation
                </Button>
              )}
            </div>
            {discardId === order.id && (
              <div className="mt-3 text-sm">
                <p>Discard this preparation? No checkout was created for it.</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await discardSandboxPreparation({ data: { token, id: order.id } });
                        setDiscardId(null);
                      })
                    }
                  >
                    Discard preparation
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDiscardId(null)}
                  >
                    Keep preparation
                  </Button>
                </div>
              </div>
            )}
            {order.kind !== "file" && (
              <div className="mt-5 rounded-md border border-border p-3 text-sm">
                <p>
                  Transfer target: Roblox user {order.target_roblox_id}. This target is fixed for
                  this order.
                </p>
                <p className="mt-2 text-muted-foreground">
                  {order.ownership_checked_at
                    ? `Last ownership check: ${order.ownership_matches ? "buyer matched" : "not confirmed"}, ${new Date(order.ownership_checked_at).toLocaleString()}.`
                    : "Buyer ownership has not been confirmed."}{" "}
                  Ownership checks do not accept the goods or release escrow.
                </p>
                <Button
                  type="button"
                  className="mt-3"
                  variant="outline"
                  disabled={busy || !configured || !mayDownload(order.state)}
                  onClick={() =>
                    void run(async () => {
                      await checkSandboxOwnership({ data: { token, id: order.id } });
                    })
                  }
                >
                  Check buyer ownership
                </Button>
              </div>
            )}
            {order.files.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-medium">Order deliverables</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  A separate copy is stored for this order. Downloads require a fresh provider check
                  of secured test funds.
                </p>
                {order.files.map((file) => (
                  <div
                    key={file.id}
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm"
                  >
                    <span className="break-all">
                      {file.filename}{" "}
                      <span className="text-xs text-muted-foreground">
                        {bytesLabel(file.size_bytes)}
                      </span>
                    </span>
                    {order.buyer_id === session?.user.id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !configured || !file.ready || !mayDownload(order.state)}
                        onClick={() =>
                          void run(async () => {
                            const result = await downloadSandboxPurchase({
                              data: { token, id: order.id, fileId: file.id },
                            });
                            window.location.assign(result.url);
                          })
                        }
                      >
                        Download test purchase
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {order.events.length > 0 && (
              <ol
                aria-label="Order history"
                className="mt-5 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground"
              >
                {order.events.map((event) => (
                  <li key={event.id}>
                    {stateLabel[event.state as keyof typeof stateLabel] ?? event.state} ·{" "}
                    {new Date(event.created_at).toLocaleString()}
                  </li>
                ))}
              </ol>
            )}
          </AccountPanel>
        ))
      )}
    </>
  );
}
