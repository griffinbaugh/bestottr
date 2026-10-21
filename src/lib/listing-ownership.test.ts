import { describe, it, expect, vi } from "vitest";
import { verifyDraftOwnership } from "./listing-ownership.server";
import { parseDraftAsset, draftFields } from "./listing-drafts";

const gameLink = "https://www.roblox.com/games/100/Game";
const groupLink = "https://www.roblox.com/communities/300/Group";
function requestFor(type = "User", owner = 42, groupOwner: number | null = 42) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/places/100/universe")) return Response.json({ universeId: 200 });
    if (url.includes("games?universeIds=200"))
      return Response.json({
        data: [
          {
            id: 200,
            name: "My game",
            rootPlaceId: 100,
            creator: { id: type === "Group" ? 300 : owner, type },
          },
        ],
      });
    if (url.includes("/groups/300"))
      return Response.json({
        id: 300,
        name: "My group",
        owner: groupOwner === null ? null : { userId: groupOwner },
      });
    return new Response(null, { status: 404 });
  });
}
describe("Production listing ownership", () => {
  it("uses Cloudflare-compatible manual redirects on every API request", async () => {
    const fixture = requestFor("Group");
    const request: typeof fetch = async (input, init) => {
      if (init?.redirect === "error") throw new TypeError("Unsupported redirect mode in Workers");
      expect(init?.redirect).toBe("manual");
      return fixture(input);
    };
    await expect(
      verifyDraftOwnership("experience", gameLink, "42", request),
    ).resolves.toMatchObject({ asset_id: "200" });
    expect(fixture).toHaveBeenCalledTimes(3);
  });
  it.each([301, 302, 303, 307, 308])(
    "rejects an upstream %i redirect without following it",
    async (status) => {
      const request = vi.fn(
        async () =>
          new Response(null, { status, headers: { Location: "https://example.invalid/" } }),
      );
      await expect(verifyDraftOwnership("experience", gameLink, "42", request)).rejects.toThrow(
        "Roblox is unavailable",
      );
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("accepts direct ownership only for the server's linked identity", async () => {
    const r = await verifyDraftOwnership("experience", gameLink, "42", requestFor());
    expect(r).toMatchObject({
      asset_id: "200",
      place_id: "100",
      creator_id: "42",
      roblox_user_id: "42",
      creator_type: "User",
    });
    await expect(verifyDraftOwnership("experience", gameLink, "43", requestFor())).rejects.toThrow(
      "does not own",
    );
  });
  it("accepts group-owned games only for the actual group owner", async () => {
    expect(
      await verifyDraftOwnership("experience", gameLink, "42", requestFor("Group")),
    ).toMatchObject({ creator_type: "Group", creator_id: "300" });
    await expect(
      verifyDraftOwnership("experience", gameLink, "42", requestFor("Group", 42, 43)),
    ).rejects.toThrow("must own");
  });
  it("does not accept roles or ownerless groups", async () => {
    await expect(
      verifyDraftOwnership("community", groupLink, "42", requestFor("Group", 42, null)),
    ).rejects.toThrow("must own");
    const request = vi.fn(async () =>
      Response.json({
        id: 300,
        name: "Group",
        owner: { userId: 43 },
        roles: [{ userId: 42, rank: 255 }],
      }),
    );
    await expect(verifyDraftOwnership("community", groupLink, "42", request)).rejects.toThrow(
      "must own",
    );
  });
  it("stores the group ID rather than pretending it is a place", async () => {
    expect(await verifyDraftOwnership("community", groupLink, "42", requestFor())).toMatchObject({
      kind: "community",
      asset_id: "300",
      place_id: null,
    });
  });
  it("rechecks remote ownership on every save without cached successes", async () => {
    const request = requestFor();
    await verifyDraftOwnership("experience", gameLink, "42", request);
    request.mockImplementation(async () => new Response(null, { status: 503 }));
    await expect(verifyDraftOwnership("experience", gameLink, "42", request)).rejects.toThrow(
      "unavailable",
    );
  });
  it("rejects malformed, unsafe or unexpected Roblox responses", async () => {
    for (const body of [{ universeId: 200.5 }, { universeId: 9007199254740992 }, {}]) {
      await expect(
        verifyDraftOwnership(
          "experience",
          gameLink,
          "42",
          vi.fn(async () => Response.json(body)),
        ),
      ).rejects.toThrow();
    }
    const r = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/places/")
        ? Response.json({ universeId: 200 })
        : Response.json({
            data: [{ id: 201, rootPlaceId: 100, name: "Wrong", creator: { type: "User", id: 42 } }],
          }),
    );
    await expect(verifyDraftOwnership("experience", gameLink, "42", r)).rejects.toThrow(
      "different experience",
    );
    await expect(
      verifyDraftOwnership(
        "community",
        groupLink,
        "42",
        vi.fn(async () => Response.json({ id: 301, name: "Wrong", owner: { userId: 42 } })),
      ),
    ).rejects.toThrow("different community");
  });
  it("rejects unknown creator types", async () => {
    await expect(
      verifyDraftOwnership("experience", gameLink, "42", requestFor("Unknown")),
    ).rejects.toThrow();
  });
  it("never sends requests to arbitrary pasted URLs or falls back to demo ownership", async () => {
    const request = requestFor();
    await expect(
      verifyDraftOwnership("experience", "https://localhost/games/100", "42", request),
    ).rejects.toThrow("Paste a full");
    expect(request).not.toHaveBeenCalled();
  });
});
describe("Draft input", () => {
  it("accepts public game and community links while separating place and universe IDs", () => {
    expect(parseDraftAsset("experience", gameLink + "?test=1")).toBe("100");
    expect(parseDraftAsset("community", "https://roblox.com/groups/300/")).toBe("300");
    expect(
      parseDraftAsset(
        "experience",
        "https://create.roblox.com/dashboard/creations/experiences/200",
      ),
    ).toBeNull();
  });
  it.each([
    "http://www.roblox.com/games/100",
    "https://www.roblox.com.evil.test/games/100",
    "https://name:pass@www.roblox.com/games/100",
    "https://www.roblox.com:123/games/100",
    "https://www.roblox.com/games/0",
    "https://www.roblox.com/games/100evil",
  ])("rejects unsafe link %s", (url) => {
    expect(parseDraftAsset("experience", url)).toBeNull();
  });
  it("rejects fractional cents and reserves below starting bid", () => {
    const base = {
      kind: "experience",
      url: gameLink,
      title: "Game",
      description: "",
      format: "auction",
      priceCents: 101,
      reserveCents: 100,
    };
    expect(draftFields.safeParse(base).success).toBe(false);
    expect(draftFields.safeParse({ ...base, priceCents: 100, reserveCents: 101 }).success).toBe(
      true,
    );
    expect(draftFields.safeParse({ ...base, priceCents: 0.1, reserveCents: null }).success).toBe(
      false,
    );
  });
});
