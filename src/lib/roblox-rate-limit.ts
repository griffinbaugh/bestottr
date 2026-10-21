export type OwnershipStage = "PLACE" | "UNIVERSE" | "GROUP";

export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  if (!value?.trim()) return 60;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim())
    ? Number(value)
    : (Date.parse(value) - now) / 1000;
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 86400 ? Math.ceil(seconds) : 60;
}

export class RobloxRateLimitError extends Error {
  constructor(
    public readonly stage: OwnershipStage,
    public readonly retryAfterSeconds: number,
  ) {
    super(
      `Roblox is limiting ownership checks. Try again in ${retryAfterSeconds} seconds. Reference: RBX-${stage}-429.`,
    );
    this.name = "RobloxRateLimitError";
  }
}
