import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge, Empty, PageHeader, Stat, buttonVariants } from "@/components/sb/ui";
import { ME, STAGES } from "@/lib/data";
import { usd } from "@/lib/format";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller dashboard — StudioBid" },
      { name: "description", content: "Manage listings, bids, sales and transfers." },
      { property: "og:title", content: "Seller dashboard — StudioBid" },
      { property: "og:description", content: "Manage your StudioBid listings." },
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
  const closed = deals.filter((d) => d.stage === 5).reduce((a, d) => a + d.price, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6">
      <PageHeader title="Selling" subtitle="Your listings and transactions" actions={<Link to="/sell" className={buttonVariants()}>New listing</Link>} />
      <div className="surface grid grid-cols-2 gap-5 p-5 md:grid-cols-4">
        <Stat label="Active listings" value={active.length} />
        <Stat label="Bids received" value={bids.length} />
        <Stat label="In escrow" value={usd(deals.filter((d) => d.funded && d.stage < 5).reduce((a, d) => a + d.price, 0))} />
        <Stat label="Closed revenue" value={usd(closed)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="mb-3 font-semibold">Active listings</h2>
          {active.length ? active.map((l) => (
            <Link key={l.id} to="/listing/$id" params={{ id: l.id }} className="flex items-center justify-between border-t border-border py-3 first:border-0">
              <span>{l.title}</span><span className="flex items-center gap-2"><span className="num text-sm">{usd(l.currentBid)}</span><Badge tone={l.status === "review" ? "warning" : "brand"}>{l.status === "review" ? "In review" : "Live"}</Badge></span>
            </Link>)) : <Empty title="No active listings" />}
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
            <span>{s.listings.find((l) => l.id === d.listingId)?.title} · <span className="num">{usd(d.price)}</span></span><Badge tone={d.stage === 5 ? "brand" : "warning"}>{STAGES[d.stage]}</Badge>
          </Link>)) : <Empty title={sold.length ? "Sold listings pending" : "Nothing sold yet"} />}
      </section>
    </div>
  );
}
