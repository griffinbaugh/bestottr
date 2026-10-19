export const ME = "you";
export const ME_NAME = "Alex Rivera";

export type Bid = { id: string; bidder: string; amount: number; at: number };
export type Seller = {
  handle: string;
  name: string;
  rating: number;
  sales: number;
  joined: string;
  verified: boolean;
  responseTime: string;
};
export type ListingStatus = "live" | "ended" | "sold" | "review" | "rejected";
export type ListingKind = "experience" | "file";

export const FILE_CATEGORIES = ["Scripts", "Systems", "Models", "UI Kits", "Maps", "Vehicles", "Animations", "Audio", "Plugins", "Templates", "Other"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export type FileMeta = {
  fileName: string;
  fileType: string;
  fileSize: string;
  version: string;
  category: FileCategory;
  compatibility: string;
  includedFiles: string[];
  license: string;
  sellerNotes: string;
  inventory: { mode: "unlimited" } | { mode: "limited"; total: number; remaining: number };
};

export type Listing = {
  kind: ListingKind;
  file?: FileMeta;
  id: string;
  title: string;
  tagline: string;
  description: string;
  genre: string;
  image: string;
  format: "auction" | "buy_now";
  startingBid: number;
  currentBid: number;
  reserve?: number | undefined;
  buyNow?: number;
  endsAt: number;
  bids: Bid[];
  status: ListingStatus;
  monthlyRevenue: number;
  monthlyProfit: number;
  monthlyVisits: number;
  ccu: number;
  favorites: number;
  ageMonths: number;
  monetization: { label: string; pct: number }[];
  seller: Seller;
  assets: string[];
  risks: string[];
  verified: { ownership: boolean; revenue: boolean; traffic: boolean };
  hasGroup: boolean;
  createdAt: number;
};

export type Deal = {
  id: string;
  listingId: string;
  kind: ListingKind;
  buyer: string;
  seller: string;
  price: number;
  fee: number;
  stage: number;
  agreement: { buyer: boolean; seller: boolean };
  funded: boolean;
  dd: Record<string, boolean>;
  transfer: Record<string, boolean>;
  received: Record<string, boolean>;
  /** File deals only: seller released access, buyer confirmed download. */
  delivery: { released: boolean; confirmed: boolean };
  log: { at: number; text: string }[];
  createdAt: number;
};

export type AdminItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: "open" | "approved" | "rejected" | "resolved" | "held" | "voided";
};

export type State = {
  listings: Listing[];
  watchlist: string[];
  deals: Deal[];
  roblox: { connected: boolean; username?: string };
  admin: { users: AdminItem[]; disputes: AdminItem[]; flags: AdminItem[]; txn: Record<string, "approved" | "held"> };
};

export const STAGES = ["Agreement", "Funding", "Due Diligence", "Roblox Transfer", "Final Verification", "Complete"];
export const FILE_STAGES = ["Payment", "File Access", "Buyer Confirmation", "Complete"];
export const dealStages = (d: Pick<Deal, "kind">) => (d.kind === "file" ? FILE_STAGES : STAGES);
export const lastStage = (d: Pick<Deal, "kind">) => dealStages(d).length - 1;

export const LICENSE_TERMS =
  "Purchases grant only the license stated on this listing. They do not transfer ownership of the underlying work or any third-party IP.";

export const DD_ITEMS = [
  { id: "analytics", label: "Read-only analytics access reviewed", detail: "Creator Dashboard retention, sessions and traffic sources" },
  { id: "revenue", label: "Revenue & DevEx history verified", detail: "Last 12 months of Robux earnings reconciled to statements" },
  { id: "code", label: "Source code walkthrough", detail: "Screen-share review of core systems and DataStore schema" },
  { id: "moderation", label: "Moderation history clear", detail: "No outstanding moderation actions on experience or group" },
  { id: "ip", label: "IP & contractor review", detail: "Asset authorship and contractor agreements reviewed" },
];

export const TRANSFER_ITEMS = [
  { id: "experience", label: "Experience ownership transferred", detail: "Place & universe moved to buyer's account or group" },
  { id: "group", label: "Community / group ownership", detail: "Group owner role reassigned to buyer (if applicable)" },
  { id: "source", label: "Source code & place files delivered", detail: "Full .rbxl export and repository access" },
  { id: "packages", label: "Private packages & modules", detail: "Package ownership and permissions migrated" },
  { id: "keys", label: "API keys & secrets rotated", detail: "Open Cloud keys, webhooks, external services rotated" },
  { id: "branding", label: "Branding & design files", detail: "Logos, thumbnails, icons, source PSD/Figma" },
  { id: "social", label: "Social accounts handed over", detail: "Discord server, X, YouTube, TikTok ownership" },
  { id: "contractors", label: "Contractor / IP assignments signed", detail: "Assignment letters from all contributors" },
  { id: "republish", label: "Post-transfer republish verified", detail: "Buyer publishes an update; analytics still flowing" },
];

