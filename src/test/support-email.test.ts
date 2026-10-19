import { describe, expect, it, vi } from "vitest";
import { buildEmail, deliverTicketEmails, sendSupportEmail, toResendPayload, RESEND_URL } from "@/lib/support-email.server";

const env = { apiKey: "re_test" };
const ok = () => vi.fn(async () => new Response(JSON.stringify({ id: "m1" }), { status: 200 }));
const bodyOf = (f: ReturnType<typeof vi.fn>, i = 0) => JSON.parse(String(((f.mock.calls[i] as unknown[])[1] as RequestInit).body));

describe("support email (Resend)", () => {
  it("customer ack payload: from bestottr Support <support@bestottr.com>, reply-to support, ticket number", () => {
    const p = toResendPayload(buildEmail({ kind: "customer_ack", to: "c@x.com", ticketNumber: "BOT-2026-000101" }));
    expect(p.from).toBe("bestottr Support <support@bestottr.com>");
    expect(p.to).toEqual(["c@x.com"]);
    expect(p.reply_to).toBe("support@bestottr.com");
    expect(p.subject).toContain("BOT-2026-000101");
    expect(p.text).toContain("BOT-2026-000101");
    expect(p.html).toContain("BOT-2026-000101");
  });
  it("team notify goes to support@bestottr.com with category, customer email and admin link", () => {
    const p = toResendPayload(buildEmail({ kind: "support_notify", ticketNumber: "BOT-1", category: "Payments", customerEmail: "c@x.com" }));
    expect(p.to).toEqual(["support@bestottr.com"]);
    expect(p.subject).toContain("BOT-1");
    expect(p.text).toContain("Payments");
    expect(p.text).toContain("c@x.com");
    expect(p.text).toContain("https://bestottr.com/admin/support");
  });
  it("no key → sent:false without network", async () => {
    const f = ok();
    expect((await sendSupportEmail({ kind: "customer_ack", to: "a@b.co", ticketNumber: "X" }, {}, f)).sent).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("success → sent:true with message id, posts to Resend", async () => {
    const f = ok();
    const r = await sendSupportEmail({ kind: "customer_ack", to: "a@b.co", ticketNumber: "X" }, env, f);
    expect(r).toEqual({ sent: true, id: "m1" });
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe(RESEND_URL);
  });
  it("Resend failure → sent:false with sanitized status", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ name: "validation_error", message: "domain not verified" }), { status: 403 }));
    const r = await sendSupportEmail({ kind: "customer_ack", to: "a@b.co", ticketNumber: "X" }, env, f);
    expect(r.sent).toBe(false);
    expect(r.error).toBe("403 validation_error domain not verified");
  });
  it("delivery sends ack to customer then notify to support", async () => {
    const f = ok();
    const r = await deliverTicketEmails({ ticketNumber: "BOT-1", email: "a@b.co", category: "c" }, env, f);
    expect([bodyOf(f, 0).to[0], bodyOf(f, 1).to[0]]).toEqual(["a@b.co", "support@bestottr.com"]);
    expect(r.ack.sent && r.notify.sent).toBe(true);
  });
  it("delivery never throws when Resend is down or key missing", async () => {
    const boom = vi.fn(async () => { throw new Error("down"); });
    await expect(deliverTicketEmails({ ticketNumber: "X", email: "a@b.co", category: "c" }, env, boom)).resolves.toMatchObject({ ack: { sent: false }, notify: { sent: false } });
    await expect(deliverTicketEmails({ ticketNumber: "X", email: "a@b.co", category: "c" }, {})).resolves.toMatchObject({ ack: { sent: false } });
  });
});
