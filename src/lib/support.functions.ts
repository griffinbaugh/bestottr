import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ticketSchema } from "./support";

export const submitTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ticketSchema.parse(input))
  .handler(async ({ data }) => {
    // Honeypot: bots fill the hidden field. Pretend success, store nothing.
    if (data.website) return { ok: true as const, ticketNumber: "BOT-RECEIVED" };
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: num, error } = await sb.rpc("submit_support_ticket", {
      _category: data.category,
      _custom_topic: data.customTopic,
      _description: data.description,
      _email: data.email,
      _phone: data.phone,
      _url: data.url,
    });
    if (error || !num) {
      console.error("support ticket insert failed", error);
      if (error?.message?.includes("rate_limited")) return { ok: false as const, error: "You've sent several tickets recently. Please wait a little before sending another." };
      return { ok: false as const, error: "We couldn't submit your ticket. Please try again in a moment." };
    }
    try {
      const { deliverTicketEmails } = await import("./support-email.server");
      const { categoryLabel } = await import("./support");
      const label = data.category === "other" && data.customTopic ? `Other · ${data.customTopic}` : categoryLabel(data.category);
      await deliverTicketEmails({ ticketNumber: num, email: data.email, category: label });
    } catch (e) {
      console.error("support email delivery crashed", e instanceof Error ? e.message : "unknown");
    }
    return { ok: true as const, ticketNumber: num };
  });

export const getEmailStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isEmailConfigured } = await import("./support-email.server");
  return { connected: isEmailConfigured() };
});
