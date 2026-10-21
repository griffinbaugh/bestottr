import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { IS_DEMO } from "@/lib/app-mode";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Check, ExternalLink as LinkIcon, Star } from "lucide-react";
import { ListingCard } from "@/components/sb/ListingCard";
import { ExternalLink } from "@/components/sb/SellerLink";
import { Badge, Empty, Stat, buttonVariants } from "@/components/sb/ui";
import { reviewsFor, SELLERS, type Seller } from "@/lib/data";
import { profileUrlFor } from "@/lib/roblox";
import { useAppState } from "@/lib/store";
import { usd } from "@/lib/format";

export const Route = createFileRoute("/user/$handle")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `@${params.handle} — seller profile — bestottr` },
      {
        name: "description",
        content: `Listings, reviews and verified Roblox identity for @${params.handle} on bestottr.`,
      },
      { property: "og:title", content: `@${params.handle} on bestottr` },
      {
        property: "og:description",
        content: "Seller listings, reviews and verified Roblox identity.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (IS_DEMO ? <Profile /> : <PublicProfile />),
});

const fmt = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={i <= n ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5 text-muted-foreground"}
        />
      ))}
    </span>
  );
}

function Profile() {
  const { handle } = Route.useParams();
  const s = useAppState();
  const mine = s.listings.filter((l) => l.seller.handle === handle);
  const seller: Seller | undefined =
    Object.values(SELLERS).find((x) => x.handle === handle) ?? mine[0]?.seller;
  if (!seller)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Empty
          title="Seller not found"
          action={
            <Link
              to="/browse"
              search={{ q: "" }}
              className={buttonVariants({ variant: "outline" })}
            >
              Back to marketplace
            </Link>
          }
        />
      </div>
    );
  const current = mine.filter((l) => l.status === "live");
  const past = mine.filter((l) => l.status === "sold" || l.status === "ended");
  const reviews = reviewsFor(handle);
  const avg = reviews.length
    ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
    : seller.rating;
  const verifiedRevenue = mine.some((l) => l.verified.revenue);
  const verifiedTraffic = mine.some((l) => l.verified.traffic);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="min-w-0 space-y-4">
          <section className="surface p-5">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-semibold">
                {seller.name.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <h1 className="flex items-center gap-1.5 truncate text-xl font-semibold">
                  {seller.name}
                  {seller.verified && (
                    <BadgeCheck
                      className="h-5 w-5 shrink-0 text-brand"
                      aria-label="Verified seller"
                    />
                  )}
                </h1>
                <div className="text-sm text-muted-foreground">@{seller.handle}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {seller.verified && (
                <Badge tone="brand">
                  <Check className="h-3 w-3" />
                  Identity verified
                </Badge>
              )}
              {verifiedRevenue && (
                <Badge tone="brand">
                  <Check className="h-3 w-3" />
                  Revenue verified
                </Badge>
              )}
              {verifiedTraffic && (
                <Badge tone="brand">
                  <Check className="h-3 w-3" />
                  Traffic verified
                </Badge>
              )}
            </div>
            {seller.bio && <p className="mt-4 text-sm text-muted-foreground">{seller.bio}</p>}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <Stat
                label="Rating"
                value={
                  <span className="inline-flex items-center gap-1">
                    {avg ? avg.toFixed(1) : "—"}
                    <Star className="h-3.5 w-3.5" />
                  </span>
                }
                hint={`${reviews.length} reviews`}
              />
              <Stat label="Sales" value={seller.sales} />
              <Stat label="Since" value={seller.joined} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Typically responds {seller.responseTime}
            </div>
          </section>
          <section className="surface p-5" data-testid="roblox-identity">
            <div className="eyebrow">Connected Roblox identity</div>
            {seller.robloxUserId ? (
              <>
                <div className="mt-2 font-medium">@{seller.robloxUsername}</div>
                <div className="num text-xs text-muted-foreground">
                  User ID {seller.robloxUserId}
                </div>
                <ExternalLink
                  href={profileUrlFor(seller.robloxUserId)}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  <LinkIcon className="h-4 w-4" />
                  View Roblox profile
                </ExternalLink>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No Roblox account connected.</p>
            )}
          </section>
        </aside>

        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Current listings ({current.length})</h2>
            {current.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {current.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            ) : (
              <Empty title="No live listings" />
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Sold / past listings</h2>
            {past.length ? (
              <ul className="surface divide-y divide-border">
                {past.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                    <Link
                      to="/listing/$id"
                      params={{ id: l.id }}
                      className="truncate hover:underline"
                    >
                      {l.title}
                    </Link>
                    <span className="num shrink-0 text-muted-foreground">
                      {l.status === "sold" ? "Sold" : "Ended"} · {usd(l.currentBid)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No past listings yet.</p>
            )}
          </section>
          <section data-testid="reviews">
            <h2 className="mb-3 text-lg font-semibold">Reviews ({reviews.length})</h2>
            {reviews.length ? (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">@{r.reviewer}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Stars n={r.rating} />
                        {fmt(r.at)}
                      </span>
                    </div>
                    {r.listingTitle && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{r.listingTitle}</div>
                    )}
                    <p className="mt-2 text-sm">{r.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PublicProfile() {
  const { handle } = Route.useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name,handle,bio,created_at")
        .eq("handle", handle)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (isPending)
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-sm text-muted-foreground" role="status">
        Loading profile…
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-5 py-16" role="alert">
        Profile could not be loaded. Please try again.
      </div>
    );
  if (!data)
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Empty title="Profile not found" body="This handle may have changed." />
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <section className="surface p-6 md:p-8">
        <p className="eyebrow mb-3">Creator profile</p>
        <h1 className="text-3xl font-semibold">{data.display_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          @{data.handle} · Joined{" "}
          {new Date(data.created_at).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
        {data.bio && <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{data.bio}</p>}
      </section>
      <div className="mt-8">
        <Empty title="No listings yet" body="Marketplace listings will open after launch." />
      </div>
    </div>
  );
}
