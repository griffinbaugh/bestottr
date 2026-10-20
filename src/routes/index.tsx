import { coverImage } from "@/lib/gallery";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, FileSignature, Workflow } from "lucide-react";
import { useState } from "react";
import { HeroBackdrop } from "@/components/sb/HeroBackdrop";
import { heroListings } from "@/lib/hero";
import { CountUpStat } from "@/components/sb/CountUpStat";
import { ListingCard } from "@/components/sb/ListingCard";
import { SearchBox } from "@/components/sb/SearchBox";
import { buttonVariants } from "@/components/sb/ui";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "bestottr — Buy and sell Roblox businesses and creator assets" },
      { name: "description", content: "Verified Roblox experience listings, creator files, competitive auctions, protected funds and automatically verified transfers." },
      { property: "og:title", content: "bestottr — Buy and sell Roblox businesses and creator assets" },
      { property: "og:description", content: "Verified listings, creator files, competitive bidding, secure transactions and managed transfers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { listings } = useAppState();
  const [q, setQ] = useState("");
  const live = listings.filter((l) => l.status === "live");
  const auctions = live.filter((l) => l.format === "auction");
  const buyNow = live.filter((l) => l.kind === "experience" && l.format === "buy_now");
  const files = live.filter((l) => l.kind === "file");
  const heroImages = heroListings(listings).map(coverImage);

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border">
        <HeroBackdrop images={heroImages} />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight md:text-[40px] lg:text-[46px]">
            Buy and sell Roblox businesses and creator assets.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Verified experiences, scripts, maps and UI kits — with competitive auctions, protected funds and automatic ownership verification.
          </p>
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search experiences, files, genres, studios…"
            submitLabel="Search"
            className="mx-auto mt-8 max-w-xl"
            inputClassName="h-13 text-base"
          />
          <dl className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
            <CountUpStat target={14.2} prefix="$" suffix="M" decimals={1} label="Closed volume" />
            <CountUpStat target={312} label="Verified sellers" delay={120} />
            <CountUpStat target={9.4} decimals={1} suffix=" days" label="Avg. to close" delay={240} />
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <SectionHead title="Live auctions" link="/browse" />
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.slice(0, 6).map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
        <SectionHead title="Buy now" link="/browse" />
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buyNow.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
        <SectionHead title="Creator files" link="/browse" />
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.slice(0, 6).map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 md:px-6">
          {[
            { icon: BadgeCheck, t: "Verify", d: "Sellers connect Roblox and paste their game link. We verify they own the experience — or own the group that does." },
            { icon: FileSignature, t: "Close", d: "A private deal room locks the destination account, protects funds and verifies Roblox ownership automatically." },
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
            <h2 className="text-lg font-semibold tracking-tight">Selling an experience or a file?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Verify ownership, set your price and list in minutes.</p>
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
