import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { ME } from "@/lib/data";
import { useAppState } from "@/lib/store";
import { Sell } from "./sell";
import { Empty, buttonVariants } from "@/components/sb/ui";

export const Route = createFileRoute("/listing/$id_/edit")({
  head: () => ({ meta: [
    { title: "Edit Experience listing — bestottr" },
    { name: "description", content: "Manage your Experience title, curated gallery, details and sale terms." },
    { property: "og:title", content: "Edit Experience listing — bestottr" },
    { property: "og:description", content: "Manage your saved bestottr Experience listing." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const s = useAppState();
  const hydrated = useHydrated();
  const listing = s.listings.find((l) => l.id === id);
  if (!hydrated) return <div className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading listing…</div>;
  if (!listing || listing.kind !== "experience" || listing.seller.handle !== ME) return <div className="mx-auto max-w-4xl px-4 py-10"><Empty title="Listing unavailable for editing" body="You can only edit your own Experience listings." action={<Link to="/seller" className={buttonVariants({ variant: "outline" })}>Back to selling</Link>} /></div>;
  return <Sell key={listing.id} editing={listing} />;
}