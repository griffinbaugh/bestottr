import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { passwordIssue, authCallback } from "@/lib/account";
import { AuthPage } from "@/components/account/AuthPage";
import { Field, Message } from "@/components/account/AccountLayout";
import { Button } from "@/components/sb/ui";
export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Create an account — bestottr" }, { name: "robots", content: "noindex" }],
  }),
  component: Signup,
});
function Signup() {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem = passwordIssue(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError("Your passwords do not match.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Enter a display name with at least 2 characters.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: authCallback() },
      });
      if (error) {
        setError("Account creation could not be completed. Please try again or contact support.");
        return;
      }
      sessionStorage.setItem("bestottr-verification-email", email.trim());
      window.location.assign(data.session ? "/account" : "/verify-email");
    } catch {
      setError("Account creation is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthPage
      title="Create your account"
      description="Make a profile and bring your next project to bestottr."
    >
      <form onSubmit={submit} className="space-y-4">
        <Message error={error} />
        <Field label="Display name" hint="This is visible on your public profile.">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            required
            minLength={2}
            maxLength={60}
          />
        </Field>
        <Field label="Email address">
          <input
            className="field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
        </Field>
        <Field label="Password" hint="Use at least 12 characters. A unique passphrase works well.">
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
        </Field>
        <Field label="Confirm password">
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthPage>
  );
}
