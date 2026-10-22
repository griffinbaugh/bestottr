import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "./AuthProvider";
import { Message } from "./AccountLayout";
import { ReviewedContent } from "./ListingReviewPanel";
import { Button, buttonVariants } from "@/components/sb/ui";
import {
  getAdminReviews,
  getReviewDetails,
  actOnListingReview,
} from "@/lib/listing-review.functions";
import {
  REVIEW_STATES,
  reviewLabel,
  type ReviewState,
  type ReviewDetails,
  type ReviewSummary,
  type ReviewAction,
} from "@/lib/listing-review";
export function ListingReviewAdmin() {
  const { session } = useAuth(),
    token = session?.access_token;
  const [state, setState] = useState<ReviewState>("in_review"),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<ReviewSummary[]>([]),
    [hasMore, setHasMore] = useState(false),
    [enabled, setEnabled] = useState(false),
    [selected, setSelected] = useState<ReviewDetails | null>(null),
    [note, setNote] = useState(""),
    [confirm, setConfirm] = useState<ReviewAction | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function refresh() {
    if (!token) return;
    const r = await getAdminReviews({ data: { token, state, page } });
    setRows(r.reviews);
    setEnabled(r.publicationEnabled);
    setHasMore(r.hasMore);
  }
  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoading(true);
    setSelected(null);
    setConfirm(null);
    void getAdminReviews({ data: { token, state, page } })
      .then((r) => {
        if (active) {
          setRows(r.reviews);
          setEnabled(r.publicationEnabled);
          setHasMore(r.hasMore);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Review queue unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, state, page]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action unavailable.");
    } finally {
      setBusy(false);
    }
  }
  if (!token) return null;
  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Moderation</p>
          <h1 className="text-3xl font-semibold tracking-tight">Listing review</h1>
        </div>
        <Link to="/admin/support" className={buttonVariants({ variant: "outline" })}>
          Support queue
        </Link>
      </div>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        Review the submitted version and its private attachments. Approval and public publication
        are separate actions. Checkout, bids and buyer delivery are not enabled by approval.
      </p>
      {!enabled && (
        <p className="mt-5 rounded-md border border-warning/30 p-4 text-sm">
          Public publication is disabled while marketplace setup is completed. You can review and
          approve submissions now; approved versions stay private.
        </p>
      )}
      <div className="my-5 flex flex-wrap gap-3">
        <label className="text-sm">
          Status{" "}
          <select
            value={state}
            disabled={busy}
            className="field ml-2 w-auto"
            onChange={(e) => {
              setState(e.target.value as ReviewState);
              setPage(0);
            }}
          >
            {REVIEW_STATES.map((s) => (
              <option value={s} key={s}>
                {reviewLabel[s]}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" disabled={busy} onClick={() => void run(refresh)}>
          Refresh queue
        </Button>
      </div>
      <Message error={error} success={success} />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-3">
          {loading ? (
            <p role="status">Loading reviews…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No listings with this status.</p>
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={busy}
                className="surface w-full p-4 text-left transition-colors hover:bg-secondary/30"
                onClick={() =>
                  void run(async () => {
                    setSelected(await getReviewDetails({ data: { token, id: row.id } }));
                    setNote("");
                    setConfirm(null);
                  })
                }
              >
                <strong className="block break-words">{row.title}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {row.kind} · {new Date(row.created_at).toLocaleString()}
                </span>
              </button>
            ))
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </aside>
        <section className="surface min-w-0 space-y-5 p-5">
          {selected ? (
            <>
              <h2 className="break-words text-xl font-semibold">{selected.review.title}</h2>
              <p className="text-sm">
                {reviewLabel[selected.review.state]} · version {selected.review.version}
              </p>
              <ReviewedContent details={selected} token={token} />
              {selected.review.decision_note && (
                <p className="text-sm">Previous feedback: {selected.review.decision_note}</p>
              )}
              <label className="block text-sm font-medium">
                Feedback for the seller
                <textarea
                  className="field mt-2 min-h-24"
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Required when requesting changes or unpublishing; at least 10 characters."
                />
              </label>
              <div className="flex flex-wrap gap-3">
                {selected.review.state === "in_review" && (
                  <>
                    <Button disabled={busy} onClick={() => setConfirm("approve")}>
                      Approve version
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || note.trim().length < 10}
                      onClick={() => setConfirm("reject")}
                    >
                      Request changes
                    </Button>
                  </>
                )}
                {selected.review.state === "approved" && (
                  <Button
                    disabled={busy || !enabled || selected.review.format === "auction"}
                    onClick={() => setConfirm("publish")}
                  >
                    Publish listing
                  </Button>
                )}
                {selected.review.state === "published" && (
                  <>
                    <Link
                      to="/listing/$id"
                      params={{ id: selected.review.id }}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      View public listing
                    </Link>
                    <Button
                      variant="outline"
                      disabled={busy || note.trim().length < 10}
                      onClick={() => setConfirm("unpublish")}
                    >
                      Unpublish listing
                    </Button>
                  </>
                )}
              </div>
              {selected.review.state === "approved" && selected.review.format === "auction" && (
                <p className="text-sm text-muted-foreground">
                  This auction can be reviewed, but publication stays closed until real bidding is
                  available. An expired closing time must be updated in a new submission.
                </p>
              )}
              {confirm && (
                <div className="space-y-3 rounded-md border border-border p-4">
                  <p className="text-sm">
                    {confirm === "approve"
                      ? "Approve only this frozen version? It will remain private until separately published."
                      : confirm === "publish"
                        ? "Make this reviewed version public? Roblox ownership will be checked again. Purchases remain unavailable."
                        : confirm === "reject"
                          ? "Return this version to the seller with your feedback? They must submit a new version after editing."
                          : "Remove this listing from public view? Existing review history will remain."}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await actOnListingReview({
                            data: {
                              token,
                              id: selected.review.id,
                              version: selected.review.version,
                              action: confirm,
                              note,
                            },
                          });
                          setSelected(
                            await getReviewDetails({ data: { token, id: selected.review.id } }),
                          );
                          setConfirm(null);
                          setNote("");
                          setSuccess("Review status updated.");
                        })
                      }
                    >
                      Confirm {confirm}
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a submission to inspect its frozen details, images and files.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
