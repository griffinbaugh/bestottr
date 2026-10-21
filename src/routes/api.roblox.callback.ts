import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/roblox/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getCookie, setCookie } = await import("@tanstack/react-start/server");
        const { openFlow } = await import("@/lib/oauth-state.server");
        const { verifiedAccount, siteOrigin, robloxConfigured } =
          await import("@/lib/account.server");
        const cookie = getCookie("__Secure-bestottr-roblox");
        setCookie("__Secure-bestottr-roblox", "", {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/api/roblox/callback",
          maxAge: 0,
        });
        const result = new URL("/account/connections", siteOrigin());
        try {
          if (!cookie || !robloxConfigured()) throw new Error("not_configured");
          const flow = await openFlow(cookie, process.env["ROBLOX_OAUTH_STATE_SECRET"]!);
          const query = new URL(request.url).searchParams;
          if (query.get("state") !== flow.state || query.has("error")) throw new Error("cancelled");
          const code = query.get("code");
          if (!code || code.length > 2048) throw new Error("invalid_code");
          const user = await verifiedAccount(flow.token);
          const response = await fetch("https://apis.roblox.com/oauth/v1/token", {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env["ROBLOX_CLIENT_ID"]!,
              client_secret: process.env["ROBLOX_CLIENT_SECRET"]!,
              grant_type: "authorization_code",
              code,
              code_verifier: flow.verifier,
              redirect_uri: siteOrigin() + "/api/roblox/callback",
            }),
          });
          if (!response.ok) throw new Error("exchange_failed");
          const tokens = (await response.json()) as {
            access_token?: string;
            refresh_token?: string;
          };
          if (!tokens.access_token) throw new Error("exchange_failed");
          try {
            const info = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
              headers: { Authorization: `Bearer ${tokens.access_token}` },
              signal: AbortSignal.timeout(15000),
            });
            if (!info.ok) throw new Error("profile_failed");
            const identity = (await info.json()) as {
              sub?: string;
              preferred_username?: string;
              name?: string;
            };
            if (!identity.sub || !/^\d{1,20}$/.test(identity.sub) || !identity.preferred_username)
              throw new Error("profile_failed");
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            // Identity comes only from Roblox OAuth, never a user-entered username/ID.
            const { error } = await supabaseAdmin.from("roblox_accounts").upsert(
              {
                user_id: user.id,
                roblox_user_id: identity.sub,
                username: identity.preferred_username,
                display_name: identity.name || identity.preferred_username,
                verified_at: new Date().toISOString(),
              },
              { onConflict: "user_id" },
            );
            if (error) throw new Error(error.code === "23505" ? "already_linked" : "save_failed");
          } finally {
            // We only need proof of identity. Do not retain provider access/refresh tokens.
            if (tokens.refresh_token)
              await fetch("https://apis.roblox.com/oauth/v1/token/revoke", {
                method: "POST",
                signal: AbortSignal.timeout(5000),
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  token: tokens.refresh_token,
                  client_id: process.env["ROBLOX_CLIENT_ID"]!,
                  client_secret: process.env["ROBLOX_CLIENT_SECRET"]!,
                }),
              }).catch(() => {});
          }
          result.searchParams.set("roblox", "connected");
        } catch {
          result.searchParams.set("roblox", "failed");
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
