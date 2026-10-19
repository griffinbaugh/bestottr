import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, FileSignature, Search, ShieldCheck, Workflow } from "lucide-react";
import { useState } from "react";
import { ListingCard } from "@/components/sb/ListingCard";
import { buttonVariants } from "@/components/sb/ui";
import { useAppState } from "@/lib/store";
import markWhite from "@/assets/mark-white.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "bestottr — Buy and sell Roblox businesses with confidence" },
      { name: "description", content: "Verified Roblox experience listings, competitive auctions, escrowed deal rooms and managed ownership transfers." },
      { property: "og:title", content: "bestottr — Buy and sell Roblox businesses with confidence" },
      { property: "og:description", content: "Verified listings, competitive bidding, secure transactions and managed transfers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { listings } = useAppState();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const live = listings.filter((l) => l.status === "live");
  const auctions = live.filter((l) => l.format === "auction");
  const buyNow = live.filter((l) => l.format === "buy_now");

  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
          <img src={markWhite} alt="" width={40} height={40} className="mx-auto mb-6 h-10 w-10" />
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Buy and sell Roblox businesses with confidence.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Verified metrics, competitive auctions, escrowed funds and a managed transfer of every asset.
          </p>
          <form
            className="relative mx-auto mt-8 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/browse", search: { q } });
            }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field h-13 pl-11 pr-32 text-base"
              placeholder="Search experiences, genres, studios…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search the marketplace"
            />
            <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/88">
              Search
            </button>
          </form>
          <dl className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
            {[["$14.2M", "Closed volume"], ["312", "Verified sellers"], ["9.4 days", "Avg. to close"]].map(([v, l]) => (
              <div key={l}>
                <dd className="num text-lg font-semibold">{v}</dd>
                <dt className="mt-0.5 text-xs text-muted-foreground">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <SectionHead title="Live auctions" link="/browse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.slice(0, 6).map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
        <SectionHead title="Buy now" link="/browse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buyNow.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 md:px-6">
          {[
            { icon: BadgeCheck, t: "Verify", d: "Sellers connect Roblox. Ownership, revenue and traffic are verified automatically." },
            { icon: FileSignature, t: "Close", d: "A private deal room handles the agreement, escrow and due diligence." },
            { icon: Workflow, t: "Transfer", d: "A guided checklist moves every asset. Funds release on buyer confirmation." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="flex gap-3">
              <I className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="text-sm font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-10 md:px-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Selling an experience?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Connect Roblox, verify ownership and list in minutes.</p>
          </div>
          <Link to="/sell" className={buttonVariants({ variant: "outline" })}>
            Start a listing <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function SectionHead({ title, link }: { title: string; link: "/browse" }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Link to={link} search={{ q: "" }} className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
    </div>
  );
}