const H = 3600_000;

function bids(base: number, list: [string, number, number][]): Bid[] {
  return list.map(([bidder, amount, hoursAgo], i) => ({ id: `b${i}`, bidder, amount, at: base - hoursAgo * H }));
}

const sellers = {
  brickforge: { handle: "brickforge", name: "Brickforge Studios", rating: 4.9, sales: 7, joined: "2019", verified: true, responseTime: "< 2h" },
  hollow: { handle: "hollowlight", name: "Hollowlight Games", rating: 4.8, sales: 3, joined: "2020", verified: true, responseTime: "< 6h" },
  skyline: { handle: "skylinedev", name: "Skyline Dev Co.", rating: 4.6, sales: 2, joined: "2021", verified: true, responseTime: "< 12h" },
  kenzo: { handle: "kenzo_labs", name: "Kenzo Labs", rating: 5.0, sales: 11, joined: "2018", verified: true, responseTime: "< 1h" },
  apex: { handle: "apexmotion", name: "Apex Motion", rating: 4.7, sales: 4, joined: "2020", verified: true, responseTime: "< 4h" },
  maple: { handle: "maplecollective", name: "Maple Collective", rating: 4.5, sales: 1, joined: "2022", verified: true, responseTime: "< 24h" },
  bastion: { handle: "rook_dev", name: "Rook", rating: 4.2, sales: 0, joined: "2023", verified: false, responseTime: "< 24h" },
  me: { handle: ME, name: ME_NAME, rating: 4.9, sales: 2, joined: "2020", verified: true, responseTime: "< 1h" },
  neon: { handle: "voltkart", name: "VoltKart Team", rating: 0, sales: 0, joined: "2024", verified: false, responseTime: "—" },
} satisfies Record<string, Seller>;

const stdAssets = ["Experience & all places", "Full source code", "Private packages", "Game icon & thumbnails", "Discord server"];

