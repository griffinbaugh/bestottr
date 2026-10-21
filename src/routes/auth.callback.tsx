import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completeEmailCallback } from "@/lib/email-auth";
import { AuthPage } from "@/components/account/AuthPage";
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Completing sign-in — bestottr" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Callback,
});
function Callback() {
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const url = new URL(window.location.href);
      try {
        const next = await completeEmailCallback(supabase.auth, url);
        window.history.replaceState({}, "", "/auth/callback");
        sessionStorage.removeItem("bestottr-verification-email");
        window.location.replace(next);
      } catch {
        window.history.replaceState({}, "", "/auth/callback");
        setError(
          "We couldn’t finish signing you in. If you already opened your confirmation email, try signing in with your email and password—your email may already be verified. For an expired reset link, request a new password reset.",
        );
      }
    })();
  }, []);
  return (
    <AuthPage
      title={error ? "Link not completed" : "One moment…"}
      description={error || "We’re completing your secure sign-in."}
    >
      {error ? (
        <div className="flex gap-5 text-sm">
          <Link to="/verify-email" className="underline">
            Verify email
          </Link>
          <Link to="/forgot-password" className="underline">
            Reset password
          </Link>
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          Checking your session…
        </p>
      )}
    </AuthPage>
  );
}
