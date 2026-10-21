import { IS_DEMO } from "@/lib/app-mode";
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
      {
        name: "description",
        content: IS_DEMO
          ? "Verified Roblox experience listings, creator files, competitive auctions, protected funds and automatically verified transfers."
          : "A marketplace for Roblox businesses and creator assets. Create your account ahead of launch.",
      },
      {
        property: "og:title",
        content: "bestottr — Buy and sell Roblox businesses and creator assets",
      },
      {
        property: "og:description",
        content: IS_DEMO
          ? "Verified listings, creator files, competitive bidding, secure transactions and managed transfers."
          : "Prepare your creator profile for the bestottr marketplace.",
      },
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
  const communities = live.filter((l) => l.kind === "community");
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
            {IS_DEMO
              ? "Verified experiences, scripts, maps and UI kits — with competitive auctions, protected funds and automatic ownership verification."
              : "A marketplace for Roblox experiences, scripts, maps and UI kits. Create your account ahead of our launch."}
          </p>
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search experiences, files, genres, studios…"
            submitLabel="Search"
            className="mx-auto mt-8 max-w-xl"
            inputClassName="h-13 text-base"
          />
          {IS_DEMO && (
            <dl className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
              <CountUpStat
                target={IS_DEMO ? 14.2 : 0}
                prefix="$"
                suffix="M"
                decimals={1}
                label="Closed volume"
              />
              <CountUpStat target={IS_DEMO ? 312 : 0} label="Verified sellers" delay={120} />
              <CountUpStat
                target={IS_DEMO ? 9.4 : 0}
                decimals={1}
                suffix=" days"
                label="Avg. to close"
                delay={240}
              />
            </dl>
          )}
          {!IS_DEMO && (
            <div className="mt-8">
              <p className="mb-4 text-sm text-muted-foreground">
                Marketplace opening soon. Accounts and support are available now.
              </p>
              <Link to="/signup" className={buttonVariants()}>
                Create your account
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <SectionHead title={IS_DEMO ? "Live auctions" : "Marketplace"} link="/browse" />
        {!IS_DEMO && (
          <div className="surface p-8 text-center text-sm text-muted-foreground">
            Listings will appear here when trading opens.
          </div>
        )}
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.slice(0, 6).map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {IS_DEMO && (
        <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
          <SectionHead title="Buy now" link="/browse" />
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buyNow.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {communities.length > 0 && IS_DEMO && (
        <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
          <SectionHead title="Roblox Communities" link="/browse" />
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communities.slice(0, 3).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      {IS_DEMO && (
        <section className="mx-auto max-w-7xl px-4 pb-10 md:px-6">
          <SectionHead title="Creator files" link="/browse" />
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {files.slice(0, 6).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 md:px-6">
          {(IS_DEMO
            ? [
                {
                  icon: BadgeCheck,
                  t: "Verify",
                  d: "Sellers connect Roblox and paste their game link. We verify they own the experience — or own the group that does.",
                },
                {
                  icon: FileSignature,
                  t: "Close",
                  d: "A private deal room locks the destination account, protects funds and verifies Roblox ownership automatically.",
                },
                {
                  icon: Workflow,
                  t: "Transfer",
                  d: "A guided checklist moves every asset. Funds release on buyer confirmation.",
                },
              ]
            : [
                {
                  icon: BadgeCheck,
                  t: "Create your account",
                  d: "Set up a public profile, confirm your email and keep your account secure.",
                },
                {
                  icon: FileSignature,
                  t: "Prepare to list",
                  d: "Roblox account linking and ownership checks will open before listings are accepted.",
                },
                {
                  icon: Workflow,
                  t: "Trade when we launch",
                  d: "Checkout and payouts are being connected. No deposits or payments are accepted yet.",
                },
              ]
          ).map(({ icon: I, t, d }) => (
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
            <h2 className="text-lg font-semibold tracking-tight">
              Selling an experience or a file?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {IS_DEMO
                ? "Verify ownership, set your price and list in minutes."
                : "Set up your account while we prepare seller verification and payments."}
            </p>
          </div>
          <Link to="/sell" className={buttonVariants({ variant: "outline" })}>
            {IS_DEMO ? "Start a listing" : "Seller account setup"}{" "}
            <ArrowRight className="h-4 w-4" />
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
      <Link
        to={link}
        search={{ q: "" }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        View all →
      </Link>
    </div>
  );
}
