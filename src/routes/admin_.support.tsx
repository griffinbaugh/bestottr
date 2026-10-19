import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge, Button } from "@/components/sb/ui";
import { CATEGORIES, PRIORITIES, STATUSES, SUPPORT_EMAIL, categoryLabel, replyMailto } from "@/lib/support";
import { getEmailStatus } from "@/lib/support.functions";

type Ticket = Tables<"support_tickets">;

export const Route = createFileRoute("/admin_/support")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Support queue — bestottr admin" },
      { name: "description", content: "Internal support ticket queue for the bestottr team." },
      { property: "og:title", content: "Support queue — bestottr admin" },
      { property: "og:description", content: "Internal support ticket queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportAdmin,
});

const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;
const prioLabel = (v: string) => PRIORITIES.find((s) => s.value === v)?.label ?? v;
const fmt = (s: string) => new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function SupportAdmin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [emailOn, setEmailOn] = useState(false);
  useEffect(() => { getEmailStatus().then((r) => setEmailOn(r.connected)).catch(() => {}); }, []);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((ev, s) => {
      if (ev === "SIGNED_IN" || ev === "SIGNED_OUT" || ev === "USER_UPDATED" || ev === "INITIAL_SESSION") setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Moderation</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Support queue</h1>
          <p className="text-sm text-muted-foreground">Tickets submitted through the support page.</p>
        </div>
        {session && <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>}
      </div>
      {emailOn ? (
        <div className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-[13px]">
          Outbound email is connected from support.bestottr.com. Customers get an acknowledgment and new tickets notify {SUPPORT_EMAIL}. Delivery failures are logged and never block submission.
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-warning bg-warning-soft px-3 py-2 text-[13px]">
          Outbound email isn't connected yet. Tickets are saved, but no acknowledgment or notification emails are sent. Use "Reply by email" to answer from your own mail client as {SUPPORT_EMAIL}.
        </div>
      )}
      <div className="mt-6">
        {session === undefined ? <p className="text-sm text-muted-foreground">Loading…</p>
          : !session ? <SignIn />
          : isAdmin === null ? <p className="text-sm text-muted-foreground">Checking access…</p>
          : !isAdmin ? <p className="text-sm text-muted-foreground">Signed in as {session.user.email}. This account doesn't have support admin access.</p>
          : <Queue />}
      </div>
    </div>
  );
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password: pw })
      : await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: `${window.location.origin}/admin/support` } });
    setBusy(false);
    if (r.error) toast.error(r.error.message);
    else if (mode === "up") toast.success("Check your email to confirm the account.");
  }
  return (
    <form onSubmit={go} className="max-w-sm space-y-3">
      <h2 className="text-lg font-semibold">{mode === "in" ? "Staff sign in" : "Create staff account"}</h2>
      <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="field" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="Password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
      <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Need a staff account? Create one" : "Have an account? Sign in"}
      </button>
      <p className="text-[13px] text-muted-foreground">New accounts need admin access granted before they can see tickets.</p>
    </form>
  );
}

