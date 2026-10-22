import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/sb/ui";
import { Message } from "./AccountLayout";
import {
  getReviewDetails,
  submitListingReview,
  actOnListingReview,
  downloadReviewFile,
} from "@/lib/listing-review.functions";
import {
  reviewLabel,
  reviewLocked,
  type ReviewSummary,
  type ReviewDetails,
} from "@/lib/listing-review";
import type { ListingDraft } from "@/lib/listing-drafts";
import { centsToDisplay } from "@/lib/currency";
import { bytesLabel } from "@/lib/listing-assets";
export function ReviewedContent({ details, token }: { details: ReviewDetails; token: string }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function download(fileId: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await downloadReviewFile({ data: { token, reviewId: details.review.id, fileId } });
      window.location.assign(r.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm">
        @{details.seller_handle} · {centsToDisplay(details.review.price_cents)}{" "}
        {details.review.format === "auction" ? "starting bid" : "asking price"}
      </p>
      <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
        {details.description}
      </p>
      {details.roblox_url && (
        <a
          className="text-sm underline"
          href={details.roblox_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Roblox asset
        </a>
      )}
      {details.ownership_checked_at && (
        <p className="text-xs text-muted-foreground">
          Ownership checked {new Date(details.ownership_checked_at).toLocaleString()}. This records
          a check, not perpetual ownership.
        </p>
      )}
      {details.auction_ends_at && (
        <p className="text-sm">
          Planned auction end: {new Date(details.auction_ends_at).toLocaleString()}
        </p>
      )}
      {details.reserve_cents !== null && (
        <p className="text-sm">Reserve {centsToDisplay(details.reserve_cents)}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {details.images.map((image) => (
          <figure key={image.id}>
            <img
              src={image.url}
              alt={details.review.title}
              className="aspect-video w-full rounded-md object-cover"
            />
            {image.cover && (
              <figcaption className="mt-1 text-xs text-muted-foreground">Cover image</figcaption>
            )}
          </figure>
        ))}
      </div>
      {details.files.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            Private review attachments. Files have not been malware-scanned. Only open files you can
            inspect safely.
          </p>
          <ul className="space-y-2">
            {details.files.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">
                  {file.filename} · {bytesLabel(file.size_bytes)}
                </span>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void download(file.id)}
                >
                  Download for review
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Message error={error} />
      <details>
        <summary className="cursor-pointer text-sm">Review history</summary>
        <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
          {details.events.map((event) => (
            <li key={event.id}>
              {new Date(event.created_at).toLocaleString()} — {event.action}
              {event.note ? `: ${event.note}` : ""}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
export function ListingReviewPanel({
  token,
  draft,
  review,
  onChanged,
}: {
  token: string;
  draft: ListingDraft;
  review?: ReviewSummary | undefined;
  onChanged: () => Promise<void>;
}) {
  const [rights, setRights] = useState(false),
    [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [details, setDetails] = useState<ReviewDetails | null>(null),
    [confirm, setConfirm] = useState<"submit" | "withdraw" | "unpublish" | null>(null);
  useEffect(() => {
    setDetails(null);
    setConfirm(null);
    if (review?.id === requestId && ["failed", "withdrawn"].includes(review.state))
      setRequestId(crypto.randomUUID());
  }, [review?.id, review?.version, review?.state, requestId]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await onChanged();
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review action failed.");
    } finally {
      setBusy(false);
    }
  }
  const locked = reviewLocked(review?.state);
  return (
    <section className="surface space-y-4 p-5">
      <h2 className="text-lg font-semibold">Listing review</h2>
      <p className="text-sm">
        {review ? reviewLabel[review.state] : "Private draft — not submitted"}
      </p>
      {review?.decision_note && (
        <p className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
          Moderator feedback: {review.decision_note}
        </p>
      )}
      <Message error={error} />
      <Button variant="outline" disabled={busy} onClick={() => void run(async () => {})}>
        Refresh review status
      </Button>
      {locked ? (
        <p className="text-sm text-muted-foreground">
          This version is frozen. {review?.state === "published" ? "Unpublish" : "Withdraw"} before
          editing its details or attachments. Changes need a new review.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Submit the saved version of “{draft.title}”. Save any edits and finish uploads first. An
            image, description and positive price are required.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={rights}
              onChange={(e) => setRights(e.target.checked)}
              className="mt-1"
            />
            I own this asset or have the rights to sell all included work, and the listing
            accurately describes what the buyer will receive.
          </label>
          <Button disabled={busy || !rights} onClick={() => setConfirm("submit")}>
            Submit saved listing for review
          </Button>
        </>
      )}
      {review && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setDetails(await getReviewDetails({ data: { token, id: review.id } }));
              })
            }
          >
            View submitted version
          </Button>
          {["preparing", "in_review", "approved"].includes(review.state) && (
            <Button variant="outline" disabled={busy} onClick={() => setConfirm("withdraw")}>
              Withdraw to edit
            </Button>
          )}
          {review.state === "published" && (
            <>
              <Link
                className="inline-flex items-center text-sm underline"
                to="/listing/$id"
                params={{ id: review.id }}
              >
                View public listing
              </Link>
              <Button variant="outline" disabled={busy} onClick={() => setConfirm("unpublish")}>
                Unpublish listing
              </Button>
            </>
          )}
          {review.state === "approved" && (
            <p className="text-xs text-muted-foreground">
              Approval does not make this listing public. Publication remains under moderator and
              launch controls.
            </p>
          )}
        </div>
      )}
      {confirm && (
        <div
          className="space-y-3 rounded-md border border-border p-4"
          role="group"
          aria-label="Confirm listing review action"
        >
          <p className="text-sm">
            {confirm === "submit"
              ? "Submit this saved version and freeze its details and files for moderation?"
              : confirm === "withdraw"
                ? "Withdraw this version from review? Any approval will no longer authorize publication."
                : "Hide this listing from the marketplace? It will need a new review before publication again."}
          </p>
          <div className="flex gap-3">
            <Button
              disabled={busy || (confirm === "submit" && !rights)}
              onClick={() =>
                void run(async () => {
                  if (confirm === "submit") {
                    await submitListingReview({
                      data: {
                        token,
                        draftId: draft.id,
                        reviewId: requestId,
                        expectedUpdatedAt: draft.updated_at,
                        confirmRights: true,
                      },
                    });
                    setRequestId(crypto.randomUUID());
                    setRights(false);
                  } else if (review)
                    await actOnListingReview({
                      data: {
                        token,
                        id: review.id,
                        version: review.version,
                        action: confirm,
                        note:
                          confirm === "unpublish"
                            ? "Seller requested removal from the public marketplace."
                            : "",
                      },
                    });
                })
              }
            >
              Confirm {confirm === "submit" ? "submission" : confirm}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {details && <ReviewedContent details={details} token={token} />}
    </section>
  );
}
