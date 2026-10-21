import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeReturnTo } from "@/lib/account";
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
      const hash = new URLSearchParams(url.hash.slice(1));
      const recovery =
        hash.get("type") === "recovery" || url.searchParams.get("type") === "recovery";
      const next = recovery ? "/reset-password" : safeReturnTo(url.searchParams.get("next"));
      try {
        if (url.searchParams.has("error") || hash.has("error"))
          throw new Error("This authentication link is invalid or expired. Request a new link.");
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (url.searchParams.has("token_hash")) {
          const type = url.searchParams.get("type");
          if (!["signup", "recovery", "email_change", "email"].includes(type ?? ""))
            throw new Error("Unsupported confirmation link.");
          const { error } = await supabase.auth.verifyOtp({
            token_hash: url.searchParams.get("token_hash")!,
            type: type as "signup" | "recovery" | "email_change" | "email",
          });
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.getSession();
        window.history.replaceState({}, "", "/auth/callback");
        if (error || !data.session)
          throw new Error(
            "Your session could not be restored. Open a fresh link in the browser where you requested it.",
          );
        sessionStorage.removeItem("bestottr-verification-email");
        window.location.replace(next);
      } catch {
        window.history.replaceState({}, "", "/auth/callback");
        setError(
          "This link could not be completed. It may have expired or already been used. Request a fresh email confirmation or password reset.",
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
