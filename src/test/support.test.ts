import { describe, expect, it } from "vitest";
import { autoPriority, replyMailto, ticketSchema } from "@/lib/support";

const base = { category: "account", description: "I cannot sign in to my account since yesterday.", email: "a@b.co" };

describe("support ticket rules", () => {
  it("accepts a valid ticket without phone", () => expect(ticketSchema.safeParse(base).success).toBe(true));
  it("rejects invalid email", () => expect(ticketSchema.safeParse({ ...base, email: "nope" }).success).toBe(false));
  it("requires custom topic for Other", () => {
    expect(ticketSchema.safeParse({ ...base, category: "other" }).success).toBe(false);
    expect(ticketSchema.safeParse({ ...base, category: "other", customTopic: "Press" }).success).toBe(true);
  });
  it("accepts international phone, rejects junk", () => {
    expect(ticketSchema.safeParse({ ...base, phone: "+44 20 7946 0958" }).success).toBe(true);
    expect(ticketSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false);
  });
  it("rejects non-http links", () => expect(ticketSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false));
  it("payments, refunds and ownership transfer are high priority", () => {
    expect(autoPriority("payments")).toBe("high");
    expect(autoPriority("refund_dispute")).toBe("high");
    expect(autoPriority("ownership_transfer")).toBe("high");
    expect(autoPriority("technical")).toBe("normal");
  });
  it("reply link targets the customer and includes ticket number", () => {
    const m = replyMailto({ contact_email: "x@y.com", ticket_number: "BOT-2026-000101", subject_category: "auction", custom_topic: null });
    expect(m.startsWith("mailto:x%40y.com?")).toBe(true);
    expect(decodeURIComponent(m)).toContain("[BOT-2026-000101]");
  });
});
