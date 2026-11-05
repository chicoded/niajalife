/**
 * World definition: districts, roads, buildings and street props.
 *
 * The city is data, not code. Both the renderer (Babylon.js) and the simulation
 * build from these arrays, so hundreds of buildings can be added later without
 * touching the engine — see `docs/ARCHITECTURE.md`.
 */

export type DistrictId =
  | "yaba"
  | "ikeja"
  | "lekki"
  | "surulere"
  | "mushin"
  | "victoria-island";

export interface District {
  id: DistrictId;
  name: string;
  blurb: string;
  playable: boolean;
  /** Free-text note shown when a district is not yet playable (must be honest). */
  note?: string;
}

export type BuildingType =
  | "office"
  | "restaurant"
  | "salon"
  | "boutique"
  | "market"
  | "mall"
  | "clinic"
  | "school"
  | "nightclub"
  | "home"
  | "landmark";

/** What happens when a player walks up to a building and interacts. */
export type InteractionKind = "salon" | "boutique" | "info";

export interface RoadDef {
  id: string;
  /** Which axis the road runs along. */
  along: "x" | "z";
  /** Coordinate on the opposite axis (e.g. along:"x", at:0 is the horizontal road at z = 0). */
  at: number;
  width: number;
  from: number;
  to: number;
}

export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  interaction: InteractionKind;
  /** Centre position on the ground plane. */
  x: number;
  z: number;
  /** Footprint size. */
  w: number;
  d: number;
  h: number;
  color: string;
  blurb: string;
}

export interface PropDef {
  id: string;
  kind: "tree" | "streetlight" | "danfo" | "stall" | "sign";
  x: number;
  z: number;
  rotY?: number;
  label?: string;
}

export interface SpawnPoint {
  x: number;
  z: number;
  rotY: number;
}

export interface DistrictLayout {
  districtId: DistrictId;
  roads: RoadDef[];
  buildings: Building[];
  props: PropDef[];
  spawn: SpawnPoint;
}

export const WORLD = {
  /** Half-extent of the ground plane, in metres. */
  half: 90,
  /** Players are clamped inside +/- this value. */
  bounds: 88,
  /** Authoritative simulation rate (Hz). */
  tickRate: 20,
  tickMs: 50,
} as const;

export const MOVEMENT = {
  /** Walk speed in metres per second. */
  speed: 6,
  sprintMultiplier: 1.75,
  /** Maximum length of the movement input vector (anti-speedhack). */
  maxInput: 1,
} as const;

export const CHAT = {
  maxLength: 200,
  /** Minimum gap between a player's chat messages. */
  rateLimitMs: 700,
} as const;

export const DISTRICTS: District[] = [
  {
    id: "yaba",
    name: "Yaba",
    blurb: "Students, technology and cheap eats. The beating heart of young Lagos.",
    playable: true,
  },
  {
    id: "ikeja",
    name: "Ikeja",
    blurb: "Offices, malls and employment. Where the salary earners live.",
    playable: false,
    note: "Arriving in a later milestone.",
  },
  {
    id: "surulere",
    name: "Surulere",
    blurb: "Residential streets, sports and quiet ambition.",
    playable: false,
    note: "Arriving in a later milestone.",
  },
  {
    id: "mushin",
    name: "Mushin",
    blurb: "Markets, affordable housing and street commerce that never sleeps.",
    playable: false,
    note: "Arriving in a later milestone.",
  },
  {
    id: "lekki",
    name: "Lekki",
    blurb: "Luxury homes, nightlife and the money that follows the coast.",
    playable: false,
    note: "Arriving in a later milestone.",
  },
  {
    id: "victoria-island",
    name: "Victoria Island",
    blurb: "Corporate towers, hotels and banks. The boardroom of Nigeria.",
    playable: false,
    note: "Arriving in a later milestone.",
  },
];

export function getDistrict(id: string): District | undefined {
  return DISTRICTS.find((d) => d.id === id);
}

// ---------------------------------------------------------------------------
// Yaba layout
// ---------------------------------------------------------------------------

