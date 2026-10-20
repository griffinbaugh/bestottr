import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge, Empty, PageHeader, Stat, buttonVariants } from "@/components/sb/ui";
import { ME } from "@/lib/data";
import { dealStatus, isDealCompleted, isFundsProtected } from "@/lib/deal-status";
import { usd } from "@/lib/format";
import { stockLabel } from "@/lib/inventory";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller dashboard — bestottr" },
      { name: "description", content: "Manage listings, bids, sales and transfers." },
      { property: "og:title", content: "Seller dashboard — bestottr" },
      { property: "og:description", content: "Manage your bestottr listings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Seller,
});

function Seller() {
  const s = useAppState();
  const mine = s.listings.filter((l) => l.seller.handle === ME);
  const active = mine.filter((l) => l.status === "live" || l.status === "review");
  const sold = mine.filter((l) => l.status === "sold" || l.status === "ended");
  const deals = s.deals.filter((d) => d.seller === ME);
  const bids = active.flatMap((l) => l.bids.map((b) => ({ ...b, title: l.title })));
  const closed = deals.filter((d) => d.kind !== "file" && isDealCompleted(d)).reduce((a, d) => a + d.price, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6">
      <PageHeader title="Selling" subtitle="Your listings and transactions" actions={<Link to="/sell" className={buttonVariants()}>New listing</Link>} />
      <div className="surface grid grid-cols-2 gap-5 p-5 md:grid-cols-4">
        <Stat label="Active listings" value={active.length} />
        <Stat label="Bids received" value={bids.length} />
        <Stat label="Funds protected" value={usd(deals.filter(isFundsProtected).reduce((a, d) => a + d.price, 0))} />
        <Stat label="Closed revenue" value={usd(closed)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="mb-3 font-semibold">Active listings</h2>
          {active.length ? active.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-2 border-t border-border py-3 first:border-0"><Link to="/listing/$id" params={{ id: l.id }} className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="min-w-0"><span className="block truncate">{l.title}</span>{l.kind === "file" && l.file && <span className="num text-xs text-muted-foreground">{l.file.category} · {stockLabel(l.file.inventory)}</span>}</span>
              <span className="flex shrink-0 items-center gap-2"><span className="num text-sm">{usd(l.currentBid)}</span><Badge tone={l.status === "review" ? "warning" : "brand"}>{l.status === "review" ? "In review" : "Live"}</Badge></span>
            </Link>{l.kind !== "file" && <Link to="/listing/$id/edit" params={{ id: l.id }} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit listing</Link>}</div>)) : <Empty title="No active listings" />}
        </section>
        <section className="surface p-5">
          <h2 className="mb-3 font-semibold">Recent bids</h2>
          {bids.length ? bids.map((b) => <div key={b.id + b.title} className="flex justify-between border-t border-border py-3 text-sm first:border-0"><span>{b.bidder} · {b.title}</span><span className="num">{usd(b.amount)}</span></div>) : <Empty title="No bids yet" />}
        </section>
      </div>
      <section className="surface p-5">
        <h2 className="mb-3 font-semibold">Sold & transactions</h2>
        {deals.length ? deals.map((d) => (
          <Link key={d.id} to="/deal/$id" params={{ id: d.id }} className="flex items-center justify-between border-t border-border py-3 first:border-0">
            <span>{s.listings.find((l) => l.id === d.listingId)?.title} · <span className="num">{usd(d.price)}</span>{d.kind === "file" && <span className="text-xs text-muted-foreground"> · File sale — fulfilled automatically</span>}</span><Badge tone={dealStatus(d).tone}>{dealStatus(d).label}</Badge>
          </Link>)) : <Empty title={sold.length ? "Sold listings pending" : "Nothing sold yet"} />}
      </section>
    </div>
  );
}
