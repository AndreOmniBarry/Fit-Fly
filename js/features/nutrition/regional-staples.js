// A guided fallback for the case the product owner explicitly asked
// this app to handle honestly: dishes that don't show up in Open Food
// Facts. That database is real and free, but it's crowdsourced from
// *packaged, barcoded products* — it's strong on branded foods and weak
// on raw staples and home-prepared regional dishes (fufu, injera,
// jollof rice, ...), which mostly aren't sold with a barcode at all.
//
// This is deliberately NOT a table of composite-dish calorie counts.
// A home-cooked dish's calories are dominated by how much oil/fat went
// in — jollof rice made with 2 tbsp of oil per serving and the same
// dish made with 5 tbsp differ by ~250 kcal, more than the dish itself.
// Publishing one number for "jollof rice" would be exactly the
// fabricated-precision this app refuses to show for anything else (see
// bmr-tdee.js's confidence bands, food-search.js's "skip incomplete
// entries" rule). Real per-dish accuracy needs either a lab-measured
// recipe or a photo/vision model that can actually see the oil (see the
// "why not photo scanning" note in nutrition-view.js) — this app has
// neither, so it doesn't pretend to.
//
// What's real and defensible instead: per-100g figures for the staple
// *ingredient* underneath many such dishes — cassava, plantain, yam,
// sorghum, teff, cowpeas, fava beans, ackee, jackfruit, and fermented
// soy staples — every one of which is a genuine single-ingredient USDA
// FoodData Central / SR Legacy entry, not a composite dish. Paired with
// buildEstimationGuidance()'s "search the staple, not the dish, then
// add back the oil separately" method, this gives someone cooking a
// regional dish a real, honestly-sourced starting point instead of
// either a fabricated dish-level number or nothing at all.
//
// Figures are per 100g of the edible portion in the prep state named on
// each entry (raw vs. boiled/cooked matters — cooking changes water
// content, sometimes a lot). Treat these as reference values consistent
// with published food-composition data, not a lab measurement of your
// specific pot — same honesty rule as every other estimate in this app.