const YABA_ROADS: RoadDef[] = [
  { id: "herbert-macaulay", along: "x", at: 0, width: 16, from: -90, to: 90 },
  { id: "oyingbo-market-rd", along: "z", at: 0, width: 16, from: -90, to: 90 },
  { id: "north-link", along: "x", at: -52, width: 10, from: -90, to: 90 },
  { id: "south-link", along: "x", at: 52, width: 10, from: -90, to: 90 },
  { id: "west-link", along: "z", at: -52, width: 10, from: -90, to: 90 },
  { id: "east-link", along: "z", at: 52, width: 10, from: -90, to: 90 },
];

const YABA_BUILDINGS: Building[] = [
  {
    id: "yaba-tech-hub",
    name: "Yaba Tech Hub",
    type: "office",
    interaction: "info",
    x: 24, z: 24, w: 20, d: 18, h: 22, color: "#3d6ea8",
    blurb: "Co-working floors full of founders, designers and people pitching ideas over small chops.",
  },
  {
    id: "zenith-plaza",
    name: "Zenith Plaza",
    type: "office",
    interaction: "info",
    x: -24, z: 24, w: 18, d: 18, h: 26, color: "#2f6f63",
    blurb: "Nine floors of paperwork, air conditioning and ambition.",
  },
  {
    id: "mama-nkechi-kitchen",
    name: "Mama Nkechi Kitchen",
    type: "restaurant",
    interaction: "info",
    x: 24, z: -24, w: 16, d: 14, h: 9, color: "#b8722f",
    blurb: "Amala, ewedu and gbegiri. The queue outside is the review.",
  },
  {
    id: "shitta-suya-spot",
    name: "Shitta Suya Spot",
    type: "restaurant",
    interaction: "info",
    x: -24, z: -24, w: 14, d: 12, h: 7, color: "#a8532f",
    blurb: "Smoke, yaji and onions wrapped in newspaper. Open late.",
  },
  {
    id: "ankara-and-co",
    name: "Ankara & Co. Boutique",
    type: "boutique",
    interaction: "boutique",
    x: 38, z: 38, w: 16, d: 14, h: 10, color: "#c2568b",
    blurb: "Tailors that can cut, sew and deliver by Friday. Try something on.",
  },
  {
    id: "sabo-barbers",
    name: "Sabo Barbers",
    type: "salon",
    interaction: "salon",
    x: -38, z: 38, w: 12, d: 12, h: 7, color: "#6a63c6",
    blurb: "Two chairs, one mirror, and the best fade in Yaba.",
  },
  {
    id: "tejuosho-annex",
    name: "Tejuosho Annex Market",
    type: "market",
    interaction: "info",
    x: 66, z: 24, w: 22, d: 18, h: 8, color: "#c99a3d",
    blurb: "Fabrics, phones, shoes and everything in between, in one loud hall.",
  },
  {
    id: "yaba-main-market",
    name: "Yaba Main Market",
    type: "market",
    interaction: "info",
    x: -66, z: -24, w: 22, d: 18, h: 8, color: "#b98b34",
    blurb: "Price it yourself, haggle like your life depends on it.",
  },
  {
    id: "computer-village",
    name: "Computer Village",
    type: "mall",
    interaction: "info",
    x: 66, z: -66, w: 24, d: 20, h: 12, color: "#4a7fb5",
    blurb: "Laptops, chargers, repairs and a thousand salesmen who all know a guy.",
  },
  {
    id: "sabo-clinic",
    name: "Sabo Clinic",
    type: "clinic",
    interaction: "info",
    x: -66, z: 66, w: 18, d: 16, h: 10, color: "#4f9e8a",
    blurb: "The queue is long but the nurses are kind.",
  },
  {
    id: "akoka-study-centre",
    name: "Akoka Study Centre",
    type: "school",
    interaction: "info",
    x: -24, z: -66, w: 22, d: 18, h: 11, color: "#8a6fb0",
    blurb: "Library, evening classes and students who never sleep.",
  },
  {
    id: "national-theatre",
    name: "National Theatre",
    type: "landmark",
    interaction: "info",
    x: 24, z: 78, w: 30, d: 22, h: 18, color: "#9aa6b2",
    blurb: "The famous hat-shaped monument. Lagos landmarks itself here.",
  },
  {
    id: "ojuelegba-underbridge",
    name: "Ojuelegba Underbridge",
    type: "landmark",
    interaction: "info",
    x: 20, z: -78, w: 26, d: 12, h: 9, color: "#7d8a97",
    blurb: "Where every route in Lagos somehow passes through. Hold your phone tight.",
  },
  {
    id: "lagoon-view-estates",
    name: "Lagoon View Estates",
    type: "home",
    interaction: "info",
    x: -78, z: 24, w: 20, d: 16, h: 14, color: "#7f8fa6",
    blurb: "Flats with a view of the water, and rent that explains why.",
  },
  {
    id: "fola-agoro-court",
    name: "Fola Agoro Court",
    type: "home",
    interaction: "info",
    x: 78, z: 78, w: 20, d: 16, h: 14, color: "#88998f",
    blurb: "Quiet streets, nosey neighbours, and a landlord who collects on time.",
  },
  {
    id: "balogun-bar",
    name: "Balogun Bar & Lounge",
    type: "nightclub",
    interaction: "info",
    x: -38, z: -38, w: 18, d: 15, h: 11, color: "#a8456f",
    blurb: "Cold drinks, loud speakers and conversations you should not repeat.",
  },
];

