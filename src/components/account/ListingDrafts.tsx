import { useEffect, useState, type FormEvent } from "react";
import { DraftMedia } from "./DraftMedia";
import { ListingReviewPanel } from "./ListingReviewPanel";
import { getSellerReviews } from "@/lib/listing-review.functions";
import { reviewLabel, reviewLocked, type ReviewSummary } from "@/lib/listing-review";
import {
  defaultEndLocal,
  toLocalInputValue,
  validateAuctionEnd,
  localTimezone,
  formatAuctionEnd,
} from "@/lib/auction-end";
import { Link } from "@tanstack/react-router";
import { useAuth } from "./AuthProvider";
import { RequireAccount, Field, Message } from "./AccountLayout";
import { Button, buttonVariants } from "@/components/sb/ui";
import { CurrencyInput } from "@/components/sb/CurrencyInput";
import { centsToDisplay } from "@/lib/currency";
import { draftFields, type DraftInput, type ListingDraft } from "@/lib/listing-drafts";
import {
  getListingDrafts,
  saveListingDraft,
  deleteListingDraft,
} from "@/lib/listing-drafts.functions";

const empty = (): DraftInput => ({
  kind: "experience",
  url: "",
  title: "",
  description: "",
  format: "buy_now",
  priceCents: 0,
  reserveCents: null,
  auctionEndsAt: null,
});
export function ListingDrafts() {
  const { session } = useAuth();
  return (
    <RequireAccount>
      <DraftEditor key={session?.user.id} />
    </RequireAccount>
  );
}
function DraftEditor() {
  const { session, roblox } = useAuth();
  const cooldownKey = `bestottr-listing-retry:${session?.user.id}`;
  const [draft, setDraft] = useState(empty);
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coverId, setCoverId] = useState<string | null>(null);
  const [endLocal, setEndLocal] = useState("");
  const [endMode, setEndMode] = useState<"duration" | "datetime">("datetime");
  const [durationDays, setDurationDays] = useState(7);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(() => {
    try {
      const stored = Number(sessionStorage.getItem(cooldownKey));
      return Number.isFinite(stored) && stored > Date.now() ? stored : 0;
    } catch {
      return 0;
    }
  });
  const [retryIn, setRetryIn] = useState(0);
  const up = (patch: Partial<DraftInput>) => setDraft((d) => ({ ...d, ...patch }));
  const token = session?.access_token;
  const currentReview = reviews.find((r) => r.draft_id === draft.id);
  const locked = reviewLocked(currentReview?.state);
  const savedDraft = drafts.find((r) => r.id === draft.id);
  async function refreshSaved() {
    if (!token) return;
    const [rows, statuses] = await Promise.all([
      getListingDrafts({ data: { token } }),
      getSellerReviews({ data: { token } }),
    ]);
    setDrafts(rows);
    setReviews(statuses);
  }
  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setRetryIn(remaining);
      if (!remaining) setRetryAt(0);
    };
    tick();
    if (retryAt <= Date.now()) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    let active = true;
    setError("");
    setSuccess("");
    setLoading(true);
    if (!token || !session?.user.email_confirmed_at) {
      setLoading(false);
      return;
    }
    void Promise.all([getListingDrafts({ data: { token } }), getSellerReviews({ data: { token } })])
      .then(([rows, statuses]) => {
        if (active) {
          setDrafts(rows);
          setReviews(statuses);
        }
      })
      .catch(() => {
        if (active) setError("Your drafts could not be loaded. Refresh to try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, session?.user.email_confirmed_at]);
  function edit(row: ListingDraft) {
    setCoverId(row.cover_asset_id);
    setEndLocal(row.auction_ends_at ? toLocalInputValue(row.auction_ends_at) : "");
    setEndMode("datetime");
    setDraft({
      id: row.id,
      kind: row.kind,
      url:
        row.kind === "file"
          ? ""
          : row.kind === "experience"
            ? `https://www.roblox.com/games/${row.place_id}`
            : `https://www.roblox.com/communities/${row.asset_id}`,
      title: row.title,
      description: row.description,
      format: row.format,
      priceCents: row.price_cents,
      reserveCents: row.reserve_cents,
      auctionEndsAt: row.auction_ends_at,
    });
    setSuccess("");
    setError("");
    setDeleteId(null);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || busy || locked || (draft.kind !== "file" && retryAt > Date.now())) return;
    setError("");
    setSuccess("");
    let toSave = draft;
    if (draft.format === "auction") {
      if (endMode === "datetime" && !endLocal) {
        setError("Choose when the auction should end.");
        return;
      }
      const end = validateAuctionEnd(endMode, durationDays, endLocal);
      if (!end.ok) {
        setError(end.error ?? "Choose a future auction end.");
        return;
      }
      toSave = { ...draft, auctionEndsAt: end.endsAt };
    }
    const parsed = draftFields.safeParse(toSave);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the listing details.");
      return;
    }
    setBusy(true);
    try {
      const result = await saveListingDraft({ data: { token, draft: parsed.data } });
      if (!result.ok) {
        setError(result.error);
        if ("retryAfterSeconds" in result && result.retryAfterSeconds > 0) {
          const until = Date.now() + result.retryAfterSeconds * 1000;
          setRetryAt(until);
          try {
            sessionStorage.setItem(cooldownKey, String(until));
          } catch {
            /* Optional persistence. */
          }
        }
        return;
      }
      up({ id: result.id, auctionEndsAt: parsed.data.auctionEndsAt });
      setSuccess("Draft saved. It is private and is not listed for sale.");
      await refreshSaved();
    } catch {
      setError(
        "Your request could not be completed. Refresh your session and try again. If a save already completed, your draft will appear below.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await deleteListingDraft({ data: { token, id } });
      setDrafts((rows) => rows.filter((row) => row.id !== id));
      if (draft.id === id) setDraft(empty());
      setCoverId(null);
      setEndLocal("");
      setDeleteId(null);
      setSuccess("Draft deleted.");
    } catch {
      setError("Your draft could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="eyebrow mb-3">Selling on bestottr</p>
      <h1 className="text-3xl font-semibold tracking-tight">Prepare your listing</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Prepare an experience, community or downloadable file listing. Roblox ownership is verified
        before saving an experience or community. Submit a completed saved version for review.
        Approval is separate from public publication; checkout remains closed.
      </p>
      {!session?.user.email_confirmed_at ? (
        <div className="mt-8">
          <p>Confirm your email before preparing a listing.</p>
          <Link to="/verify-email" className={buttonVariants({ className: "mt-4" })}>
            Verify email
          </Link>
        </div>
      ) : (
        <>
          {!roblox && (
            <div className="surface mt-8 p-5">
              <p>Connect Roblox to verify which experiences and communities you own.</p>
              <Link to="/account/connections" className={buttonVariants({ className: "mt-4" })}>
                Connect Roblox
              </Link>
            </div>
          )}
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-6">
              <form className="surface space-y-5 p-5 md:p-6" onSubmit={save}>
                <h2 className="text-lg font-semibold">{draft.id ? "Edit draft" : "New draft"}</h2>
                <Message error={error} success={success} />
                <fieldset
                  disabled={busy || loading || locked}
                  className="space-y-5 disabled:opacity-60"
                >
                  <Field label="Listing type">
                    <select
                      className="field"
                      disabled={!!draft.id}
                      value={draft.kind}
                      onChange={(e) => up({ kind: e.target.value as DraftInput["kind"], url: "" })}
                    >
                      <option value="experience">Experience</option>
                      <option value="community">Community</option>
                      <option value="file">Downloadable files</option>
                    </select>
                  </Field>
                  {draft.kind !== "file" && (
                    <Field
                      label="Roblox link"
                      hint="Use the public game or community page link. Group-owned games require you to own the group."
                    >
                      <input
                        className="field"
                        type="url"
                        required
                        maxLength={500}
                        value={draft.url}
                        onChange={(e) => up({ url: e.target.value })}
                        placeholder={
                          draft.kind === "experience"
                            ? "https://www.roblox.com/games/…"
                            : "https://www.roblox.com/communities/…"
                        }
                      />
                    </Field>
                  )}
                  <Field label="Listing title">
                    <input
                      className="field"
                      required
                      minLength={3}
                      maxLength={120}
                      value={draft.title}
                      onChange={(e) => up({ title: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Description"
                    hint="Describe what is included, the current condition and any known risks."
                  >
                    <textarea
                      className="field min-h-40"
                      maxLength={10000}
                      value={draft.description}
                      onChange={(e) => up({ description: e.target.value })}
                    />
                  </Field>
                  <Field label="Planned sale format">
                    <select
                      className="field"
                      value={draft.format}
                      onChange={(e) =>
                        up({ format: e.target.value as DraftInput["format"], reserveCents: null })
                      }
                    >
                      <option value="buy_now">Fixed price</option>
                      <option value="auction">Auction</option>
                    </select>
                  </Field>
                  <Field
                    label={draft.format === "auction" ? "Starting bid (USD)" : "Asking price (USD)"}
                    hint="You can leave the price at zero while drafting."
                  >
                    <CurrencyInput
                      valueCents={draft.priceCents}
                      onChange={(priceCents) => up({ priceCents })}
                    />
                  </Field>
                  {draft.format === "auction" && (
                    <>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.reserveCents !== null}
                          onChange={(e) =>
                            up({ reserveCents: e.target.checked ? draft.priceCents : null })
                          }
                        />
                        Set a reserve price
                      </label>
                      {draft.reserveCents !== null && (
                        <Field label="Reserve price (USD)">
                          <CurrencyInput
                            valueCents={draft.reserveCents}
                            onChange={(reserveCents) => up({ reserveCents })}
                          />
                        </Field>
                      )}
                      <Field label="Auction end">
                        <select
                          className="field"
                          value={endMode}
                          onChange={(e) => setEndMode(e.target.value as "duration" | "datetime")}
                        >
                          <option value="datetime">Exact date and time</option>
                          <option value="duration">Days from saving</option>
                        </select>
                      </Field>
                      {endMode === "duration" ? (
                        <Field label="Duration">
                          <select
                            className="field"
                            value={durationDays}
                            onChange={(e) => setDurationDays(Number(e.target.value))}
                          >
                            {[1, 3, 7, 14, 30].map((n) => (
                              <option value={n} key={n}>
                                {n} {n === 1 ? "day" : "days"}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <Field label={`Closing date and time (${localTimezone()})`}>
                          <input
                            className="field"
                            type="datetime-local"
                            required
                            value={endLocal}
                            onChange={(e) => {
                              setEndLocal(e.target.value);
                              const end = validateAuctionEnd("datetime", 7, e.target.value);
                              up({ auctionEndsAt: end.endsAt });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const value = defaultEndLocal();
                              setEndLocal(value);
                              up({
                                auctionEndsAt: validateAuctionEnd("datetime", 7, value).endsAt,
                              });
                            }}
                          >
                            One week from now
                          </Button>
                        </Field>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Dates are saved in your local timezone. Saving a draft does not start an
                        auction. A past date must be updated before saving or publishing.
                      </p>
                    </>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={draft.kind !== "file" && (retryIn > 0 || !roblox)}
                  >
                    {busy
                      ? "Checking ownership and saving…"
                      : draft.kind !== "file" && retryIn > 0
                        ? `Try again in ${retryIn}s`
                        : draft.kind === "file"
                          ? "Save file draft"
                          : "Verify ownership & save draft"}
                  </Button>
                  {draft.kind !== "file" && retryIn > 0 && (
                    <p role="status" className="text-xs text-muted-foreground">
                      This save hasn’t completed. You can keep editing while waiting.
                    </p>
                  )}
                </fieldset>
                {draft.id && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setDraft(empty());
                      setCoverId(null);
                      setEndLocal("");
                      setSuccess("");
                      setError("");
                    }}
                  >
                    Start another draft
                  </Button>
                )}
              </form>
              {savedDraft && token && (
                <ListingReviewPanel
                  key={savedDraft.id}
                  token={token}
                  draft={savedDraft}
                  review={currentReview}
                  onChanged={refreshSaved}
                />
              )}
              {draft.id && token ? (
                <DraftMedia
                  key={draft.id}
                  token={token}
                  readOnly={locked}
                  onMutation={refreshSaved}
                  draft={{ ...draft, id: draft.id }}
                  coverId={coverId}
                  onCoverChange={(id) => {
                    setCoverId(id);
                    setDrafts((rows) =>
                      rows.map((r) => (r.id === draft.id ? { ...r, cover_asset_id: id } : r)),
                    );
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Save your draft first, then add images and deliverable files.
                </p>
              )}
            </div>
            <aside className="space-y-4">
              <h2 className="text-lg font-semibold">Your listings</h2>
              {loading ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading drafts…
                </p>
              ) : drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your saved drafts will appear here.</p>
              ) : (
                drafts.map((row) => (
                  <section key={row.id} className="surface p-4">
                    <h3 className="break-words font-medium">{row.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reviews.find((r) => r.draft_id === row.id)
                        ? reviewLabel[reviews.find((r) => r.draft_id === row.id)!.state]
                        : "Private draft"}{" "}
                      ·{" "}
                      {row.kind === "experience"
                        ? "Experience"
                        : row.kind === "community"
                          ? "Community"
                          : "Files"}
                    </p>
                    <p className="mt-2 text-sm">
                      {centsToDisplay(row.price_cents)}{" "}
                      {row.format === "auction" ? "starting bid" : "asking price"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.ownership_checked_at
                        ? `Ownership last checked ${new Date(row.ownership_checked_at).toLocaleString()}`
                        : "File listing · seller-provided content"}
                      {row.auction_ends_at && (
                        <span className="mt-1 block">
                          Planned end {formatAuctionEnd(row.auction_ends_at)}
                        </span>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => edit(row)}
                      >
                        {reviewLocked(reviews.find((r) => r.draft_id === row.id)?.state)
                          ? "View version"
                          : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={
                          busy || reviewLocked(reviews.find((r) => r.draft_id === row.id)?.state)
                        }
                        onClick={() => setDeleteId(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                    {deleteId === row.id && (
                      <div className="mt-3 text-sm">
                        <p>Delete this draft permanently?</p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" disabled={busy} onClick={() => void remove(row.id)}>
                            Delete draft
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setDeleteId(null)}
                          >
                            Keep draft
                          </Button>
                        </div>
                      </div>
                    )}
                  </section>
                ))
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Images and deliverables stay private. Public listings, bids and checkout will open
                after payment setup.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
