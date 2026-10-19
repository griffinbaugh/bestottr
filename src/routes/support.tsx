import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/sb/ui";
import { CATEGORIES, SUPPORT_EMAIL, ticketSchema, type Category } from "@/lib/support";
import { submitTicket } from "@/lib/support.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Contact support — bestottr" },
      { name: "description", content: "Submit a support ticket to the bestottr team. We reply by email, or by phone if you provide one." },
      { property: "og:title", content: "Contact bestottr support" },
      { property: "og:description", content: "Submit a tracked support ticket and the bestottr team will reply by email." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bestottr.com/support" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://bestottr.com/support" }],
  }),
  component: SupportPage,
});

type Errors = Partial<Record<"category" | "customTopic" | "description" | "email" | "phone" | "url", string>>;

function SupportPage() {
  const submit = useServerFn(submitTicket);
  const [f, setF] = useState({ category: "" as Category | "", customTopic: "", description: "", email: "", phone: "", url: "", website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ num: string; email: string } | null>(null);
  const set = (k: keyof typeof f) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = ticketSchema.safeParse(f);
    if (!parsed.success) {
      const next: Errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as keyof Errors] ??= i.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      const r = await submit({ data: f });
      if (r.ok) setDone({ num: r.ticketNumber, email: parsed.data.email });
      else toast.error(r.error);
    } catch {
      toast.error("We couldn't submit your ticket. Please check the form and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-6 md:py-14">
      <h1 className="text-[30px] font-bold leading-[1.1] tracking-tight md:text-[40px]">Contact bestottr support</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Send us a ticket and the team will reply by email, or by phone if you include a number. The form is the fastest way to reach us because every request gets a tracked ticket number.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Official support email: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline-offset-4 hover:underline">{SUPPORT_EMAIL}</a>
      </p>

      <div className="mt-8 border-t border-border pt-8">
        {done ? (
          <Confirmation num={done.num} email={done.email} onNew={() => { setDone(null); setF({ category: "", customTopic: "", description: "", email: f.email, phone: f.phone, url: "", website: "" }); }} />
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5" aria-busy={busy}>
            <Field label="Topic" error={errors.category} id="category">
              <select id="category" className="field" value={f.category} onChange={(e) => set("category")(e.target.value)} aria-invalid={!!errors.category}>
                <option value="" disabled>Choose a topic</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            {f.category === "other" && (
              <Field label="What is this about?" error={errors.customTopic} id="customTopic">
                <input id="customTopic" className="field" maxLength={120} value={f.customTopic} onChange={(e) => set("customTopic")(e.target.value)} placeholder="A short title for your request" aria-invalid={!!errors.customTopic} />
              </Field>
            )}
            <Field label="Describe the issue" error={errors.description} id="description" hint="Include what happened, what you expected, and any listing or deal names.">
              <textarea id="description" rows={7} maxLength={5000} className="field h-auto min-h-40 py-2.5 leading-relaxed" value={f.description} onChange={(e) => set("description")(e.target.value)} placeholder="For example: I won the auction for Obby Kingdom yesterday but the deal room still shows payment pending…" aria-invalid={!!errors.description} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email" error={errors.email} id="email" hint="We'll reply here.">
                <input id="email" type="email" autoComplete="email" inputMode="email" className="field" value={f.email} onChange={(e) => set("email")(e.target.value)} placeholder="you@example.com" aria-invalid={!!errors.email} />
              </Field>
              <Field label="Optional phone number" error={errors.phone} id="phone">
                <input id="phone" type="tel" autoComplete="tel" inputMode="tel" className="field" value={f.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="+1 555 123 4567" aria-invalid={!!errors.phone} />
              </Field>
            </div>
            <Field label="Related link (optional)" error={errors.url} id="url" hint="A listing, deal or page link, if relevant.">
              <input id="url" type="url" inputMode="url" className="field" value={f.url} onChange={(e) => set("url")(e.target.value)} placeholder="https://bestottr.com/listing/…" aria-invalid={!!errors.url} />
            </Field>
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website")(e.target.value)} /></label>
            </div>
            <p className="text-[13px] text-muted-foreground">By submitting this ticket, you allow bestottr to contact you about this request.</p>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? "Submitting…" : "Submit ticket"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string | undefined; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1.5 text-[13px] text-destructive">{error}</p> : hint ? <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Confirmation({ num, email, onNew }: { num: string; email: string; onNew: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status">
      <div className="flex items-center gap-2 text-sm text-live"><Check className="h-4 w-4" /> Ticket submitted</div>
      <div className="mt-3 text-sm text-muted-foreground">Your ticket number</div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <span className="num text-2xl font-semibold" data-testid="ticket-number">{num}</span>
        <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard?.writeText(num).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-4 text-[15px]">We'll reply to <span className="font-medium">{email}</span>.</p>
      <p className="mt-1 text-sm text-muted-foreground">Keep the ticket number handy if you follow up by email.</p>
      <Button variant="ghost" size="sm" className="mt-6 -ml-3" onClick={onNew}>Submit another ticket</Button>
    </div>
  );
}
