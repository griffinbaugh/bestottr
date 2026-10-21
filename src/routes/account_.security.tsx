import { MfaSettings } from "@/components/account/MfaSettings";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AccountLayout, AccountPanel, Field, Message } from "@/components/account/AccountLayout";
import { useAuth } from "@/components/account/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { authCallback, passwordIssue } from "@/lib/account";
import { Button } from "@/components/sb/ui";
export const Route = createFileRoute("/account_/security")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Login & security — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Security,
});
function Security() {
  const { session, signOut } = useAuth();
  const [email, setEmail] = useState(""),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  async function change(kind: "email" | "password", e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (kind === "password") {
      const issue = passwordIssue(password);
      if (issue) {
        setError(issue);
        return;
      }
      if (password !== confirm) {
        setError("Your passwords do not match.");
        return;
      }
    }
    if (!session?.user.email) return;
    setBusy(kind);
    try {
      const result = await supabase.auth.updateUser(
        kind === "email" ? { email: email.trim() } : { password, current_password: current },
        { emailRedirectTo: authCallback() },
      );
      if (result.error) {
        setError("Your change could not be saved. Please try again or contact support.");
        return;
      }
      setCurrent("");
      setPassword("");
      setConfirm("");
      setEmail("");
      setSuccess(
        kind === "email"
          ? "Check your current and new inboxes to confirm the email change."
          : "Password updated. You can sign out other sessions below.",
      );
    } catch {
      setError("This change is temporarily unavailable. Please try again.");
    } finally {
      setBusy("");
    }
  }
  async function others() {
    setBusy("sessions");
    setError("");
    setSuccess("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      setSuccess(
        "Other refresh sessions have been signed out. Existing access tokens expire according to the session policy.",
      );
    } catch {
      setError("Other sessions could not be signed out. Try again.");
    } finally {
      setBusy("");
    }
  }
  return (
    <AccountLayout
      title="Login & security"
      description="Protect your account and keep your sign-in details current."
    >
      <div className="mb-5">
        <Message error={error} success={success} />
      </div>
      <AccountPanel
        title="Email address"
        description={`Current email: ${session?.user.email ?? ""}`}
      >
        <form onSubmit={(e) => void change("email", e)} className="space-y-4">
          <Field label="New email">
            <input
              className="field"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button disabled={!!busy} type="submit">
            {busy === "email" ? "Updating…" : "Change email"}
          </Button>
        </form>
      </AccountPanel>
      <AccountPanel
        title="Password"
        description="Use a unique password with at least 12 characters."
      >
        <form onSubmit={(e) => void change("password", e)} className="space-y-4">
          <Field label="Current password">
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="New password">
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button disabled={!!busy} type="submit">
            {busy === "password" ? "Updating…" : "Update password"}
          </Button>
        </form>
      </AccountPanel>
      <MfaSettings />
      <AccountPanel
        title="Sessions"
        description="Sign out on shared devices or end access on your other devices."
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={!!busy} onClick={() => void others()}>
            Sign out other devices
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void signOut().catch(() => setError("Sign-out failed. Please try again."))
            }
          >
            Sign out this device
          </Button>
        </div>
      </AccountPanel>
    </AccountLayout>
  );
}
