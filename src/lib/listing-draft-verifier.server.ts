import { verifyDraftOwnership } from "./listing-ownership.server";
import { parseDraftAsset, type DraftInput } from "./listing-drafts";
import { RobloxRateLimitError } from "./roblox-rate-limit";

type Proof = Awaited<ReturnType<typeof verifyDraftOwnership>>;
type Verify = (kind: DraftInput["kind"], url: string, linkedUserId: string) => Promise<Proof>;

/** Private drafts only. Publication/settlement must obtain a new authoritative check. */
export function createDraftVerifier(
  verify: Verify = verifyDraftOwnership,
  now = Date.now,
  maxEntries = 128,
) {
  const successes = new Map<string, { proof: Proof; expires: number }>();
  const pending = new Map<string, Promise<Proof>>();
  let blocked: { until: number; stage: RobloxRateLimitError["stage"] } | null = null;
  return async (kind: DraftInput["kind"], url: string, linkedUserId: string): Promise<Proof> => {
    const asset = parseDraftAsset(kind, url);
    if (!asset) return verify(kind, url, linkedUserId);
    if (blocked && blocked.until > now()) {
      throw new RobloxRateLimitError(blocked.stage, Math.ceil((blocked.until - now()) / 1000));
    }
    const key = `${linkedUserId}:${kind}:${asset}`;
    const hit = successes.get(key);
    if (hit && hit.expires > now()) return { ...hit.proof };
    successes.delete(key);
    let task = pending.get(key);
    if (!task) {
      // Bound both maps even if a client sends many distinct asset IDs.
      if (pending.size >= maxEntries)
        throw new Error("Too many ownership checks are in progress. Please try again shortly.");
      task = Promise.resolve()
        .then(() => verify(kind, url, linkedUserId))
        .then((proof) => {
          if (successes.size >= maxEntries) successes.delete(successes.keys().next().value!);
          // Preserve the original checked-at time when a rapid draft edit reuses this proof.
          successes.set(key, { proof: { ...proof }, expires: now() + 15_000 });
          return proof;
        })
        .catch((error) => {
          if (error instanceof RobloxRateLimitError) {
            blocked = { until: now() + error.retryAfterSeconds * 1000, stage: error.stage };
          }
          throw error;
        })
        .finally(() => {
          pending.delete(key);
        });
      pending.set(key, task);
    }
    return { ...(await task) };
  };
}

// Each request still authenticates and reloads its linked identity before reaching this gate.
export const verifyListingDraftOwnership = createDraftVerifier();
