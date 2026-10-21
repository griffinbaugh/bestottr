import { z } from "zod";
import { parseDraftAsset, type DraftInput } from "./listing-drafts";

const apiId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String);
const groupSchema = z.object({
  id: apiId,
  name: z.string().min(1).max(200),
  owner: z.object({ userId: apiId }).nullable(),
});
const gameSchema = z.object({
  id: apiId,
  name: z.string().min(1).max(200),
  rootPlaceId: apiId,
  creator: z.object({ id: apiId, type: z.enum(["User", "Group"]) }),
});

/** No demo fixtures, browser-supplied identity, group roles, or fallback ownership. Every save calls Roblox again. */
export async function verifyDraftOwnership(
  kind: DraftInput["kind"],
  url: string,
  linkedUserId: string,
  request: typeof fetch = fetch,
) {
  const inputId = parseDraftAsset(kind, url);
  if (!inputId)
    throw new Error(
      kind === "experience"
        ? "Paste a full https://www.roblox.com/games/… link."
        : "Paste a full Roblox community or group link.",
    );
  const json = async (endpoint: string) => {
    const r = await request(endpoint, {
      headers: { accept: "application/json" },
      // Workers supports manual/follow only. Reject redirects via the non-2xx check below.
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok)
      throw new Error("Roblox is unavailable or this asset is not public. Try again shortly.");
    return r.json() as Promise<unknown>;
  };
  const group = async (groupId: string) => {
    const g = groupSchema.parse(await json(`https://groups.roblox.com/v1/groups/${groupId}`));
    if (g.id !== groupId) throw new Error("Roblox returned a different community. Try again.");
    if (g.owner?.userId !== linkedUserId)
      throw new Error(
        "Your connected Roblox account must own this community. Admin roles and membership do not qualify.",
      );
    return g;
  };
  if (kind === "community") {
    const g = await group(inputId);
    return {
      kind,
      asset_id: g.id,
      place_id: null,
      creator_type: "Group" as const,
      creator_id: g.id,
      asset_name: g.name,
      roblox_user_id: linkedUserId,
      ownership_checked_at: new Date().toISOString(),
    };
  }
  const universe = z
    .object({ universeId: apiId })
    .parse(await json(`https://apis.roblox.com/universes/v1/places/${inputId}/universe`));
  const result = z
    .object({ data: z.array(gameSchema).length(1) })
    .parse(await json(`https://games.roblox.com/v1/games?universeIds=${universe.universeId}`));
  const game = result.data[0]!;
  if (game.id !== universe.universeId)
    throw new Error("Roblox returned a different experience. Try again.");
  if (game.creator.type === "Group") await group(game.creator.id);
  else if (game.creator.id !== linkedUserId)
    throw new Error("Your connected Roblox account does not own this experience.");
  return {
    kind,
    asset_id: game.id,
    place_id: game.rootPlaceId,
    creator_type: game.creator.type,
    creator_id: game.creator.id,
    asset_name: game.name,
    roblox_user_id: linkedUserId,
    ownership_checked_at: new Date().toISOString(),
  };
}
