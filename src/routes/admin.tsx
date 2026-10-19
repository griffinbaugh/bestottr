import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Empty, PageHeader, Tabs } from "@/components/sb/ui";
import type { AdminItem } from "@/lib/data";
import { STAGES } from "@/lib/data";
import { usd } from "@/lib/format";
import { actions, useAppState } from "@/lib/store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Moderation — bestottr" },
      { name: "description", content: "Listing review, verification, disputes and transaction review." },
      { property: "og:title", content: "Moderation — bestottr" },
      { property: "og:description", content: "bestottr admin console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type T = "listings" | "users" | "disputes" | "flags" | "txn";

function Admin() {
  const s = useAppState();
  const [tab, setTab] = useState<T>("listings");
  const review = s.listings.filter((l) => l.status === "review");
  const Row = ({ item, kind, ok, no }: { item: AdminItem; kind: "users" | "disputes" | "flags"; ok: [string, AdminItem["status"]]; no: [string, AdminItem["status"]] }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-0">
      <div><div className="font-medium">{item.title}</div><div className="text-sm text-muted-foreground">{item.subtitle} · {item.meta}</div></div>
      {item.status === "open" ? <div className="flex gap-2"><Button size="sm" onClick={() => actions.setAdmin(kind, item.id, ok[1])}>{ok[0]}</Button><Button size="sm" variant="outline" onClick={() => actions.setAdmin(kind, item.id, no[1])}>{no[0]}</Button></div> : <Badge tone="neutral">{item.status}</Badge>}
    </div>
  );
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><PageHeader title="Moderation" subtitle="Trust & safety console" /><Link to="/admin/support" className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent">Support queue</Link></div>
      <div className="mt-6"><Tabs value={tab} onChange={setTab} items={[
        { value: "listings", label: "Listing review", count: review.length },
        { value: "users", label: "Verification", count: s.admin.users.filter((i) => i.status === "open").length },
        { value: "disputes", label: "Disputes", count: s.admin.disputes.filter((i) => i.status === "open").length },
        { value: "flags", label: "Suspicious bids", count: s.admin.flags.filter((i) => i.status === "open").length },
        { value: "txn", label: "Transactions", count: s.deals.length },
      ]} /></div>
      <div className="surface mt-6 p-5">
        {tab === "listings" && (review.length ? review.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-0">
            <div><div className="font-medium">{l.title}</div><div className="text-sm text-muted-foreground">{l.seller.name} · {usd(l.startingBid)} start</div></div>
            <div className="flex gap-2"><Button size="sm" onClick={() => actions.setListingStatus(l.id, "live")}>Approve</Button><Button size="sm" variant="outline" onClick={() => actions.setListingStatus(l.id, "rejected")}>Reject</Button></div>
          </div>)) : <Empty title="Review queue is clear" />)}
        {tab === "users" && s.admin.users.map((i) => <Row key={i.id} item={i} kind="users" ok={["Verify", "approved"]} no={["Reject", "rejected"]} />)}
        {tab === "disputes" && s.admin.disputes.map((i) => <Row key={i.id} item={i} kind="disputes" ok={["Resolve", "resolved"]} no={["Hold funds", "held"]} />)}
        {tab === "flags" && s.admin.flags.map((i) => <Row key={i.id} item={i} kind="flags" ok={["Clear", "resolved"]} no={["Void bid", "voided"]} />)}
        {tab === "txn" && s.deals.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3 first:border-0">
            <div><div className="font-medium">#{d.id} · {s.listings.find((l) => l.id === d.listingId)?.title}</div><div className="text-sm text-muted-foreground">{usd(d.price)} · {STAGES[d.stage]}</div></div>
            {s.admin.txn[d.id] ? <Badge>{s.admin.txn[d.id]}</Badge> : <div className="flex gap-2"><Button size="sm" onClick={() => actions.setTxn(d.id, "approved")}>Approve</Button><Button size="sm" variant="outline" onClick={() => actions.setTxn(d.id, "held")}>Hold</Button></div>}
          </div>))}
      </div>
    </div>
  );
}