const YABA_PROPS: PropDef[] = [
  // Streetlights down the two main roads.
  { id: "sl-1", kind: "streetlight", x: 20, z: 9 },
  { id: "sl-2", kind: "streetlight", x: 48, z: 9 },
  { id: "sl-3", kind: "streetlight", x: 76, z: 9 },
  { id: "sl-4", kind: "streetlight", x: -20, z: -9 },
  { id: "sl-5", kind: "streetlight", x: -48, z: -9 },
  { id: "sl-6", kind: "streetlight", x: -76, z: -9 },
  { id: "sl-7", kind: "streetlight", x: 9, z: 26 },
  { id: "sl-8", kind: "streetlight", x: -9, z: 60 },
  { id: "sl-9", kind: "streetlight", x: 9, z: -40 },
  { id: "sl-10", kind: "streetlight", x: -9, z: -72 },

  // Trees softening the blocks.
  { id: "tr-1", kind: "tree", x: 34, z: 20 },
  { id: "tr-2", kind: "tree", x: -34, z: 20 },
  { id: "tr-3", kind: "tree", x: 34, z: -30 },
  { id: "tr-4", kind: "tree", x: -30, z: -32 },
  { id: "tr-5", kind: "tree", x: 60, z: 60 },
  { id: "tr-6", kind: "tree", x: -60, z: -60 },
  { id: "tr-7", kind: "tree", x: 44, z: 66 },
  { id: "tr-8", kind: "tree", x: -44, z: 66 },

  // Danfo buses parked along the main road.
  { id: "danfo-1", kind: "danfo", x: 32, z: 4, rotY: 0, label: "Ojuelegba — Yaba" },
  { id: "danfo-2", kind: "danfo", x: 62, z: -4, rotY: Math.PI, label: "Yaba — Oyingbo" },
  { id: "danfo-3", kind: "danfo", x: -56, z: 4, rotY: 0, label: "Yaba — Tejuosho" },

  // Street vendors near the markets.
  { id: "st-1", kind: "stall", x: 52, z: 20, label: "Roasted plantain" },
  { id: "st-2", kind: "stall", x: -52, z: -20, label: "Pure water & minerals" },
  { id: "st-3", kind: "stall", x: 18, z: 40, label: "Mama put" },
  { id: "st-4", kind: "stall", x: -20, z: -44, label: "Recharge cards" },

  // Signage at the junction.
  { id: "sign-1", kind: "sign", x: 12, z: 12, label: "Yaba" },
];

const YABA_LAYOUT: DistrictLayout = {
  districtId: "yaba",
  roads: YABA_ROADS,
  buildings: YABA_BUILDINGS,
  props: YABA_PROPS,
  // A clear patch of pavement beside the Herbert Macaulay junction.
  spawn: { x: 14, z: 10, rotY: -Math.PI / 2 },
};