export const REGIONAL_STAPLE_FOODS = Object.freeze([
  {
    name: 'Cassava (raw)',
    region: 'West & Central Africa, Latin America, Southeast Asia',
    aliases: ['fufu', 'garri', 'yuca', 'manioc', 'tapioca root'],
    caloriesPer100g: 160,
    proteinGPer100g: 1,
    carbsGPer100g: 38,
    fatGPer100g: 0,
    fiberGPer100g: 2,
    note: 'The base of fufu and garri. Boiling changes its water content a lot — this is the raw root; weigh your actual cooked portion if you can rather than assuming this figure holds after cooking.',
  },
  {
    name: 'Plantain (boiled)',
    region: 'West & Central Africa, Caribbean, Latin America',
    aliases: ['dodo', 'tostones', 'maduros', 'matoke'],
    caloriesPer100g: 116,
    proteinGPer100g: 1,
    carbsGPer100g: 31,
    fatGPer100g: 0,
    fiberGPer100g: 2,
    note: 'Frying instead of boiling adds real calories from the oil — see the fat/oil note below if yours was fried, not boiled.',
  },
  {
    name: 'Yam (boiled)',
    region: 'West Africa, Caribbean',
    aliases: ['iyan', 'pounded yam', 'igname'],
    caloriesPer100g: 116,
    proteinGPer100g: 2,
    carbsGPer100g: 28,
    fatGPer100g: 0,
    fiberGPer100g: 4,
  },
  {
    name: 'Sorghum, whole grain (raw)',
    region: 'East & West Africa, South Asia',
    aliases: ['ugali', 'jowar', 'guinea corn', 'sadza'],
    caloriesPer100g: 339,
    proteinGPer100g: 11,
    carbsGPer100g: 75,
    fatGPer100g: 3,
    fiberGPer100g: 6,
    note: "Ugali/sadza is this grain cooked to a stiff porridge with water — expect the cooked dish's per-100g figure to be much lower than this dry-grain one since water makes up most of the added weight.",
  },
  {
    name: 'Teff, whole grain (raw)',
    region: 'Ethiopia, Eritrea',
    aliases: ['injera', "t'ef"],
    caloriesPer100g: 367,
    proteinGPer100g: 13,
    carbsGPer100g: 73,
    fatGPer100g: 2,
    fiberGPer100g: 8,
    note: "Injera is this grain's flour, fermented and cooked into a flatbread — again, expect the finished flatbread to read lower per 100g than the dry flour.",
  },
  {
    name: 'Cowpeas / black-eyed peas (cooked)',
    region: 'West Africa, South Asia, Southern US',
    aliases: ['moin moin', 'akara', 'black-eyed peas', 'lobia'],
    caloriesPer100g: 116,
    proteinGPer100g: 8,
    carbsGPer100g: 21,
    fatGPer100g: 1,
    fiberGPer100g: 6,
    note: 'Moin moin and akara add oil in the prep (moin moin steamed with palm oil, akara deep-fried) — this figure is the plain boiled bean, before that oil.',
  },
  {
    name: 'Fava beans (cooked)',
    region: 'Middle East, North Africa, Mediterranean',
    aliases: ['ful medames', 'foul mudammas', 'broad beans'],
    caloriesPer100g: 110,
    proteinGPer100g: 8,
    carbsGPer100g: 20,
    fatGPer100g: 0,
    fiberGPer100g: 5,
    note: 'Ful medames is typically finished with olive oil at the table — add that separately (see the oil note below).',
  },
  {
    name: 'Ackee (canned, drained)',
    region: 'Jamaica',
    aliases: ['ackee and saltfish'],
    caloriesPer100g: 151,
    proteinGPer100g: 3,
    carbsGPer100g: 1,
    fatGPer100g: 15,
    fiberGPer100g: 3,
  },
  {
    name: 'Jackfruit, ripe (raw)',
    region: 'South & Southeast Asia',
    aliases: ['kathal', 'nangka'],
    caloriesPer100g: 95,
    proteinGPer100g: 2,
    carbsGPer100g: 23,
    fatGPer100g: 1,
    fiberGPer100g: 2,
    note: 'Young/green jackfruit used as a savory meat substitute (common in curries) runs lower-calorie than this ripe-fruit figure — treat this as a rough anchor, not that preparation specifically.',
  },
  {
    name: 'Tempeh',
    region: 'Indonesia',
    aliases: [],
    caloriesPer100g: 192,
    proteinGPer100g: 20,
    carbsGPer100g: 8,
    fatGPer100g: 11,
    fiberGPer100g: 9,
  },
  {
    name: 'Natto',
    region: 'Japan',
    aliases: [],
    caloriesPer100g: 212,
    proteinGPer100g: 18,
    carbsGPer100g: 14,
    fatGPer100g: 11,
    fiberGPer100g: 5,
  },
  {
    name: 'Miso paste',
    region: 'Japan',
    aliases: ['miso soup base'],
    caloriesPer100g: 199,
    proteinGPer100g: 13,
    carbsGPer100g: 26,
    fatGPer100g: 6,
    fiberGPer100g: 5,
    note: "A little goes a long way — a bowl of miso soup uses maybe 15-20g of paste, not 100g. Scale the portion field down to what you actually stirred in, not a whole bowl's weight.",
  },
]);

/**
 * Case/whitespace-insensitive substring match against each staple's
 * name, region, and alias list (the dish names people actually search
 * for — "injera", "fufu", "ful medames" — rather than the staple
 * ingredient's own name). Empty query returns every staple, same as
 * an unfiltered "browse regional staples" view.
 *
 * @param {string} query
 * @returns {typeof REGIONAL_STAPLE_FOODS[number][]}
 */
export function searchRegionalStaples(query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return [...REGIONAL_STAPLE_FOODS];

  return REGIONAL_STAPLE_FOODS.filter((food) => {
    const haystack = [food.name, food.region, ...food.aliases].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

// A tablespoon (~14g) of cooking oil is the single biggest, most common
// swing factor a per-100g staple figure misses for a home-cooked dish —
// USDA lists vegetable oil at ~884 kcal/100g, so one tablespoon is
// ~124 kcal, essentially all fat. Surfaced as a fixed reference figure
// in the "how to estimate a dish that's not in either list" guidance,
// not applied automatically to anything (this app never adds a number
// nobody actually confirmed was eaten).
export const COOKING_OIL_KCAL_PER_TABLESPOON = 124;
export const COOKING_OIL_FAT_G_PER_TABLESPOON = 14;
