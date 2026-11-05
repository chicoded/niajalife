/**
 * Character creation data + server-side validation.
 *
 * Everything the browser sends about a character is untrusted. `sanitizeAppearance`
 * is the single gate that the game server uses before a character is allowed into
 * the world, so it must never be bypassed.
 */

export type Gender = "female" | "male" | "nonbinary";

export interface AppearanceOption {
  id: string;
  label: string;
  /** Only skin tones carry a colour. */
  hex?: string;
}

export interface TraitOption {
  id: string;
  label: string;
  description: string;
}

export const SKIN_TONES: AppearanceOption[] = [
  { id: "obsidian", label: "Obsidian", hex: "#5c3317" },
  { id: "ebony", label: "Ebony", hex: "#8d5524" },
  { id: "mahogany", label: "Mahogany", hex: "#a9754f" },
  { id: "caramel", label: "Caramel", hex: "#c68642" },
  { id: "honey", label: "Honey", hex: "#e0ac69" },
  { id: "golden", label: "Golden", hex: "#f1c27d" },
];

export const HAIRSTYLES: AppearanceOption[] = [
  { id: "braids", label: "Braids" },
  { id: "locs", label: "Locs" },
  { id: "afro", label: "Afro" },
  { id: "gele", label: "Gele" },
  { id: "fade", label: "Fade" },
  { id: "bald", label: "Bald" },
];

export const OUTFITS: AppearanceOption[] = [
  { id: "ankara", label: "Ankara" },
  { id: "adire", label: "Adire" },
  { id: "aso-oke", label: "Aso-Oke" },
  { id: "streetwear", label: "Streetwear" },
  { id: "corporate", label: "Corporate" },
  { id: "casual", label: "Casual" },
];

export const GENDERS: AppearanceOption[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "nonbinary", label: "Non-binary" },
];

export const TRAITS: TraitOption[] = [
  { id: "ambitious", label: "Ambitious", description: "Climbs faster, but rarely satisfied." },
  { id: "street-smart", label: "Street-Smart", description: "Knows the city and how to move." },
  { id: "charmer", label: "Charmer", description: "People warm to you quickly." },
  { id: "workaholic", label: "Workaholic", description: "Tireless when there is money to make." },
  { id: "frugal", label: "Frugal", description: "Every naira is accounted for." },
  { id: "lucky", label: "Lucky", description: "The odds quietly favour you." },
  { id: "hot-tempered", label: "Hot-Tempered", description: "Quick to fire up." },
  { id: "generous", label: "Generous", description: "Gives freely; the city remembers." },
];

export interface CharacterAppearance {
  name: string;
  gender: Gender;
  skinTone: string;
  hairstyle: string;
  outfit: string;
  trait: string;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  name: "Ade",
  gender: "female",
  skinTone: "caramel",
  hairstyle: "braids",
  outfit: "ankara",
  trait: "ambitious",
};

export const NAME_MIN = 2;
export const NAME_MAX = 20;

const ids = (list: AppearanceOption[]) => new Set(list.map((o) => o.id));
const SKIN_IDS = ids(SKIN_TONES);
const HAIR_IDS = ids(HAIRSTYLES);
const OUTFIT_IDS = ids(OUTFITS);
const GENDER_IDS = ids(GENDERS);
const TRAIT_IDS = new Set(TRAITS.map((t) => t.id));

/** Removes control characters and trims; keeps length within bounds. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // Strip control chars + angle brackets (defence against injection into the DOM).
  const stripped = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  return stripped.slice(0, NAME_MAX);
}

/**
 * Validates an untrusted appearance object and returns a safe copy.
 * Never throws — bad fields fall back to defaults so a player can always join.
 */
export function sanitizeAppearance(input: unknown): CharacterAppearance {
  const raw = (input ?? {}) as Partial<Record<keyof CharacterAppearance, unknown>>;

  const name = cleanName(raw.name) || DEFAULT_APPEARANCE.name;
  const gender = GENDER_IDS.has(String(raw.gender)) ? (raw.gender as Gender) : DEFAULT_APPEARANCE.gender;
  const skinTone = SKIN_IDS.has(String(raw.skinTone)) ? String(raw.skinTone) : DEFAULT_APPEARANCE.skinTone;
  const hairstyle = HAIR_IDS.has(String(raw.hairstyle)) ? String(raw.hairstyle) : DEFAULT_APPEARANCE.hairstyle;
  const outfit = OUTFIT_IDS.has(String(raw.outfit)) ? String(raw.outfit) : DEFAULT_APPEARANCE.outfit;
  const trait = TRAIT_IDS.has(String(raw.trait)) ? String(raw.trait) : DEFAULT_APPEARANCE.trait;

  return { name, gender, skinTone, hairstyle, outfit, trait };
}

export function skinHex(id: string): string {
  return SKIN_TONES.find((s) => s.id === id)?.hex ?? DEFAULT_APPEARANCE.skinTone;
}
