import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/trustap/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getCookie, setCookie } = await import("@tanstack/react-start/server");
        const { openFlow } = await import("@/lib/oauth-state.server");
        const { verifiedAccount, siteOrigin } = await import("@/lib/account.server");
        const { oauthConfig, completeTrustapConnection } =
          await import("@/lib/trustap-oauth.server");
        const cookie = getCookie("__Secure-bestottr-trustap");
        setCookie("__Secure-bestottr-trustap", "", {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/api/trustap/callback",
          maxAge: 0,
        });
        const result = new URL("/account/payments", siteOrigin());
        try {
          if (!cookie) throw new Error("missing_flow");
          const config = oauthConfig();
          const flow = await openFlow(
            cookie,
            config.stateSecret,
            Date.now(),
            "bestottr-trustap-v1",
          );
          const q = new URL(request.url).searchParams,
            code = q.get("code");
          if (q.get("state") !== flow.state || q.has("error") || !code || code.length > 2048)
            throw new Error("invalid_callback");
          const user = await verifiedAccount(flow.token);
          const sub = await completeTrustapConnection(flow, code, siteOrigin());
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const old = await db
            .from("trustap_sandbox_accounts")
            .select("provider_user_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (old.error || (old.data && old.data.provider_user_id !== sub))
            throw new Error("identity_change_requires_support");
          const saved = await db.from("trustap_sandbox_accounts").upsert({
            user_id: user.id,
            provider_user_id: sub,
            connected_at: new Date().toISOString(),
          });
          if (saved.error) throw new Error("save_failed");
          result.searchParams.set("trustap", "connected");
        } catch {
          result.searchParams.set("trustap", "failed");
        }
        return new Response(null, {
          status: 303,
          headers: {
            Location: result.href,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      },
    },
  },
});
