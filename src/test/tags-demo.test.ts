import { describe, expect, it } from "vitest";
import { DEMO_OWNED_URL, DEMO_URLS, DEMO_USER_ID, DEMO_USERNAME, verifyOwnership } from "@/lib/roblox";
import { MAX_TAGS, suggestTags, toggleTag } from "@/lib/tags";

describe("demo owned experience URL", () => {
  it("passes for the demo account as user-owned by it", () => {
    const r = verifyOwnership(DEMO_OWNED_URL, { connected: true, username: DEMO_USERNAME, userId: DEMO_USER_ID });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.exp.creatorType).toBe("User");
      expect(r.exp.creatorName).toBe(DEMO_USERNAME);
    }
  });
  it("fails for a different account", () => {
    expect(verifyOwnership(DEMO_OWNED_URL, { connected: true, username: "other", userId: "99999" })).toEqual({ ok: false, reason: "not_owner" });
  });
  it("group-owner demo still passes", () => {
    const group = DEMO_URLS.find((u) => u.includes("2711356802"))!;
    const r = verifyOwnership(group, { connected: true, userId: DEMO_USER_ID });
    expect(r.ok && r.via).toBe("Bricklane Interactive");
  });
});

describe("experience tags", () => {
  it("coast guard roleplay suggests emergency/naval tags", () => {
    const t = suggestTags({ genre: "Roleplay", title: "Coast Guard Roleplay", description: "Rescue boats along an open world coast" });
    for (const x of ["Roleplay", "Emergency Services", "Naval", "Vehicles", "Open World", "Multiplayer"]) expect(t).toContain(x);
  });
  it("farming simulator suggests farming tags", () => {
    const t = suggestTags({ genre: "Simulator", title: "Farm Simulator", tagline: "Harvest and collect crops" });
    for (const x of ["Simulator", "Farming", "Casual", "Collecting"]) expect(t).toContain(x);
  });
  it("enforces max of 8 tags", () => {
    expect(MAX_TAGS).toBe(8);
    const full = ["A", "B", "C", "D", "E", "F", "G", "H"];
    expect(toggleTag(full, "Z")).toBeNull();
    expect(toggleTag(full, "A")).toHaveLength(7);
  });
});