export function getDistrictLayout(id: DistrictId): DistrictLayout {
  // Milestone 01 ships one district. Unknown ids fall back to Yaba so the
  // client can never end up in an empty world.
  void id;
  return YABA_LAYOUT;
}

/** Shortest distance from a point to a building's footprint (0 when inside). */
export function distanceToBuilding(b: Building, x: number, z: number): number {
  const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
  const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
  return Math.hypot(dx, dz);
}

export const INTERACTION_RADIUS = 6;

/** Collision radius of a player capsule, in metres. */
export const PLAYER_RADIUS = 0.7;

/** How far past a surface a collision pushes, so rounding cannot re-clip it. */
const SURFACE_EPSILON = 0.01;

/**
 * Collision half-extents of each prop kind, in metres.
 *
 * Only the parts a walking player can actually bump into are counted: a
 * streetlight's lamp and a tree's canopy sit above head height, so the pole and
 * the trunk are used instead. Props are axis-aligned (their `rotY` is a whole
 * turn or half a turn), so a plain footprint is exact here.
 */
export const PROP_FOOTPRINT: Record<PropDef["kind"], { halfW: number; halfD: number }> = {
  streetlight: { halfW: 0.35, halfD: 0.35 },
  tree: { halfW: 0.55, halfD: 0.55 },
  danfo: { halfW: 2.4, halfD: 1.05 },
  stall: { halfW: 1.2, halfD: 0.75 },
  sign: { halfW: 0.3, halfD: 0.3 },
};

/**
 * Pushes a position out of any box footprint it has entered.
 *
 * Shared by the authoritative server simulation and the client's local
 * prediction, so the two can never disagree about where a wall is.
 */
function pushOutOfBoxes(
  boxes: { x: number; z: number; halfW: number; halfD: number }[],
  x: number,
  z: number,
  radius: number,
): { x: number; z: number } {
  for (const b of boxes) {
    const halfW = b.halfW + radius;
    const halfD = b.halfD + radius;
    const dx = x - b.x;
    const dz = z - b.z;
    if (Math.abs(dx) >= halfW || Math.abs(dz) >= halfD) continue;

    const pushX = halfW - Math.abs(dx);
    const pushZ = halfD - Math.abs(dz);
    // Land just past the surface: resting exactly on the boundary lets floating
    // point rounding leave the character a hair inside, which reads as jitter.
    if (pushX < pushZ) {
      x = b.x + Math.sign(dx || 1) * (halfW + SURFACE_EPSILON);
    } else {
      z = b.z + Math.sign(dz || 1) * (halfD + SURFACE_EPSILON);
    }
  }
  return { x, z };
}

export function resolveBuildingCollisions(
  buildings: Building[],
  x: number,
  z: number,
  radius = PLAYER_RADIUS,
): { x: number; z: number } {
  return pushOutOfBoxes(
    buildings.map((b) => ({ x: b.x, z: b.z, halfW: b.w / 2, halfD: b.d / 2 })),
    x,
    z,
    radius,
  );
}

/** Pushes a position out of any street prop it has entered. */
export function resolvePropCollisions(
  props: PropDef[],
  x: number,
  z: number,
  radius = PLAYER_RADIUS,
): { x: number; z: number } {
  return pushOutOfBoxes(
    props.map((p) => ({ x: p.x, z: p.z, ...PROP_FOOTPRINT[p.kind] })),
    x,
    z,
    radius,
  );
}

/**
 * The single collision pass shared by the server simulation and the client's
 * local prediction: buildings first, then street props.
 *
 * Both callers must use this one function — that is what stops the client and
 * the server from ever disagreeing about what is solid.
 */
export function resolveWorldCollisions(
  layout: DistrictLayout,
  x: number,
  z: number,
  radius = PLAYER_RADIUS,
): { x: number; z: number } {
  const afterBuildings = resolveBuildingCollisions(layout.buildings, x, z, radius);
  return resolvePropCollisions(layout.props, afterBuildings.x, afterBuildings.z, radius);
}
