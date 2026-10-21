import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { passwordIssue } from "@/lib/account";
import { useAuth } from "@/components/account/AuthProvider";
import { AuthPage } from "@/components/account/AuthPage";
import { Field, Message } from "@/components/account/AccountLayout";
import { Button } from "@/components/sb/ui";
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Choose a new password — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Reset,
});
function Reset() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const issue = passwordIssue(password);
    if (issue) {
      setError(issue);
      return;
    }
    if (password !== confirm) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      const { error: out } = await supabase.auth.signOut({ scope: "global" });
      if (out) {
        setError(
          "Password updated. Other sessions could not be signed out; use Login & security after signing in.",
        );
      }
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError("We couldn’t update your password. Please request a new link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthPage
      title="Choose a new password"
      description="Use a unique password you haven’t used elsewhere."
    >
      <Message
        error={error}
        success={done ? "Your password has been updated. Sign in with your new password." : null}
      />
      {loading ? (
        <p role="status">Checking your reset link…</p>
      ) : done ? (
        <Link to="/login" className="mt-6 inline-block underline">
          Sign in
        </Link>
      ) : !session ? (
        <div className="text-sm">
          <p>Your reset session is missing or has expired.</p>
          <Link to="/forgot-password" className="mt-4 inline-block underline">
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password">
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <input
              className="field"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <Button disabled={busy} type="submit" className="w-full">
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthPage>
  );
}
