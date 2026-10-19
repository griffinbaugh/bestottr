import { describe, expect, it, vi } from "vitest";
import { buildEmail, deliverTicketEmails, sendSupportEmail } from "@/lib/support-email.server";

const env = { token: "t", accountId: "acc" };
const ok = () => vi.fn(async () => new Response(JSON.stringify({ success: true, result: { id: "m1" } }), { status: 200 }));

describe("support email", () => {
  it("customer ack goes from support to submitter with ticket number and reply-to", () => {
    const m = buildEmail({ kind: "customer_ack", to: "c@x.com", ticketNumber: "BOT-2026-000101" });
    expect(m.from).toEqual({ address: "support@bestottr.com", name: "bestottr Support" });
    expect(m.to).toEqual(["c@x.com"]);
    expect(m.reply_to).toBe("support@bestottr.com");
    expect(m.subject).toContain("BOT-2026-000101");
  });
  it("support notify goes to support inbox with admin link and customer email", () => {
    const m = buildEmail({ kind: "support_notify", ticketNumber: "BOT-1", category: "Payments", customerEmail: "c@x.com" });
    expect(m.to).toEqual(["support@bestottr.com"]);
    expect(m.subject).toContain("BOT-1");
    expect(m.subject).toContain("Payments");
    expect(m.text).toContain("https://bestottr.com/admin/support");
    expect(m.text).toContain("c@x.com");
  });
  it("no credentials → sent:false without network", async () => {
    const f = ok();
    expect((await sendSupportEmail({ kind: "customer_ack", to: "a@b.co", ticketNumber: "X" }, {}, f)).sent).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("success → sent:true, hits account send endpoint", async () => {
    const f = ok();
    const r = await sendSupportEmail({ kind: "customer_ack", to: "a@b.co", ticketNumber: "X" }, env, f);
    expect(r).toEqual({ sent: true, id: "m1" });
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe("https://api.cloudflare.com/client/v4/accounts/acc/email/sending/send");
  });
  it("API failure → sent:false", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ success: false, errors: [{ message: "bad" }] }), { status: 403 }));
    expect((await sendSupportEmail({ kind: "customer_ack", to: "a@b.co", ticketNumber: "X" }, env, f)).sent).toBe(false);
  });
  it("delivery never throws on network failure or missing credentials", async () => {
    const boom = vi.fn(async () => { throw new Error("down"); });
    await expect(deliverTicketEmails({ ticketNumber: "X", email: "a@b.co", category: "c" }, env, boom)).resolves.toMatchObject({ ack: { sent: false }, notify: { sent: false } });
    await expect(deliverTicketEmails({ ticketNumber: "X", email: "a@b.co", category: "c" }, {})).resolves.toMatchObject({ ack: { sent: false } });
  });
});
