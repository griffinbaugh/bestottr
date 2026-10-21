import { describe, expect, it, vi } from "vitest";
import { createDraftVerifier } from "./listing-draft-verifier.server";
import { RobloxRateLimitError, retryAfterSeconds } from "./roblox-rate-limit";
import { verifyDraftOwnership } from "./listing-ownership.server";
const url = "https://www.roblox.com/games/100/Game";
const proof = {
  kind: "experience" as const,
  asset_id: "200",
  place_id: "100",
  creator_type: "User" as const,
  creator_id: "42",
  asset_name: "Game",
  roblox_user_id: "42",
  ownership_checked_at: "2026-10-21T21:00:00Z",
};
describe("Private draft request gate", () => {
  it("shares concurrent lookups and brief repeat edits, preserving the observation timestamp", async () => {
    const verify = vi.fn(async () => ({ ...proof }));
    const gate = createDraftVerifier(verify, () => 0);
    const results = await Promise.all([
      gate("experience", url, "42"),
      gate("experience", url, "42"),
    ]);
    expect(verify).toHaveBeenCalledTimes(1);
    results[0]!.asset_name = "Changed by caller";
    expect(await gate("experience", url + "?tracking=test", "42")).toEqual(proof);
    expect(verify).toHaveBeenCalledTimes(1);
  });
  it("never reuses another linked account's proof", async () => {
    const verify = vi.fn(async () => ({ ...proof }));
    const gate = createDraftVerifier(verify, () => 0);
    await gate("experience", url, "42");
    await gate("experience", url, "43");
    expect(verify).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenLastCalledWith("experience", url, "43");
  });
  it("requires a new check after 15 seconds and does not fall back to expired ownership", async () => {
    let now = 0;
    const verify = vi.fn(async () => ({ ...proof }));
    const gate = createDraftVerifier(verify, () => now);
    await gate("experience", url, "42");
    now = 15_000;
    verify.mockRejectedValue(new Error("Ownership changed"));
    await expect(gate("experience", url, "42")).rejects.toThrow("Ownership changed");
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it("honors provider cooldown without issuing more requests or serving an earlier proof", async () => {
    let now = 0;
    const verify = vi.fn(async () => ({ ...proof }));
    const gate = createDraftVerifier(verify, () => now);
    await gate("experience", url, "42");
    verify.mockRejectedValueOnce(new RobloxRateLimitError("GROUP", 90));
    await expect(gate("community", "https://roblox.com/communities/300", "42")).rejects.toThrow(
      "90 seconds",
    );
    now = 5_000;
    await expect(gate("experience", url, "42")).rejects.toThrow("85 seconds");
    expect(verify).toHaveBeenCalledTimes(2);
    now = 90_000;
    expect(await gate("experience", url, "42")).toEqual(proof);
    expect(verify).toHaveBeenCalledTimes(3);
  });
  it("does not remember failed ownership as success", async () => {
    const verify = vi.fn(async () => {
      throw new Error("Not owner");
    });
    const gate = createDraftVerifier(verify, () => 0);
    await expect(gate("experience", url, "42")).rejects.toThrow();
    await expect(gate("experience", url, "42")).rejects.toThrow();
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it("bounds retained successes", async () => {
    const verify = vi.fn(async () => ({ ...proof }));
    const gate = createDraftVerifier(verify, () => 0, 2);
    for (const id of [100, 101, 102, 100])
      await gate("experience", `https://roblox.com/games/${id}`, "42");
    expect(verify).toHaveBeenCalledTimes(4);
  });
});
describe("Roblox retry timing", () => {
  it("accepts Retry-After seconds and HTTP dates and defaults missing/invalid headers to 60 seconds", () => {
    expect(retryAfterSeconds("90")).toBe(90);
    expect(retryAfterSeconds("3.1")).toBe(4);
    expect(
      retryAfterSeconds("Wed, 21 Oct 2026 21:01:30 GMT", Date.parse("2026-10-21T21:00:00Z")),
    ).toBe(90);
    for (const value of [null, "", "garbage", "-100", "Infinity"])
      expect(retryAfterSeconds(value)).toBe(60);
  });
  it("carries Roblox's actual wait duration to the server function", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const request = vi.fn(
        async () => new Response(null, { status: 429, headers: { "Retry-After": "90" } }),
      );
      await expect(
        verifyDraftOwnership("community", "https://roblox.com/communities/300", "42", request),
      ).rejects.toMatchObject({ stage: "GROUP", retryAfterSeconds: 90 });
    } finally {
      log.mockRestore();
    }
  });
});
