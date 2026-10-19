// Central Roblox Experience tag taxonomy + deterministic local suggestions.
export const EXPERIENCE_TAGS = [
  "Adventure", "Action", "RPG", "Simulator", "Tycoon", "Obby", "Horror", "Survival", "Roleplay", "Life Sim",
  "Racing", "Sports", "Fighting", "Shooter", "Strategy", "Tower Defense", "Puzzle", "Sandbox", "Building",
  "Social", "Hangout", "Story", "Anime", "Fantasy", "Sci-Fi", "Medieval", "Military", "Police",
  "Emergency Services", "Vehicles", "Naval", "Aviation", "Farming", "Animals", "Pets", "RNG", "Collecting",
  "Trading", "PvP", "PvE", "Co-op", "Singleplayer", "Multiplayer", "Open World", "Exploration", "Casual", "Competitive",
] as const;
export type ExperienceTag = (typeof EXPERIENCE_TAGS)[number];
export const MAX_TAGS = 8;

/** Keywords (lowercase, whole-word prefix) that imply each tag. */
const KEYWORDS: Partial<Record<ExperienceTag, string[]>> = {
  Adventure: ["adventure", "quest", "journey"],
  Action: ["action", "combat", "battle"],
  RPG: ["rpg", "level", "quest", "class", "loot"],
  Simulator: ["simulator", "sim"],
  Tycoon: ["tycoon", "factory", "empire", "business"],
  Obby: ["obby", "parkour", "obstacle", "tower"],
  Horror: ["horror", "scary", "backrooms", "monster", "haunted"],
  Survival: ["survival", "survive", "castaway", "island"],
  Roleplay: ["roleplay", "rp"],
  "Life Sim": ["life", "town", "city", "house", "family"],
  Racing: ["racing", "race", "drift", "kart"],
  Sports: ["sports", "soccer", "football", "basketball"],
  Fighting: ["fighting", "fight", "sword", "blade", "boxing"],
  Shooter: ["shooter", "gun", "fps", "sniper"],
  Strategy: ["strategy", "td", "defense", "tactics"],
  "Tower Defense": ["tower defense", "td"],
  Puzzle: ["puzzle", "escape", "riddle"],
  Sandbox: ["sandbox", "build"],
  Building: ["building", "builders", "build", "craft"],
  Social: ["social", "chat", "friends"],
  Hangout: ["hangout", "cafe", "lounge"],
  Story: ["story", "chapter"],
  Anime: ["anime", "ninja", "kenzo"],
  Fantasy: ["fantasy", "kingdom", "magic", "dragon"],
  "Sci-Fi": ["sci-fi", "space", "galaxy", "robot"],
  Medieval: ["medieval", "castle", "knight"],
  Military: ["military", "army", "war"],
  Police: ["police", "cop", "prison"],
  "Emergency Services": ["coast guard", "rescue", "fire", "ems", "emergency", "lifeguard"],
  Vehicles: ["vehicle", "car", "truck", "boat", "drift", "rail", "courier"],
  Naval: ["coast", "naval", "boat", "ship", "harbor", "sea"],
  Aviation: ["aviation", "plane", "airport", "flight"],
  Farming: ["farm", "farming", "harvest", "crop"],
  Animals: ["animal", "zoo", "otter"],
  Pets: ["pet", "pets"],
  RNG: ["rng", "luck", "roll"],
  Collecting: ["collect", "collecting", "harvest", "cards"],
  Trading: ["trade", "trading"],
  PvP: ["pvp", "arena", "versus"],
  "Co-op": ["co-op", "coop", "squad", "team"],
  "Open World": ["open world", "coastline", "city", "map"],
  Exploration: ["explore", "exploration"],
  Casual: ["casual", "relax", "cozy"],
  Competitive: ["competitive", "ranked", "league"],
};

/** Base tags implied by a Roblox genre. */
const GENRE_BASE: Record<string, ExperienceTag[]> = {
  Roleplay: ["Roleplay", "Multiplayer", "Social", "Open World"],
  Simulator: ["Simulator", "Casual", "Collecting"],
  Tycoon: ["Tycoon", "Simulator", "Singleplayer"],
  Horror: ["Horror", "Survival", "Co-op"],
  Fighting: ["Fighting", "PvP", "Action"],
  Racing: ["Racing", "Vehicles", "Competitive"],
  "Tower Defense": ["Tower Defense", "Strategy", "Co-op"],
  Survival: ["Survival", "Exploration", "Co-op"],
  Obby: ["Obby", "Casual", "Singleplayer"],
};

const hit = (text: string, kw: string) => new RegExp(`\\b${kw.replace(/[-]/g, "\\-")}`, "i").test(text);

/** Deterministic tag suggestions from genre + seller copy, ranked by relevance. */
export function suggestTags(input: { genre?: string | undefined; title?: string; tagline?: string; description?: string }, limit = 10): ExperienceTag[] {
  const text = `${input.title ?? ""} ${input.tagline ?? ""} ${input.description ?? ""}`.toLowerCase();
  const score = new Map<ExperienceTag, number>();
  const add = (t: ExperienceTag, n: number) => score.set(t, (score.get(t) ?? 0) + n);
  const base = (input.genre && GENRE_BASE[input.genre]) || [];
  base.forEach((t, i) => add(t, 3 - i * 0.1));
  if (input.genre && (EXPERIENCE_TAGS as readonly string[]).includes(input.genre)) add(input.genre as ExperienceTag, 3);
  for (const tag of EXPERIENCE_TAGS) {
    const kws = KEYWORDS[tag] ?? [];
    const n = kws.filter((k) => hit(text, k)).length;
    if (n) add(tag, 2 + n);
  }
  if (score.size && !score.has("Multiplayer")) add("Multiplayer", 0.5);
  const order = (t: ExperienceTag) => EXPERIENCE_TAGS.indexOf(t);
  return [...score.entries()].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0])).slice(0, limit).map(([t]) => t);
}

/** Toggle a tag within the max; returns null when adding would exceed the limit. */
export function toggleTag(selected: string[], tag: string, max = MAX_TAGS): string[] | null {
  if (selected.includes(tag)) return selected.filter((t) => t !== tag);
  if (selected.length >= max) return null;
  return [...selected, tag];
}