export function seedState(): State {
  const now = Date.now();
  const L = (p: Partial<Listing> & Pick<Listing, "id" | "title">): Listing => ({
    tagline: "",
    description: "",
    genre: "Simulator",
    image: "g1",
    format: "auction",
    startingBid: 10000,
    currentBid: 10000,
    endsAt: now + 48 * H,
    bids: [],
    status: "live",
    monthlyRevenue: 3000,
    monthlyProfit: 2500,
    monthlyVisits: 1_000_000,
    ccu: 500,
    favorites: 40000,
    ageMonths: 12,
    monetization: [
      { label: "Game passes", pct: 55 },
      { label: "Developer products", pct: 30 },
      { label: "Premium payouts", pct: 15 },
    ],
    seller: sellers.brickforge,
    assets: stdAssets,
    risks: [],
    verified: { ownership: true, revenue: true, traffic: true },
    hasGroup: true,
    createdAt: now - 72 * H,
    ...p,
  });

  const listings: Listing[] = [
    L({
      id: "factory-tycoon",
      title: "Factory Tycoon Empire",
      tagline: "Top-200 tycoon with 22 months of steady, organic growth",
      description:
        "A polished industrial tycoon where players build conveyor-driven factories, unlock city districts and trade goods. Strong retention (D1 31%, D7 11%) driven by a weekly event cadence. The studio is selling to focus on a new title; all systems are documented and the codebase is modular.",
      genre: "Tycoon",
      image: "g1",
      startingBid: 30000,
      currentBid: 42500,
      reserve: 45000,
      buyNow: 68000,
      endsAt: now + 26 * H,
      bids: bids(now, [
        ["northpeak", 30000, 60],
        ["blocky_ventures", 32000, 52],
        ["northpeak", 34000, 40],
        ["m.chen", 35750, 33],
        ["blocky_ventures", 37500, 21],
        ["northpeak", 39500, 12],
        ["m.chen", 41000, 5],
        ["blocky_ventures", 42500, 1.5],
      ]).reverse(),
      monthlyRevenue: 6800,
      monthlyProfit: 5900,
      monthlyVisits: 3_200_000,
      ccu: 1850,
      favorites: 182000,
      ageMonths: 22,
      monetization: [
        { label: "Game passes", pct: 48 },
        { label: "Developer products", pct: 34 },
        { label: "Premium payouts", pct: 12 },
        { label: "Immersive ads", pct: 6 },
      ],
      seller: sellers.brickforge,
      assets: [...stdAssets, "Roblox group (412k members)", "Analytics dashboards", "YouTube channel (38k)"],
      risks: ["Revenue is ~40% concentrated in weekend events", "Two contractor scripters — IP assignments on file"],
    }),
    L({
      id: "backrooms",
      title: "Backrooms: Level Zero",
      tagline: "Atmospheric horror with viral TikTok traction",
      description: "Co-op horror exploration with procedurally generated levels. Heavy short-form video traction keeps acquisition cost at zero.",
      genre: "Horror",
      image: "g2",
      startingBid: 80000,
      currentBid: 118000,
      reserve: 110000,
      endsAt: now + 5 * H,
      bids: bids(now, [["horizon_fund", 80000, 40], ["m.chen", 95000, 20], ["horizon_fund", 118000, 2]]).reverse(),
      monthlyRevenue: 14200,
      monthlyProfit: 12100,
      monthlyVisits: 6_400_000,
      ccu: 4100,
      favorites: 410000,
      ageMonths: 14,
      seller: sellers.hollow,
      risks: ["Traffic correlates with external virality; 30-day trend -8%"],
    }),
    L({
      id: "lava-obby",
      title: "Lava Sky Obby",
      tagline: "Low-maintenance obby, 120 stages, evergreen traffic",
      description: "Classic obstacle course with skip-stage developer products. Runs itself; less than 2 hours/week of upkeep.",
      genre: "Obby",
      image: "g3",
      format: "buy_now",
      startingBid: 18500,
      currentBid: 18500,
      buyNow: 18500,
      endsAt: now + 14 * 24 * H,
      monthlyRevenue: 2100,
      monthlyProfit: 2000,
      monthlyVisits: 900_000,
      ccu: 420,
      favorites: 61000,
      ageMonths: 31,
      seller: sellers.skyline,
      hasGroup: false,
      assets: ["Experience & all places", "Full source code", "Game icon & thumbnails"],
    }),
    L({
      id: "blade-ascension",
      title: "Blade Ascension",
      tagline: "Anime fighting game with a 9.8k CCU peak and live-ops team",
      description: "Anime-inspired combat with a seasonal battle pass, clans and ranked play. Sale includes optional 60-day transition support from the lead developer.",
      genre: "Fighting",
      image: "g4",
      startingBid: 200000,
      currentBid: 255000,
      reserve: 300000,
      buyNow: 390000,
      endsAt: now + 52 * H,
      bids: bids(now, [["horizon_fund", 200000, 30], ["kairo_cap", 230000, 18], ["horizon_fund", 255000, 6]]).reverse(),
      monthlyRevenue: 31000,
      monthlyProfit: 24500,
      monthlyVisits: 11_000_000,
      ccu: 9800,
      favorites: 1_200_000,
      ageMonths: 18,
      monetization: [
        { label: "Battle pass", pct: 41 },
        { label: "Developer products", pct: 33 },
        { label: "Game passes", pct: 18 },
        { label: "Premium payouts", pct: 8 },
      ],
      seller: sellers.kenzo,
      assets: [...stdAssets, "Roblox group (1.1M members)", "Live-ops runbook", "60-day transition support"],
      risks: ["Ongoing contractor costs of $4.2k/mo included in profit"],
    }),
    L({
      id: "turbo-drift",
      title: "Turbo Drift League",
      tagline: "Night-city drift racer with car-pack monetization",
      description: "Open-world street racing with tuning, crews and weekly leaderboards.",
      genre: "Racing",
      image: "g5",
      startingBid: 50000,
      currentBid: 64000,
      reserve: 60000,
      endsAt: now + 74 * H,
      bids: bids(now, [["blocky_ventures", 50000, 20], ["kairo_cap", 64000, 8]]).reverse(),
      monthlyRevenue: 8400,
      monthlyProfit: 6900,
      monthlyVisits: 2_700_000,
      ccu: 2300,
      favorites: 240000,
      ageMonths: 9,
      seller: sellers.apex,
    }),
    L({
      id: "maple-grove",
      title: "Maple Grove RP",
      tagline: "Town roleplay with housing and vehicle economy",
      description: "Life-sim roleplay with player housing, jobs and a vehicle dealership. Strong community moderation team in place.",
      genre: "Roleplay",
      image: "g6",
      format: "buy_now",
      startingBid: 145000,
      currentBid: 145000,
      buyNow: 145000,
      endsAt: now + 20 * 24 * H,
      monthlyRevenue: 17800,
      monthlyProfit: 14900,
      monthlyVisits: 5_100_000,
      ccu: 3600,
      favorites: 520000,
      ageMonths: 27,
      seller: sellers.maple,
    }),
    L({
      id: "bastion-td",
      title: "Bastion TD",
      tagline: "Tower defense with fast-growing traffic — revenue unverified",
      description: "Wave-based tower defense with unit trading. Seller has not yet connected revenue reporting.",
      genre: "Tower Defense",
      image: "g7",
      startingBid: 15000,
      currentBid: 21000,
      endsAt: now + 1.5 * H,
      bids: bids(now, [["m.chen", 15000, 10], ["anon_7731", 21000, 3]]).reverse(),
      monthlyRevenue: 4200,
      monthlyProfit: 3900,
      monthlyVisits: 1_800_000,
      ccu: 1100,
      favorites: 95000,
      ageMonths: 6,
      seller: sellers.bastion,
      verified: { ownership: true, revenue: false, traffic: true },
      risks: ["Revenue not yet verified via Roblox analytics", "New seller with no prior sales", "Young experience (6 months)"],
    }),
    L({
      id: "castaway",
      title: "Castaway Survival",
      tagline: "Island survival with crafting and co-op raids",
      description: "Survival crafting experience with a loyal niche community. Listed by you (demo).",
      genre: "Survival",
      image: "g8",
      startingBid: 8000,
      currentBid: 9800,
      reserve: 12000,
      buyNow: 16000,
      endsAt: now + 40 * H,
      bids: bids(now, [["m.chen", 8000, 30], ["northpeak", 9800, 9]]).reverse(),
      monthlyRevenue: 1400,
      monthlyProfit: 1250,
      monthlyVisits: 520_000,
      ccu: 260,
      favorites: 28000,
      ageMonths: 15,
      seller: sellers.me,
      hasGroup: false,
    }),
    L({
      id: "pet-hatchery",
      title: "Pet Hatchery Simulator",
      tagline: "Pet collection sim — sold to NorthPeak Capital",
      description: "Egg-hatching simulator with trading. Sold by you (demo).",
      genre: "Simulator",
      image: "g3",
      status: "sold",
      startingBid: 25000,
      currentBid: 36000,
      endsAt: now - 96 * H,
      bids: bids(now, [["northpeak", 36000, 100]]),
      monthlyRevenue: 3900,
      monthlyProfit: 3500,
      monthlyVisits: 1_300_000,
      ccu: 700,
      favorites: 70000,
      ageMonths: 20,
      seller: sellers.me,
    }),
    L({
      id: "volt-kart",
      title: "Volt Kart Arena",
      tagline: "Kart battle arena — awaiting moderation review",
      description: "Arena kart combat. Submitted for review.",
      genre: "Racing",
      image: "g5",
      status: "review",
      startingBid: 12000,
      currentBid: 12000,
      endsAt: now + 7 * 24 * H,
      monthlyRevenue: 1900,
      monthlyProfit: 1600,
      ccu: 300,
      seller: sellers.neon,
      verified: { ownership: true, revenue: false, traffic: false },
    }),
  ];

  const all = (items: { id: string }[], v: boolean) => Object.fromEntries(items.map((i) => [i.id, v]));
  const deals: Deal[] = [
    {
      id: "d-1042",
      listingId: "pet-hatchery",
      buyer: "northpeak",
      seller: ME,
      price: 36000,
      fee: 900,
      stage: 3,
      agreement: { buyer: true, seller: true },
      funded: true,
      dd: all(DD_ITEMS, true),
      transfer: { ...all(TRANSFER_ITEMS, false), experience: true, source: true, branding: true },
      received: all(TRANSFER_ITEMS, false),
      log: [
        { at: now - 95 * H, text: "Auction closed at $36,000 — deal room opened" },
        { at: now - 80 * H, text: "Asset purchase agreement signed by both parties" },
        { at: now - 60 * H, text: "Buyer funded escrow ($36,900)" },
        { at: now - 20 * H, text: "Due diligence completed" },
      ],
      createdAt: now - 95 * H,
    },
  ];

  const item = (id: string, title: string, subtitle: string, meta: string): AdminItem => ({ id, title, subtitle, meta, status: "open" });

  return {
    listings,
    watchlist: ["blade-ascension"],
    deals,
    roblox: { connected: false },
    admin: {
      users: [
        item("u1", "VoltKart Team", "@voltkart · ID + Roblox account", "Submitted 2h ago"),
        item("u2", "Rook", "@rook_dev · Roblox ownership proof", "Submitted 1d ago"),
        item("u3", "Horizon Fund LLC", "@horizon_fund · KYB business verification", "Submitted 3h ago"),
      ],
      disputes: [
        item("x1", "Missing private packages", "Deal #0988 · Skyrise Parkour", "Buyer reports 3 packages not transferred"),
        item("x2", "Revenue misrepresentation", "Deal #0971 · Mine & Craft Tycoon", "Buyer alleges inflated DevEx figures"),
      ],
      flags: [
        item("f1", "Shill bidding pattern", "Bastion TD · anon_7731", "New account, bid only on one seller's listing"),
        item("f2", "Rapid bid escalation", "Backrooms: Level Zero · horizon_fund", "4 bids in 90 seconds"),
      ],
      txn: {},
    },
  };
}
