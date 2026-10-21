import { useEffect, useState, type FormEvent } from "react";
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
  const [draft, setDraft] = useState(empty);
  const [drafts, setDrafts] = useState<ListingDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const up = (patch: Partial<DraftInput>) => setDraft((d) => ({ ...d, ...patch }));
  const token = session?.access_token;
  useEffect(() => {
    let active = true;
    setError("");
    setSuccess("");
    setLoading(true);
    if (!token || !session?.user.email_confirmed_at) {
      setLoading(false);
      return;
    }
    void getListingDrafts({ data: { token } })
      .then((rows) => {
        if (active) setDrafts(rows);
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
    setDraft({
      id: row.id,
      kind: row.kind,
      url:
        row.kind === "experience"
          ? `https://www.roblox.com/games/${row.place_id}`
          : `https://www.roblox.com/communities/${row.asset_id}`,
      title: row.title,
      description: row.description,
      format: row.format,
      priceCents: row.price_cents,
      reserveCents: row.reserve_cents,
    });
    setSuccess("");
    setError("");
    setDeleteId(null);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    setError("");
    setSuccess("");
    const parsed = draftFields.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the listing details.");
      return;
    }
    setBusy(true);
    try {
      const result = await saveListingDraft({ data: { token, draft: parsed.data } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      up({ id: result.id });
      setSuccess("Draft saved. It is private and is not listed for sale.");
      setDrafts(await getListingDrafts({ data: { token } }));
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
        Save a private draft for an experience or community you own. Ownership is checked with
        Roblox each time you save. Public listings and transactions will open when checkout is
        ready.
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
            <form className="surface space-y-5 p-5 md:p-6" onSubmit={save}>
              <h2 className="text-lg font-semibold">{draft.id ? "Edit draft" : "New draft"}</h2>
              <Message error={error} success={success} />
              <fieldset
                disabled={busy || !roblox || loading}
                className="space-y-5 disabled:opacity-60"
              >
                <Field label="Listing type">
                  <select
                    className="field"
                    value={draft.kind}
                    onChange={(e) => up({ kind: e.target.value as DraftInput["kind"], url: "" })}
                  >
                    <option value="experience">Experience</option>
                    <option value="community">Community</option>
                  </select>
                </Field>
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
                    <p className="text-xs text-muted-foreground">
                      Auction end dates will be set before publication. Saving a draft does not
                      start an auction.
                    </p>
                  </>
                )}
                <Button type="submit" className="w-full">
                  {busy ? "Checking ownership and saving…" : "Verify ownership & save draft"}
                </Button>
              </fieldset>
              {draft.id && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setDraft(empty());
                    setSuccess("");
                    setError("");
                  }}
                >
                  Start another draft
                </Button>
              )}
            </form>
            <aside className="space-y-4">
              <h2 className="text-lg font-semibold">Your drafts</h2>
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
                      Private draft · {row.kind === "experience" ? "Experience" : "Community"}
                    </p>
                    <p className="mt-2 text-sm">
                      {centsToDisplay(row.price_cents)}{" "}
                      {row.format === "auction" ? "starting bid" : "asking price"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ownership last checked {new Date(row.ownership_checked_at).toLocaleString()}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => edit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
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
                Files and instant delivery are being prepared separately. Drafts do not accept bids
                or payments.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
