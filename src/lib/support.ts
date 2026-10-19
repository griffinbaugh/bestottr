import { z } from "zod";

export const SUPPORT_EMAIL = "support@bestottr.com";

export const CATEGORIES = [
  { value: "account", label: "Account & login" },
  { value: "roblox_verification", label: "Roblox verification" },
  { value: "buying_experience", label: "Buying an experience" },
  { value: "selling_experience", label: "Selling an experience" },
  { value: "file_purchase", label: "File purchase or download" },
  { value: "auction", label: "Auction or bidding" },
  { value: "payments", label: "Payments & payouts" },
  { value: "ownership_transfer", label: "Ownership transfer" },
  { value: "refund_dispute", label: "Refund or dispute" },
  { value: "report", label: "Report a listing or user" },
  { value: "technical", label: "Technical issue / bug" },
  { value: "business", label: "Business / partnership" },
  { value: "other", label: "Other" },
] as const;
export type Category = (typeof CATEGORIES)[number]["value"];
export const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_customer", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;
export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

/** Mirrors the database rule in submit_support_ticket. */
export function autoPriority(c: Category): "high" | "normal" {
  return c === "payments" || c === "refund_dispute" || c === "ownership_transfer" ? "high" : "normal";
}

const values = CATEGORIES.map((c) => c.value) as [Category, ...Category[]];

export const ticketSchema = z
  .object({
    category: z.enum(values, { errorMap: () => ({ message: "Choose a topic" }) }),
    customTopic: z.string().trim().max(120, "Keep the topic under 120 characters").optional().default(""),
    description: z.string().trim().min(20, "Please describe the issue in at least 20 characters").max(5000, "Keep it under 5,000 characters"),
    email: z.string().trim().max(254).email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .max(32)
      .optional()
      .default("")
      .refine((v) => v === "" || (/^[0-9+()\-.\s]{7,32}$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 7), "Enter a valid phone number or leave it blank"),
    url: z
      .string()
      .trim()
      .max(500)
      .optional()
      .default("")
      .refine((v) => {
        if (v === "") return true;
        try {
          const u = new URL(v);
          return u.protocol === "https:" || u.protocol === "http:";
        } catch {
          return false;
        }
      }, "Enter a full link starting with https://"),
    website: z.string().optional().default(""), // honeypot
  })
  .superRefine((d, ctx) => {
    if (d.category === "other" && d.customTopic.length < 3) ctx.addIssue({ code: "custom", path: ["customTopic"], message: "Add a short topic (at least 3 characters)" });
  });
export type TicketInput = z.input<typeof ticketSchema>;

export function replyMailto(t: { contact_email: string; ticket_number: string; subject_category: string; custom_topic: string | null }) {
  const topic = t.custom_topic || categoryLabel(t.subject_category);
  const subject = `[${t.ticket_number}] Re: ${topic}`;
  const body = `Hi,\n\nThanks for contacting bestottr support about ticket ${t.ticket_number}.\n\n\n— bestottr support\n${SUPPORT_EMAIL}`;
  return `mailto:${encodeURIComponent(t.contact_email)}?cc=${encodeURIComponent(SUPPORT_EMAIL)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