function Queue() {
  const [rows, setRows] = useState<Ticket[] | null>(null);
  const [status, setStatus] = useState("");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) toast.error("Couldn't load tickets");
    setRows(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((t) =>
      (!status || t.status === status) && (!cat || t.subject_category === cat) &&
      (!term || [t.ticket_number, t.contact_email, t.custom_topic ?? "", categoryLabel(t.subject_category)].some((x) => x.toLowerCase().includes(term))));
  }, [rows, status, cat, q]);
  const open = rows?.find((t) => t.id === openId) ?? null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input className="field h-9 min-w-0 flex-1 text-sm sm:max-w-xs" placeholder="Search ticket, email or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tickets" />
        <select className="field h-9 w-auto text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="field h-9 w-auto text-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by topic">
          <option value="">All topics</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[13px] text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Ticket</th><th className="px-3 py-2 font-medium">Topic</th><th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Created</th><th className="px-3 py-2 font-medium">Priority</th><th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? <tr><td colSpan={6} className="px-3 py-6 text-muted-foreground">Loading…</td></tr>
              : shown.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-muted-foreground">No tickets match.</td></tr>
              : shown.map((t) => (
                <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-accent">
                  <td className="num px-3 py-2.5 font-medium"><button className="text-left" onClick={() => setOpenId(t.id)}>{t.ticket_number}</button></td>
                  <td className="px-3 py-2.5">{t.custom_topic || categoryLabel(t.subject_category)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{t.contact_email}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmt(t.created_at)}</td>
                  <td className="px-3 py-2.5"><Badge tone={t.priority === "urgent" || t.priority === "high" ? "warning" : "neutral"}>{prioLabel(t.priority)}</Badge></td>
                  <td className="px-3 py-2.5"><Badge tone={t.status === "open" ? "live" : "outline"}>{statusLabel(t.status)}</Badge></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {open && <Detail key={open.id} t={open} onClose={() => setOpenId(null)} onSaved={(n) => setRows((r) => r?.map((x) => (x.id === n.id ? n : x)) ?? null)} />}
    </div>
  );
}

function Detail({ t, onClose, onSaved }: { t: Ticket; onClose: () => void; onSaved: (t: Ticket) => void }) {
  const [status, setStatus] = useState(t.status);
  const [priority, setPriority] = useState(t.priority);
  const [notes, setNotes] = useState(t.admin_notes ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = status !== t.status || priority !== t.priority || notes !== (t.admin_notes ?? "");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  async function save() {
    setBusy(true);
    const { data, error } = await supabase.from("support_tickets").update({ status, priority, admin_notes: notes.trim() || null }).eq("id", t.id).select("*").single();
    setBusy(false);
    if (error || !data) { toast.error("Couldn't save changes"); return; }
    onSaved(data);
    toast.success("Ticket updated");
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60" onClick={onClose}>
      <aside role="dialog" aria-label={`Ticket ${t.ticket_number}`} className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="num text-lg font-semibold">{t.ticket_number}</div>
            <div className="text-sm text-muted-foreground">{t.custom_topic ? `Other · ${t.custom_topic}` : categoryLabel(t.subject_category)}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <dl className="mt-5 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt><dd className="break-all">{t.contact_email}</dd>
          <dt className="text-muted-foreground">Phone</dt><dd>{t.phone ?? "—"}</dd>
          <dt className="text-muted-foreground">Link</dt><dd className="break-all">{t.relevant_url ? <a href={t.relevant_url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">{t.relevant_url}</a> : "—"}</dd>
          <dt className="text-muted-foreground">Created</dt><dd>{fmt(t.created_at)}</dd>
          <dt className="text-muted-foreground">Updated</dt><dd>{fmt(t.updated_at)}</dd>
        </dl>
        <div className="mt-5 text-sm font-medium">Description</div>
        <p className="mt-1.5 whitespace-pre-wrap break-words rounded-md border border-border p-3 text-sm leading-relaxed">{t.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="text-sm"><span className="mb-1.5 block font-medium">Status</span>
            <select className="field h-10 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </label>
          <label className="text-sm"><span className="mb-1.5 block font-medium">Priority</span>
            <select className="field h-10 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </label>
        </div>
        <label className="mt-4 block text-sm"><span className="mb-1.5 block font-medium">Internal notes</span>
          <textarea className="field h-auto min-h-28 py-2 text-sm" maxLength={10000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Only visible to the support team" />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={save} disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</Button>
          <a href={replyMailto(t)} className="inline-flex h-11 items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-medium hover:bg-accent"><Mail className="h-4 w-4" /> Reply by email</a>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">Opens your mail app addressed to the customer. Nothing is sent from bestottr.</p>
      </aside>
    </div>
  );
}
