import { NotificationInbox } from "@/components/account/Notifications";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { AccountLayout, AccountPanel, Field, Message } from "@/components/account/AccountLayout";
import { useAuth } from "@/components/account/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/sb/ui";
export const Route = createFileRoute("/account_/notifications")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Notifications — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Notifications,
});
function Notifications() {
  const { preferences, refresh } = useAuth();
  const [bids, setBids] = useState(true),
    [listings, setListings] = useState(true),
    [news, setNews] = useState(false),
    [timezone, setTimezone] = useState("America/New_York"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useEffect(() => {
    if (preferences) {
      setBids(preferences.email_bids);
      setListings(preferences.email_listings);
      setNews(preferences.email_news);
      setTimezone(preferences.timezone);
    }
  }, [preferences]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!preferences) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
      } catch {
        setError("Enter a valid time zone, such as America/New_York.");
        return;
      }
      const { data, error } = await supabase
        .from("account_preferences")
        .update({ email_bids: bids, email_listings: listings, email_news: news, timezone })
        .eq("user_id", preferences.user_id)
        .select("user_id")
        .single();
      if (error || !data) throw error;
      await refresh();
      setSuccess("Email preferences saved. In-app notifications are unchanged.");
    } catch {
      setError("Your preferences could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountLayout
      title="Notifications"
      description="Your listing updates, email preferences and time zone."
    >
      <NotificationInbox />
      <AccountPanel
        title="Email preferences"
        description="Security, receipt and support messages are always sent when needed."
      >
        <form className="space-y-5" onSubmit={save}>
          <Message error={error} success={success} />
          {[
            { label: "Bid updates and auction reminders", checked: bids, set: setBids },
            { label: "Updates about your listings", checked: listings, set: setListings },
            { label: "Product news and marketplace updates", checked: news, set: setNews },
          ].map((item) => (
            <label key={item.label} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.set(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              {item.label}
            </label>
          ))}
          <Field
            label="Time zone"
            hint="Used for account preferences. Auction deadlines always represent one fixed time."
          >
            <input
              className="field"
              required
              maxLength={64}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              list="account-timezones"
            />
            <datalist id="account-timezones">
              {[
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Los_Angeles",
                "Europe/London",
                "Europe/Paris",
                "Asia/Tokyo",
                "Australia/Sydney",
                "UTC",
              ].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Button disabled={busy || !preferences} type="submit">
            {busy ? "Saving…" : "Save preferences"}
          </Button>
        </form>
      </AccountPanel>
    </AccountLayout>
  );
}
