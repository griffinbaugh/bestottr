import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AccountLayout, AccountPanel, Field, Message } from "@/components/account/AccountLayout";
import { useAuth } from "@/components/account/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { profileSchema } from "@/lib/account";
import { Button } from "@/components/sb/ui";
export const Route = createFileRoute("/account_/profile")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Public profile — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Profile,
});
function Profile() {
  const { profile, refresh } = useAuth();
  const [name, setName] = useState(""),
    [handle, setHandle] = useState(""),
    [bio, setBio] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setHandle(profile.handle);
      setBio(profile.bio);
    }
  }, [profile]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError("");
    setSuccess("");
    const result = profileSchema.safeParse({ display_name: name, handle, bio });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your profile details.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(result.data)
        .eq("id", profile.id)
        .select("id")
        .single();
      if (error || !data) {
        setError(
          error?.code === "23505"
            ? "That handle is already taken."
            : error?.code === "23514"
              ? "That handle is reserved or invalid. Please choose another."
              : "Your profile could not be saved. Check your session and try again.",
        );
        return;
      }
      await refresh();
      setSuccess("Profile saved.");
    } catch {
      setError("Your profile could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountLayout title="Public profile" description="Choose how other creators see you.">
      <AccountPanel
        title="Profile details"
        description="Your name, handle and bio are public. Your email stays private."
      >
        <form className="space-y-5" onSubmit={save}>
          <Message error={error} success={success} />
          <Field label="Display name">
            <input
              className="field"
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Handle" hint="3–30 characters. Lowercase letters, numbers and underscores.">
            <input
              className="field"
              required
              minLength={3}
              maxLength={30}
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
            />
          </Field>
          <Field label="Bio" hint={`${bio.length}/500 characters`}>
            <textarea
              className="field min-h-28 resize-y"
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy || !profile}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </AccountPanel>
    </AccountLayout>
  );
}
