import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  verifiedAccount: vi.fn(),
  verifyDraftOwnership: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  filters: [] as [string, unknown][],
  existing: false,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (schema: { parse: (x: unknown) => unknown }) => ({
      handler: (handler: (args: { data: unknown }) => unknown) => (args: { data: unknown }) =>
        handler({ data: schema.parse(args.data) }),
    }),
  }),
}));
vi.mock("./account.server", () => ({ verifiedAccount: mocks.verifiedAccount }));
vi.mock("./listing-assets.server", () => ({ deleteDraftAssets: vi.fn() }));
vi.mock("./listing-draft-verifier.server", () => ({
  verifyListingDraftOwnership: mocks.verifyDraftOwnership,
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { getListingDrafts, saveListingDraft, deleteListingDraft } from "./listing-drafts.functions";
import { RobloxRateLimitError } from "./roblox-rate-limit";
const token = "test-session-token-not-a-real-key";
const id = "aa000000-0000-4000-8000-000000000001";
const input = {
  kind: "experience" as const,
  url: "https://www.roblox.com/games/100",
  title: "My game",
  description: "",
  format: "buy_now" as const,
  priceCents: 101,
  reserveCents: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.filters = [];
  mocks.existing = false;
  mocks.verifiedAccount.mockResolvedValue({ id: "server-user" });
  mocks.verifyDraftOwnership.mockResolvedValue({
    kind: "experience",
    asset_id: "200",
    place_id: "100",
    creator_type: "User",
    creator_id: "42",
    asset_name: "Game",
    roblox_user_id: "42",
    ownership_checked_at: "2026-10-21T18:00:00Z",
  });
  mocks.from.mockImplementation((table: string) => {
    const builder: any = {
      select: () => builder,
      eq: (field: string, value: unknown) => {
        mocks.filters.push([field, value]);
        return builder;
      },
      insert: (row: unknown) => {
        mocks.insert(row);
        return builder;
      },
      update: (row: unknown) => {
        mocks.update(row);
        return builder;
      },
      delete: () => builder,
      order: async () => ({ data: [], error: null }),
      single: async () => ({
        data: table === "roblox_accounts" ? { roblox_user_id: "42" } : { id },
        error: null,
      }),
      maybeSingle: async () => ({
        data: mocks.existing ? { id, kind: "experience" } : null,
        error: null,
      }),
      then: (resolve: (x: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return builder;
  });
});
describe("Draft server authorization", () => {
  it("returns the provider cooldown to the editor without writing a draft", async () => {
    mocks.verifyDraftOwnership.mockRejectedValue(new RobloxRateLimitError("GROUP", 90));
    expect(await saveListingDraft({ data: { token, draft: input } })).toMatchObject({
      ok: false,
      retryAfterSeconds: 90,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects an invalid or unverified session before any privileged database access", async () => {
    mocks.verifiedAccount.mockRejectedValue(new Error("Not signed in"));
    await expect(saveListingDraft({ data: { token, draft: input } })).rejects.toThrow(
      "Not signed in",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("filters both reads and deletes by the authenticated server identity", async () => {
    await getListingDrafts({ data: { token } });
    expect(mocks.filters).toContainEqual(["seller_id", "server-user"]);
    mocks.filters = [];
    await deleteListingDraft({ data: { token, id } });
    expect(mocks.filters).toContainEqual(["id", id]);
    expect(mocks.filters).toContainEqual(["seller_id", "server-user"]);
  });
  it("does not let an account edit someone else's draft", async () => {
    const r = await saveListingDraft({ data: { token, draft: { ...input, id } } });
    expect(r.ok).toBe(false);
    expect(mocks.filters).toContainEqual(["seller_id", "server-user"]);
    expect(mocks.verifyDraftOwnership).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("ignores forged seller, owner and verification fields from the client", async () => {
    const r = await saveListingDraft({
      data: {
        token,
        draft: {
          ...input,
          seller_id: "attacker",
          roblox_user_id: "attacker",
          ownership_checked_at: "forged",
        } as typeof input,
      },
    });
    expect(r.ok).toBe(true);
    expect(mocks.verifyDraftOwnership).toHaveBeenCalledWith("experience", input.url, "42");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        seller_id: "server-user",
        roblox_user_id: "42",
        ownership_checked_at: "2026-10-21T18:00:00Z",
        price_cents: 101,
      }),
    );
  });
  it("writes nothing if Roblox ownership cannot be proved", async () => {
    mocks.verifyDraftOwnership.mockRejectedValue(new Error("Not the owner"));
    expect(await saveListingDraft({ data: { token, draft: input } })).toMatchObject({
      ok: false,
      error: "Not the owner",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

it("saves file drafts without claiming Roblox ownership", async () => {
  const r = await saveListingDraft({
    data: { token, draft: { ...input, kind: "file", url: "", roblox_user_id: "forged" } as any },
  });
  expect(r.ok).toBe(true);
  expect(mocks.verifyDraftOwnership).not.toHaveBeenCalled();
  expect(mocks.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "file",
      asset_id: null,
      creator_id: null,
      roblox_user_id: null,
      ownership_checked_at: null,
    }),
  );
});
it("rejects past auction timestamps on the server before checking Roblox", async () => {
  const r = await saveListingDraft({
    data: { token, draft: { ...input, format: "auction", auctionEndsAt: Date.now() - 1 } },
  });
  expect(r).toMatchObject({ ok: false, error: "Choose an auction end in the future." });
  expect(mocks.verifyDraftOwnership).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("stores absolute auction time and clears it for fixed price", async () => {
  const ends = Date.now() + 86400000;
  await saveListingDraft({
    data: { token, draft: { ...input, format: "auction", auctionEndsAt: ends } },
  });
  expect(mocks.insert).toHaveBeenLastCalledWith(expect.objectContaining({ auction_ends_at: ends }));
  await saveListingDraft({ data: { token, draft: { ...input, auctionEndsAt: ends } } });
  expect(mocks.insert).toHaveBeenLastCalledWith(expect.objectContaining({ auction_ends_at: null }));
});
