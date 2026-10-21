import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getAccountServices = createServerFn({ method: "GET" }).handler(async () => {
  const { robloxConfigured } = await import("./account.server");
  return { roblox: robloxConfigured(), payments: false, payouts: false, trading: false };
});
export const startRobloxConnection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(20).max(10000) }))
  .handler(async ({ data }) => {
    const { verifiedAccount, robloxConfigured, siteOrigin } = await import("./account.server");
    const { setCookie, getRequest } = await import("@tanstack/react-start/server");
    if (new URL(getRequest().url).origin !== siteOrigin())
      return { ok: false as const, error: "Connect Roblox from the main bestottr website." };
    const { newOAuthFlow, sealFlow } = await import("./oauth-state.server");
    if (!robloxConfigured())
      return {
        ok: false as const,
        error: "Roblox connection is not available yet. Please try again later.",
      };
    await verifiedAccount(data.token);
    const { flow, challenge } = await newOAuthFlow(data.token);
    const cookie = await sealFlow(flow, process.env["ROBLOX_OAUTH_STATE_SECRET"]!);
    if (cookie.length > 3800)
      return {
        ok: false as const,
        error: "Your session is too large to connect securely. Please contact support.",
      };
    // Secure, HTTP-only and bound to this browser's provider callback.
    setCookie("__Secure-bestottr-roblox", cookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/roblox/callback",
      maxAge: 300,
    });
    const url = new URL("https://apis.roblox.com/oauth/v1/authorize");
    url.search = new URLSearchParams({
      client_id: process.env["ROBLOX_CLIENT_ID"]!,
      redirect_uri: siteOrigin() + "/api/roblox/callback",
      response_type: "code",
      scope: "openid profile",
      state: flow.state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account consent",
    }).toString();
    return { ok: true as const, url: url.href };
  });
