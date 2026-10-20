import { describe, expect, it } from "vitest";
import { parseRobloxProfileUrl } from "@/lib/roblox";
import {
  applyCheck, cancelTransfer, chooseTarget, confirmTarget, createTransfer, fundTransfer, markTransferStarted,
  requestExtension, tick, TRANSFER_WINDOW_MS, EXTENSION_MS, type AssetIdentity, type Observation, type ExperienceTransfer,
} from "@/lib/transfer";

const T0 = 1_000_000;
const userAsset: AssetIdentity = { placeId: "4920175538", universeId: "1702934411", groupId: null, mode: "user", originalOwnerId: "24816309", originalOwnerName: "alexr_dev", demo: true };
const groupAsset: AssetIdentity = { ...userAsset, placeId: "2711356802", universeId: "1702934413", groupId: "3310001", mode: "group" };
const target = { userId: "55018342", username: "alexr_studio", displayName: "Alt", profileUrl: "https://www.roblox.com/users/55018342/profile", avatarUrl: null, source: "profile_url" as const };

function funded(asset = userAsset): ExperienceTransfer {
  let t = createTransfer("d1", asset, 1000, T0);
  t = chooseTarget(t, target, T0).t;
  t = confirmTarget(t, T0).t;
  return fundTransfer(t, T0).t;
}
const obs = (o: Partial<Observation>, at = T0 + 1000): { observation: Observation } => ({
  observation: { placeId: "4920175538", universeId: "1702934411", creatorType: "User", creatorId: "55018342", groupOwnerId: null, source: "demo", checkedAt: at, ...o },
});

describe("destination profile parsing", () => {
  it("accepts profile URLs and normalizes", () => {
    expect(parseRobloxProfileUrl("roblox.com/users/55018342/profile")).toEqual({ ok: true, userId: "55018342", profileUrl: "https://www.roblox.com/users/55018342/profile" });
  });
  it.each([
    ["https://evil.com/users/1/profile", "invalid_url"],
    ["https://www.roblox.com/games/4920175538/x", "not_profile"],
    ["https://www.roblox.com/groups/3310001/x", "not_profile"],
    ["alexr_dev", "username_only"],
    ["https://www.roblox.com/users/abc/profile", "not_profile"],
  ])("rejects %s", (u, reason) => expect(parseRobloxProfileUrl(u)).toEqual({ ok: false, reason }));
});

describe("transfer state machine", () => {
  it("requires confirmed target before funding and locks it after", () => {
    const t = chooseTarget(createTransfer("d1", userAsset, 1000, T0), target, T0).t;
    expect(fundTransfer(t, T0).ok).toBe(false);
    const f = funded();
    expect(f.expiresAt).toBe(T0 + TRANSFER_WINDOW_MS);
    expect(chooseTarget(f, { ...target, userId: "1" }, T0).ok).toBe(false);
  });
  it("seller claim never releases funds", () => {
    const t = markTransferStarted(funded(), T0).t;
    expect(t.payment.status).toBe("held");
  });
  it("exact user owner pays out exactly once; repeats do not double pay", () => {
    let t = applyCheck(funded(), obs({}), T0 + 2000).t;
    expect(t.state).toBe("completed");
    t = applyCheck(t, obs({}), T0 + 3000).t;
    expect(t.payment.releaseCount).toBe(1);
  });
  it("wrong user or substituted universe does not succeed", () => {
    expect(applyCheck(funded(), obs({ creatorId: "999" }), T0).t.payment.status).toBe("held");
    expect(applyCheck(funded(), obs({ universeId: "1" }), T0).t.payment.status).toBe("held");
  });
  it("group: exact owner succeeds, member/admin (owner unchanged) or other group does not", () => {
    const g = (o: Partial<Observation>) => obs({ placeId: "2711356802", universeId: "1702934413", creatorType: "Group", creatorId: "3310001", ...o });
    expect(applyCheck(funded(groupAsset), g({ groupOwnerId: "24816309" }), T0).t.state).not.toBe("completed");
    expect(applyCheck(funded(groupAsset), g({ creatorId: "42", groupOwnerId: "55018342" }), T0).t.state).not.toBe("completed");
    expect(applyCheck(funded(groupAsset), g({ groupOwnerId: "55018342" }), T0).t.state).toBe("completed");
  });
  it("expiry refunds exactly once and blocks later payout", () => {
    const end = T0 + TRANSFER_WINDOW_MS;
    let t = tick(funded(), end, () => obs({}, end)).t;
    expect(t.state).toBe("refunded");
    t = applyCheck(t, obs({}, end - 1), end + 5).t;
    expect(t.payment.refundCount).toBe(1);
    expect(t.payment.releaseCount).toBe(0);
  });
  it("race: observation before deadline wins even if processed after", () => {
    const end = T0 + TRANSFER_WINDOW_MS;
    const t = applyCheck(funded(), obs({}, end - 1), end + 10).t;
    expect(t.state).toBe("completed");
    expect(t.payment.refundCount).toBe(0);
  });
  it("API errors retry without moving funds; provider failure stays recoverable", () => {
    const e = applyCheck(funded(), { error: "timeout", checkedAt: T0 }, T0).t;
    expect(e.payment.status).toBe("held");
    expect(e.verification.consecutiveErrors).toBe(1);
    const f = funded();
    const r = applyCheck({ ...f, payment: { ...f.payment, failNext: "release" } }, obs({}), T0).t;
    expect(r.state).toBe("payout_releasing");
    expect(tick(r, T0 + 5000, () => obs({})).t.state).toBe("completed");
  });
  it("cancellation rules", () => {
    expect(cancelTransfer(funded(), "buyer", T0).t.state).toBe("refunded");
    expect(cancelTransfer(markTransferStarted(funded(), T0).t, "buyer", T0).ok).toBe(false);
  });
  it("one mutually approved 24h extension", () => {
    let t = requestExtension(funded(), "buyer", T0).t;
    expect(t.expiresAt).toBe(T0 + TRANSFER_WINDOW_MS);
    t = requestExtension(t, "seller", T0).t;
    expect(t.expiresAt).toBe(T0 + TRANSFER_WINDOW_MS + EXTENSION_MS);
    expect(requestExtension(t, "buyer", T0).ok).toBe(false);
  });
});
