import { z } from "zod";
import { parseDraftAsset, type DraftInput } from "./listing-drafts";
import { RobloxRateLimitError, retryAfterSeconds, type OwnershipStage } from "./roblox-rate-limit";

const apiId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String);
const groupSchema = z.object({
  id: apiId,
  name: z.string().min(1).max(200),
  owner: z.object({ userId: apiId }).nullable(),
});
const universeDetailsSchema = z.object({
  id: apiId,
  name: z.string().min(1).max(200),
  rootPlaceId: apiId,
  creatorType: z.enum(["User", "Group"]),
  creatorTargetId: apiId,
});

/** Fresh authoritative lookup. No demo fixtures, browser-supplied identity, roles, or fallback ownership. */
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
  const json = async (endpoint: string, stage: OwnershipStage) => {
    let r: Response;
    try {
      r = await request(endpoint, {
        headers: { accept: "application/json" },
        // Workers supports manual/follow only. Reject redirects via the non-2xx check below.
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
      });
    } catch (error) {
      const code =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
          ? "TIMEOUT"
          : "NETWORK";
      console.warn("Roblox ownership request failed", { stage, code });
      throw new Error(
        `Roblox could not be reached. Try again shortly. Reference: RBX-${stage}-${code}.`,
      );
    }
    if (!r.ok) {
      // Log only fixed endpoint identifiers and response status, never sessions or response bodies.
      console.warn("Roblox ownership request failed", { stage, status: r.status });
      if (r.status === 429)
        throw new RobloxRateLimitError(stage, retryAfterSeconds(r.headers.get("retry-after")));
      throw new Error(
        `Roblox is unavailable or this asset could not be read. Try again shortly. Reference: RBX-${stage}-${r.status}.`,
      );
    }
    return r.json() as Promise<unknown>;
  };
  const group = async (groupId: string) => {
    const g = groupSchema.parse(
      await json(`https://groups.roblox.com/v1/groups/${groupId}`, "GROUP"),
    );
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
    .parse(await json(`https://apis.roblox.com/universes/v1/places/${inputId}/universe`, "PLACE"));
  // games/v1 replaces private/content-restricted experiences with zero-ID placeholders.
  // The documented public universe-details endpoint supplies creator identity for private drafts.
  const game = universeDetailsSchema.parse(
    await json(`https://develop.roblox.com/v1/universes/${universe.universeId}`, "UNIVERSE"),
  );
  if (game.id !== universe.universeId)
    throw new Error("Roblox returned a different experience. Try again.");
  if (game.creatorType === "Group") await group(game.creatorTargetId);
  else if (game.creatorTargetId !== linkedUserId)
    throw new Error("Your connected Roblox account does not own this experience.");
  return {
    kind,
    asset_id: game.id,
    place_id: game.rootPlaceId,
    creator_type: game.creatorType,
    creator_id: game.creatorTargetId,
    asset_name: game.name,
    roblox_user_id: linkedUserId,
    ownership_checked_at: new Date().toISOString(),
  };
}
