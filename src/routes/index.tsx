import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, FileSignature, Gavel, ShieldCheck, Workflow } from "lucide-react";
import { ListingCard } from "@/components/sb/ListingCard";
import { Countdown } from "@/components/sb/Countdown";
import { Badge, buttonVariants } from "@/components/sb/ui";
import { usd, usdCompact, compact } from "@/lib/format";
import { img } from "@/lib/images";
import { useAppState } from "@/lib/store";

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
  const live = listings.filter((l) => l.status === "live");
  const auctions = live.filter((l) => l.format === "auction");
  const featured = listings.find((l) => l.id === "factory-tycoon") ?? live[0];

  return (
    <>
      <section className="dark hero-grid bg-background text-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div className="flex flex-col justify-center">
            <Badge tone="brand" className="self-start">
              <ShieldCheck className="h-3.5 w-3.5" /> Ownership-verified marketplace
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              Buy and sell Roblox businesses with confidence.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Verified metrics pulled straight from the source, competitive auctions, escrowed funds and a managed transfer of every asset — from the experience to the Discord.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/browse" className={buttonVariants({ size: "lg" })}>
                Browse marketplace <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/sell" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Sell your experience
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6">
              {[["$14.2M", "Closed volume"], ["312", "Verified sellers"], ["9.4 days", "Avg. time to close"]].map(([v, l]) => (
                <div key={l}>
                  <dt className="eyebrow">{l}</dt>
                  <dd className="num mt-1 text-xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {featured && (
            <Link to="/listing/$id" params={{ id: featured.id }} className="surface group block self-center overflow-hidden">
              <div className="relative aspect-video overflow-hidden">
                <img src={img(featured.image)} alt={featured.title} width={1088} height={608} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
                <div className="absolute left-3 top-3 flex gap-2">
                  <Badge tone="overlay"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" /> Live auction</Badge>
                  <Badge tone="overlay"><BadgeCheck className="h-3.5 w-3.5" /> Verified</Badge>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">{featured.genre} · {featured.seller.name}</div>
                    <div className="mt-1 text-lg font-semibold">{featured.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Ends in</div>
                    <Countdown endsAt={featured.endsAt} className="font-semibold" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-3 border-t border-border pt-4 text-sm">
                  <Mini label="Current bid" value={usd(featured.currentBid)} />
                  <Mini label="Revenue/mo" value={usdCompact(featured.monthlyRevenue)} />
                  <Mini label="Visits/mo" value={compact(featured.monthlyVisits)} />
                  <Mini label="CCU" value={compact(featured.ccu)} />
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-4 rounded-lg border border-dashed border-warning bg-warning-soft px-4 py-3 text-sm">
          <strong>Demo walkthrough:</strong> open <Link to="/listing/$id" params={{ id: "factory-tycoon" }} className="font-medium underline underline-offset-2">Factory Tycoon Empire</Link>, place a bid, then use “Demo: win auction” to open the deal room and advance through each stage.
        </div>
        <SectionHead title="Live auctions" link="/browse" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.slice(0, 6).map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-4 md:px-6">
          {[
            { icon: BadgeCheck, t: "Verify", d: "Sellers connect Roblox. Ownership, revenue and traffic are pulled and verified automatically." },
            { icon: Gavel, t: "Bid", d: "Transparent auctions with reserves, buy-now pricing and full bid history." },
            { icon: FileSignature, t: "Close", d: "A private deal room for agreements, escrow funding and due diligence." },
            { icon: Workflow, t: "Transfer", d: "A guided checklist moves every asset, then funds release on buyer confirmation." },
          ].map(({ icon: I, t, d }, i) => (
            <div key={t}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border"><I className="h-4 w-4" /></span>
                <span className="num text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <SectionHead title="Buy now" link="/browse" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {live.filter((l) => l.format === "buy_now").map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className="num truncate font-semibold">{value}</div>
    </div>
  );
}

function SectionHead({ title, link }: { title: string; link: "/browse" }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <Link to={link} className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
    </div>
  );
}
