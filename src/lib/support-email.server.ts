// Support email via the Resend HTTPS API.
// Without RESEND_API_KEY this is a safe no-op (sent:false).
// Receiving support@bestottr.com stays on Cloudflare Email Routing (forwarded inbox).
export type SupportEmailEvent =
  | { kind: "customer_ack"; to: string; ticketNumber: string }
  | { kind: "support_notify"; ticketNumber: string; category: string; customerEmail?: string }
  | { kind: "status_update"; to: string; ticketNumber: string; status: string };

export type EmailEnv = { apiKey?: string | undefined; from?: string | undefined };
export type EmailMessage = { from: { address: string; name: string }; to: string[]; reply_to: string; subject: string; text: string; html: string };

const ADMIN_URL = "https://bestottr.com/admin/support";

export function readEmailEnv(): EmailEnv {
  return { apiKey: process.env["RESEND_API_KEY"], from: process.env["SUPPORT_EMAIL_FROM"] };
}
export const isEmailConfigured = (env: EmailEnv = readEmailEnv()) => !!env.apiKey;

export const RESEND_URL = "https://api.resend.com/emails";
export function toResendPayload(m: EmailMessage) {
  return { from: `${m.from.name} <${m.from.address}>`, to: m.to, reply_to: m.reply_to, subject: m.subject, text: m.text, html: m.html };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function html(title: string, lines: string[], link?: { href: string; label: string }) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${esc(l)}</p>`).join("");
  const btn = link ? `<p style="margin:16px 0"><a href="${esc(link.href)}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;border-radius:6px;text-decoration:none">${esc(link.label)}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111"><div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:24px"><div style="font-weight:700;font-size:16px;margin-bottom:16px">bestottr</div><h1 style="font-size:18px;margin:0 0 12px">${esc(title)}</h1>${body}${btn}<p style="margin:20px 0 0;font-size:12px;color:#777">bestottr Support · support@bestottr.com</p></div></body></html>`;
}

export function buildEmail(e: SupportEmailEvent, fromAddr = "support@bestottr.com"): EmailMessage {
  const from = { address: fromAddr, name: "bestottr Support" };
  const base = { from, reply_to: fromAddr };
  if (e.kind === "customer_ack") {
    const lines = [`Thanks for contacting bestottr. We received your request and created ticket ${e.ticketNumber}.`, "Our team will reply by email. Reply to this message to add details, and keep the ticket number in the subject."];
    return { ...base, to: [e.to], subject: `[${e.ticketNumber}] We received your bestottr support request`, text: lines.join("\n\n") + "\n\n— bestottr Support", html: html("We received your request", lines) };
  }
  if (e.kind === "support_notify") {
    const lines = [`New ticket ${e.ticketNumber}`, `Topic: ${e.category}`, `Customer: ${e.customerEmail ?? "not provided"}`];
    return { ...base, to: [fromAddr], subject: `[${e.ticketNumber}] New support ticket — ${e.category}`, text: `${lines.join("\n")}\n\nOpen the queue: ${ADMIN_URL}`, html: html("New support ticket", lines, { href: ADMIN_URL, label: "Open support queue" }) };
  }
  const lines = [`Your ticket ${e.ticketNumber} is now: ${e.status}.`, "Reply to this email if you need anything else."];
  return { ...base, to: [e.to], subject: `[${e.ticketNumber}] Ticket status: ${e.status}`, text: lines.join("\n\n"), html: html("Ticket update", lines) };
}

export async function sendSupportEmail(e: SupportEmailEvent, env: EmailEnv = readEmailEnv(), f: typeof fetch = fetch): Promise<{ sent: boolean; id?: string | undefined; error?: string }> {
  if (!isEmailConfigured(env)) return { sent: false, error: "not_configured" };
  const msg = buildEmail(e, env.from || "support@bestottr.com");
  try {
    const res = await f(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(toResendPayload(msg)),
    });
    const json = (await res.json().catch(() => null)) as { id?: string; name?: string; message?: string } | null;
    if (!res.ok || !json?.id) {
      const err = `${res.status} ${json?.name ?? ""} ${json?.message ?? "request failed"}`.replace(/\s+/g, " ").trim();
      console.error("support email failed", { provider: "resend", kind: e.kind, ticket: e.ticketNumber, error: err });
      return { sent: false, error: err };
    }
    console.info("support email sent", { provider: "resend", kind: e.kind, ticket: e.ticketNumber, id: json.id });
    return { sent: true, id: json.id };
  } catch (err) {
    console.error("support email error", { kind: e.kind, ticket: e.ticketNumber, error: err instanceof Error ? err.message : "unknown" });
    return { sent: false, error: "network" };
  }
}

/** Never throws — ticket creation must not fail after insert. Active provider: Resend. */
export async function deliverTicketEmails(t: { ticketNumber: string; email: string; category: string }, env?: EmailEnv, f?: typeof fetch) {
  try {
    const ack = await sendSupportEmail({ kind: "customer_ack", to: t.email, ticketNumber: t.ticketNumber }, env, f);
    const notify = await sendSupportEmail({ kind: "support_notify", ticketNumber: t.ticketNumber, category: t.category, customerEmail: t.email }, env, f);
    return { ack, notify };
  } catch {
    return { ack: { sent: false }, notify: { sent: false } };
  }
}
