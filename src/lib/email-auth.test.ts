import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { completeEmailCallback, EMAIL_AUTH_OPTIONS, type CallbackAuth } from "./email-auth";

function fakeAuth() {
  const auth = {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    setSession: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: "qa" } } }, error: null }),
  };
  return { auth, client: auth as unknown as CallbackAuth };
}
afterEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.clear();
});
describe("email callback credentials", () => {
  it("exchanges a code once and forwards its PKCE flow ID", async () => {
    const { auth, client } = fakeAuth();
    expect(
      await completeEmailCallback(
        client,
        new URL("https://bestottr.com/auth/callback?code=once&sb_flow_id=flow-1"),
      ),
    ).toBe("/account");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("once", {
      flowId: "flow-1",
    });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("routes recovery to reset and rejects external return URLs", async () => {
    const { client } = fakeAuth();
    expect(
      await completeEmailCallback(
        client,
        new URL("https://bestottr.com/auth/callback?code=once&next=/reset-password"),
      ),
    ).toBe("/reset-password");
    expect(
      await completeEmailCallback(
        client,
        new URL("https://bestottr.com/auth/callback?code=once&next=https://evil.example"),
      ),
    ).toBe("/account");
  });
  it("supports token-hash recovery links", async () => {
    const { auth, client } = fakeAuth();
    expect(
      await completeEmailCallback(
        client,
        new URL("https://bestottr.com/auth/callback?token_hash=hash&type=recovery"),
      ),
    ).toBe("/reset-password");
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      token_hash: "hash",
      type: "recovery",
    });
  });
  it("explicitly restores legacy fragment sessions with automatic detection disabled", async () => {
    const { auth, client } = fakeAuth();
    expect(
      await completeEmailCallback(
        client,
        new URL(
          "https://bestottr.com/auth/callback#access_token=access&refresh_token=refresh&type=recovery",
        ),
      ),
    ).toBe("/reset-password");
    expect(auth.setSession).toHaveBeenCalledExactlyOnceWith({
      access_token: "access",
      refresh_token: "refresh",
    });
  });
  it.each([
    "?error=access_denied",
    "#error=expired",
    "?token_hash=hash&type=invalid",
    "#access_token=partial",
    "",
  ])("does not accept an invalid link even with an existing session: %s", async (suffix) => {
    const { client } = fakeAuth();
    await expect(
      completeEmailCallback(client, new URL("https://bestottr.com/auth/callback" + suffix)),
    ).rejects.toThrow();
  });
  it("does not hide failed code exchanges behind an existing session", async () => {
    const { auth, client } = fakeAuth();
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("used code") });
    await expect(
      completeEmailCallback(client, new URL("https://bestottr.com/auth/callback?code=used")),
    ).rejects.toThrow("used code");
    expect(auth.getSession).not.toHaveBeenCalled();
  });
});

describe("real Supabase SDK callback initialization", () => {
  it("does not consume the callback code during global session initialization", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: "qa", exp: now + 3600, iat: now }))}.test`;
    const fetcher = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            access_token: token,
            refresh_token: "qa-refresh",
            token_type: "bearer",
            expires_in: 3600,
            user: {
              id: "qa",
              aud: "authenticated",
              role: "authenticated",
              created_at: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    window.history.replaceState({}, "", "/auth/callback?code=single-use");
    localStorage.setItem(
      "qa-email-session-code-verifier",
      JSON.stringify("a-pkce-verifier-for-the-test"),
    );
    const sb = createClient("https://auth-regression.supabase.co", "public-test-key", {
      auth: { ...EMAIL_AUTH_OPTIONS, storageKey: "qa-email-session", autoRefreshToken: false },
      global: { fetch: fetcher },
    });
    try {
      // AuthProvider initializes the shared client before the callback effect.
      await sb.auth.getSession();
      expect(fetcher).not.toHaveBeenCalled();
      expect(await completeEmailCallback(sb.auth, new URL(window.location.href))).toBe("/account");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect((await sb.auth.getSession()).data.session?.user.id).toBe("qa");
    } finally {
      sb.auth.stopAutoRefresh();
    }
  });
});
