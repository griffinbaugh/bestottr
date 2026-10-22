import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "./ui";
import { getPublishedListings, getPublishedListing } from "@/lib/listing-review.functions";
import type { PublicListing } from "@/lib/listing-review";
import { centsToDisplay } from "@/lib/currency";
export function PublishedCatalog({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery),
    [search, setSearch] = useState(initialQuery),
    [kind, setKind] = useState<"all" | "experience" | "community" | "file">("all"),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<PublicListing[]>([]),
    [enabled, setEnabled] = useState(false),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void getPublishedListings({ data: { q: search, kind, page } })
      .then((r) => {
        if (active) {
          setRows(r.listings);
          setEnabled(r.enabled);
          setHasMore(r.hasMore);
        }
      })
      .catch(() => {
        if (active) setError("Listings could not be loaded. Refresh to try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, kind, page]);
  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Marketplace</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Browse reviewed listings. Purchases and bidding are not open yet.
      </p>
      <form
        className="my-6 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
          setPage(0);
        }}
      >
        <input
          className="field min-w-0 flex-1"
          aria-label="Search listings"
          value={q}
          maxLength={120}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search listings"
        />
        <select
          aria-label="Listing type"
          className="field w-auto"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setPage(0);
          }}
        >
          <option value="all">All types</option>
          <option value="experience">Experiences</option>
          <option value="community">Communities</option>
          <option value="file">Files</option>
        </select>
        <Button type="submit">Search</Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <p role="status">Loading listings…</p>
      ) : !enabled ? (
        <div className="surface space-y-4 p-7">
          <h2 className="text-xl font-semibold">Public listings are opening soon</h2>
          <p className="text-sm text-muted-foreground">
            Sellers can prepare and submit listings for review while payment setup is completed.
          </p>
          <Link to="/sell" className={buttonVariants({ variant: "outline" })}>
            Prepare a listing
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No published listings match this search.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const cover = row.images.find((i) => i.cover) ?? row.images[0];
            return (
              <Link
                key={row.id}
                to="/listing/$id"
                params={{ id: row.id }}
                className="surface overflow-hidden transition-transform hover:-translate-y-0.5"
              >
                {cover && (
                  <img
                    src={cover.url}
                    alt={row.title}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="space-y-2 p-4">
                  <p className="text-xs text-muted-foreground">
                    {row.kind} · @{row.seller_handle}
                  </p>
                  <h2 className="break-words font-semibold">{row.title}</h2>
                  <p className="text-sm">{centsToDisplay(row.price_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    Reviewed listing · Checkout opens soon
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {enabled && (
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            disabled={loading || page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={loading || !hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
export function PublishedListing({ id }: { id: string }) {
  const [item, setItem] = useState<PublicListing | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setItem(null);
    setImage(null);
    setError("");
    void getPublishedListing({ data: { id } })
      .then((r) => {
        if (active) setItem(r);
      })
      .catch(() => {
        if (active) setError("The listing could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-5 py-16" role="status">
        Loading listing…
      </div>
    );
  if (!item)
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-16">
        <h1 className="text-2xl font-semibold">{error || "Listing unavailable"}</h1>
        <p className="text-sm text-muted-foreground">
          It may be private, unpublished, or waiting for marketplace launch.
        </p>
        <Link to="/browse" search={{ q: "" }} className={buttonVariants({ variant: "outline" })}>
          Back to marketplace
        </Link>
      </div>
    );
  const shown = image ?? item.images.find((i) => i.cover)?.url ?? item.images[0]?.url;
  return (
    <article className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <Link to="/browse" search={{ q: "" }} className="text-sm underline">
        Back to marketplace
      </Link>
      <p className="eyebrow">{item.kind} · reviewed listing</p>
      <h1 className="break-words text-3xl font-semibold tracking-tight">{item.title}</h1>
      <p className="text-sm text-muted-foreground">Listed by @{item.seller_handle}</p>
      {shown && (
        <img src={shown} alt={item.title} className="aspect-video w-full rounded-lg object-cover" />
      )}
      <div className="flex gap-3 overflow-x-auto">
        {item.images.map((i) => (
          <button
            key={i.id}
            type="button"
            aria-label="View listing image"
            onClick={() => setImage(i.url)}
          >
            <img src={i.url} alt="" className="h-20 w-28 rounded-md object-cover" />
          </button>
        ))}
      </div>
      <p className="text-2xl font-semibold">{centsToDisplay(item.price_cents)}</p>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.description}</p>
      {item.roblox_url && (
        <a
          href={item.roblox_url}
          className="inline-block text-sm underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Roblox asset
        </a>
      )}
      {item.ownership_checked_at && (
        <p className="text-xs text-muted-foreground">
          Roblox ownership checked {new Date(item.ownership_checked_at).toLocaleString()}. Ownership
          can change after a check.
        </p>
      )}
      {item.file_count > 0 && (
        <p className="text-sm">
          Includes {item.file_count} private deliverable {item.file_count === 1 ? "file" : "files"}.
          Downloads are not publicly available.
        </p>
      )}
      <div className="surface space-y-3 p-5">
        <h2 className="font-semibold">Checkout opens soon</h2>
        <p className="text-sm text-muted-foreground">
          This listing is available to view. Purchases, bids and payment collection are not enabled.
        </p>
        <Button disabled>Purchasing unavailable</Button>
      </div>
    </article>
  );
}
