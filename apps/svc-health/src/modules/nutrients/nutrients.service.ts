/**
 * The nutrient lookup.
 *
 * A pilot stand-in for a real nutrient API (Nutritionix, Edamam and the
 * like). The numbers are per serving and match the shared Kenyan dish
 * catalogue, so a search returns what the planner would serve.
 */

export type NutrientFacts = {
  calories: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
};

const NUTRIENTS: Record<string, NutrientFacts> = {
  ugali: { calories: 350, carbs_g: 72, protein_g: 7, fat_g: 1 },
  "sukuma wiki": { calories: 90, carbs_g: 8, protein_g: 4, fat_g: 1 },
  chapati: { calories: 250, carbs_g: 45, protein_g: 6, fat_g: 5 },
  matoke: { calories: 220, carbs_g: 48, protein_g: 3, fat_g: 1 },
  githeri: { calories: 210, carbs_g: 40, protein_g: 11, fat_g: 2 },
  mandazi: { calories: 130, carbs_g: 26, protein_g: 3, fat_g: 2 },
  uji: { calories: 170, carbs_g: 36, protein_g: 3, fat_g: 0 },
  omelette: { calories: 190, carbs_g: 2, protein_g: 14, fat_g: 12 },
  "nyama choma": { calories: 320, carbs_g: 0, protein_g: 30, fat_g: 22 },
  "chicken stew": { calories: 240, carbs_g: 8, protein_g: 26, fat_g: 12 },
  tilapia: { calories: 260, carbs_g: 0, protein_g: 30, fat_g: 15 },
  samosa: { calories: 200, carbs_g: 25, protein_g: 5, fat_g: 10 },
  banana: { calories: 105, carbs_g: 27, protein_g: 1, fat_g: 0 },
  kachumbari: { calories: 45, carbs_g: 8, protein_g: 1, fat_g: 0 },
  "green beans": { calories: 90, carbs_g: 20, protein_g: 4, fat_g: 0 },
  groundnuts: { calories: 285, carbs_g: 6, protein_g: 12, fat_g: 24 },
};

/** The answer for a food nobody has a sample for. */
const GENERIC_ESTIMATE: NutrientFacts = {
  calories: 150,
  carbs_g: 15,
  protein_g: 10,
  fat_g: 5,
};

/**
 * Looks a food up by name.
 *
 * A food matches when its name appears in the query, or when the query is
 * the start of its name ("ugal" finds ugali).
 */
export function lookupNutrients(query: unknown): NutrientFacts {
  const text = String(query ?? "")
    .trim()
    .toLowerCase();

  if (!text) return GENERIC_ESTIMATE;

  const names = Object.keys(NUTRIENTS);

  const contained = names.find((name) => text.includes(name));
  if (contained) return NUTRIENTS[contained];

  if (text.length >= 3) {
    const prefixed = names.find((name) => name.startsWith(text));
    if (prefixed) return NUTRIENTS[prefixed];
  }

  return GENERIC_ESTIMATE;
}
