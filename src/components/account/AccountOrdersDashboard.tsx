import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "./AuthProvider";
import { RequireAccount, Message } from "./AccountLayout";
import { Button, buttonVariants } from "@/components/sb/ui";
import { getAccountOrders, type AccountOrderSummary } from "@/lib/account-orders.functions";
import { getListingDrafts } from "@/lib/listing-drafts.functions";
import { getSellerReviews } from "@/lib/listing-review.functions";
import { reviewLabel, type ReviewSummary } from "@/lib/listing-review";
import { stateLabel, formatSandboxMoney } from "@/lib/trustap-sandbox";
import type { ListingDraft } from "@/lib/listing-drafts";
export function AccountOrdersDashboard({ side }: { side: "buying" | "selling" }) {
  const { session } = useAuth();
  return (
    <RequireAccount>
      <Dashboard key={(session?.user.id ?? "") + side} side={side} />
    </RequireAccount>
  );
}
function Dashboard({ side }: { side: "buying" | "selling" }) {
  const { session } = useAuth(),
    token = session?.access_token;
  const [orders, setOrders] = useState<AccountOrderSummary[]>([]),
    [drafts, setDrafts] = useState<ListingDraft[]>([]),
    [reviews, setReviews] = useState<ReviewSummary[]>([]),
    [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setOrders([]);
    setHasMore(false);
    if (!token) {
      setLoading(false);
      return;
    }
    void Promise.all([
      getAccountOrders({ data: { token, side, page } }),
      side === "selling" ? getListingDrafts({ data: { token } }) : Promise.resolve([]),
      side === "selling" ? getSellerReviews({ data: { token } }) : Promise.resolve([]),
    ])
      .then(([r, d, v]) => {
        if (active) {
          setOrders(r.orders);
          setHasMore(r.hasMore);
          setDrafts(d);
          setReviews(v);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Your activity could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, side, page, refresh]);
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{side === "buying" ? "Buying" : "Selling"}</h1>
        <div className="flex gap-3">
          <Link className={buttonVariants({ variant: "outline" })} to="/account/payments">
            Payment setup
          </Link>
          <Link
            className={buttonVariants()}
            to={side === "buying" ? "/browse" : "/sell"}
            search={side === "buying" ? { q: "" } : {}}
          >
            {side === "buying" ? "Browse listings" : "Manage listings"}
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Live checkout and bidding are not open yet. Orders shown here are Trustap sandbox tests and
        do not represent real payments or revenue.
      </p>
      <Button variant="outline" disabled={loading} onClick={() => setRefresh((r) => r + 1)}>
        Refresh activity
      </Button>
      <Message error={error} />
      {loading ? (
        <p role="status">Loading your activity…</p>
      ) : error ? null : (
        <>
          {side === "selling" && (
            <section className="surface space-y-4 p-5">
              <h2 className="text-xl font-semibold">Your listings</h2>
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved listings yet. Start one in Sell.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {drafts.map((d) => {
                    const review = reviews.find((r) => r.draft_id === d.id);
                    return (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-4"
                      >
                        <div className="min-w-0">
                          <h3 className="break-words font-medium">{d.title}</h3>
                          <p className="mt-1 text-sm">
                            {review ? reviewLabel[review.state] : "Private draft"} ·{" "}
                            {formatSandboxMoney(d.price_cents)}
                            {d.format === "auction" ? " starting bid" : " asking price"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {d.kind === "file"
                              ? "Downloadable project"
                              : "Roblox ownership transfer"}
                          </p>
                          {review?.decision_note && (
                            <p className="mt-2 break-words text-sm">
                              Feedback: {review.decision_note}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <Link to="/sell" className="text-sm underline">
                            Manage in Sell
                          </Link>
                          {review?.state === "published" && (
                            <Link
                              to="/listing/$id"
                              params={{ id: review.id }}
                              className="text-sm underline"
                            >
                              View listing
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
          <section className="surface space-y-4 p-5">
            <h2 className="text-xl font-semibold">
              {side === "buying" ? "Your test purchases" : "Your test sales"}
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {page === 0
                  ? "No test orders yet. Once Trustap access is configured, your test purchases and sales will appear here."
                  : "No orders on this page."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {orders.map((o) => (
                  <li key={o.id} className="py-4">
                    <Link
                      to="/deal/$id"
                      params={{ id: o.id }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md py-2 hover:bg-secondary/30"
                    >
                      <div className="min-w-0">
                        <h3 className="break-words font-medium">{o.title}</h3>
                        <p className="mt-1 text-sm">{stateLabel[o.state]}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {o.kind === "file" ? "Downloadable project" : "Roblox ownership transfer"}{" "}
                          · {new Date(o.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p>
                          {side === "buying" ? "Test buyer total " : "Test seller proceeds "}
                          {formatSandboxMoney(
                            side === "buying"
                              ? o.amount_cents + o.fees_buyer
                              : o.amount_cents - o.fees_seller,
                          )}
                        </p>
                        <span className="mt-1 block underline">Open private order</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-3">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs">Page {page + 1}</span>
              <Button variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
