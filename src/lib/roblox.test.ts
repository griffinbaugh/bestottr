import { describe, expect, it } from "vitest";
import { DEMO_URLS, parseRobloxPlaceId, verifyOwnership, DEMO_USER_ID } from "./roblox";

const me = { connected: true, username: "alexr_dev", userId: DEMO_USER_ID };

describe("parseRobloxPlaceId", () => {
  it("parses standard game URLs and ignores query/hash", () => {
    expect(parseRobloxPlaceId("https://www.roblox.com/games/1830291743/Sky-Kingdom-Builders?refPageId=x#y")).toBe("1830291743");
    expect(parseRobloxPlaceId("  roblox.com/games/1830291743  ")).toBe("1830291743");
  });
  it("parses creator dashboard experience links", () => {
    expect(parseRobloxPlaceId("https://create.roblox.com/dashboard/creations/experiences/1830291743/overview")).toBe("1830291743");
  });
  it("rejects non-Roblox and malformed URLs", () => {
    expect(parseRobloxPlaceId("https://example.com/games/1830291743")).toBeNull();
    expect(parseRobloxPlaceId("https://www.roblox.com/users/123/profile")).toBeNull();
    expect(parseRobloxPlaceId("not a url")).toBeNull();
    expect(parseRobloxPlaceId("")).toBeNull();
  });
});

describe("verifyOwnership", () => {
  it("passes when the connected user owns the experience directly", () => {
    const r = verifyOwnership(DEMO_URLS[0]!, me);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.via).toBeUndefined();
  });
  it("passes when the connected user owns the group that owns the experience", () => {
    const r = verifyOwnership(DEMO_URLS[1]!, me);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.via).toBe("Bricklane Interactive");
  });
  it("fails when another user owns the experience", () => {
    expect(verifyOwnership(DEMO_URLS[2]!, me)).toEqual({ ok: false, reason: "not_owner" });
  });
  it("fails when the connected user is only a group member/admin, not the owner", () => {
    expect(verifyOwnership(DEMO_URLS[3]!, me)).toEqual({ ok: false, reason: "not_group_owner" });
  });
  it("fails cleanly on invalid URLs and unknown experiences", () => {
    expect(verifyOwnership("https://example.com/games/1", me)).toEqual({ ok: false, reason: "invalid_url" });
    expect(verifyOwnership("https://www.roblox.com/games/9999999999/Nope", me)).toEqual({ ok: false, reason: "not_found" });
  });
  it("fails when no account is connected", () => {
    expect(verifyOwnership(DEMO_URLS[0]!, { connected: false })).toEqual({ ok: false, reason: "not_owner" });
  });
});
