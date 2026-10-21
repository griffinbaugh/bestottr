import { z } from "zod";
export const profileSchema = z.object({
  display_name: z.string().trim().min(2, "Use at least 2 characters.").max(60),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9][a-z0-9_]*$/, "Use lowercase letters, numbers and underscores."),
  bio: z.string().trim().max(500),
});
export type Profile = {
  id: string;
  display_name: string;
  handle: string;
  bio: string;
  created_at: string;
  updated_at: string;
};
export type Preferences = {
  user_id: string;
  email_bids: boolean;
  email_listings: boolean;
  email_news: boolean;
  currency: string;
  timezone: string;
  updated_at: string;
};
export type RobloxAccount = {
  user_id: string;
  roblox_user_id: string;
  username: string;
  display_name: string;
  verified_at: string;
};
export function safeReturnTo(value: unknown, fallback = "/account"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20]/.test(value)
  )
    return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
    const u = new URL(value, "https://bestottr.com");
    if (
      u.origin !== "https://bestottr.com" ||
      ["/login", "/signup", "/auth/callback"].includes(u.pathname)
    )
      return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
export function passwordIssue(password: string): string | null {
  return password.length < 12
    ? "Use a password with at least 12 characters."
    : password.length > 128
      ? "Use no more than 128 characters."
      : null;
}
export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "B"
  );
}
export const authCallback = () => `${window.location.origin}/auth/callback`;
