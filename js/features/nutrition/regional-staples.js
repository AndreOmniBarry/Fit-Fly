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
    name: 'Millet, whole grain (raw)',
    region: 'West & East Africa, Sahel, South Asia',
    aliases: ['pearl millet', 'fura', 'kunu', 'kunu-zaki', 'dawa', 'bajra'],
    caloriesPer100g: 378,
    proteinGPer100g: 11,
    carbsGPer100g: 73,
    fatGPer100g: 4,
    fiberGPer100g: 8,
    note: "Fura and kunu are this grain ground/soaked into a drink or dumpling with water — expect the finished drink to read far lower per 100g than this dry-grain figure, same water-content caveat as sorghum/teff above.",
  },
  {
    name: 'Fonio, whole grain (raw)',
    region: 'West Africa (Guinea, Mali, Senegal, Nigeria)',
    aliases: ['acha', 'hungry rice', 'findi'],
    caloriesPer100g: 343,
    proteinGPer100g: 8,
    carbsGPer100g: 76,
    fatGPer100g: 2,
    fiberGPer100g: 4,
    note: 'One of the oldest cultivated cereals in Africa and genuinely under-represented in Western food databases — this is the dry, uncooked grain; cooked fonio (steamed like couscous) takes on water and reads lower per 100g.',
  },
  {
    name: 'Egusi seeds (dried)',
    region: 'West & Central Africa',
    aliases: ['egusi soup', 'melon seed', 'agushi'],
    caloriesPer100g: 550,
    proteinGPer100g: 28,
    carbsGPer100g: 15,
    fatGPer100g: 45,
    fiberGPer100g: 4,
    note: "This is the dried seed itself, not a serving of egusi soup — the soup adds palm oil, meat/fish, and leafy greens on top, each of which needs adding separately (see the oil note below for the palm oil portion).",
  },
  {
    name: 'Bambara groundnut (cooked)',
    region: 'West Africa (Nigeria, Ghana)',
    aliases: ['okpa', 'jugo bean', 'bambara bean'],
    caloriesPer100g: 120,
    proteinGPer100g: 7,
    carbsGPer100g: 20,
    fatGPer100g: 2,
    fiberGPer100g: 5,
    note: 'Okpa is this legume steamed into a moin-moin-style pudding, often with palm oil mixed in — this figure is the plain boiled bean before that oil.',
  },
  {
    name: 'Moringa leaves, dried (powder)',
    region: 'Pan-African, South Asia',
    aliases: ['moringa powder', 'zogale', 'drumstick leaf'],
    caloriesPer100g: 205,
    proteinGPer100g: 27,
    carbsGPer100g: 38,
    fatGPer100g: 2,
    fiberGPer100g: 20,
    note: "Used a spoonful at a time stirred into soup or a drink, essentially never eaten as a 100g portion — scale this way down to the real amount used, same as the miso note above.",
  },
  {
    name: 'Baobab fruit pulp (dried powder)',
    region: 'Sahel, Pan-African',
    aliases: ['baobab powder', 'monkey bread fruit'],
    caloriesPer100g: 162,
    proteinGPer100g: 2,
    carbsGPer100g: 76,
    fatGPer100g: 0,
    fiberGPer100g: 44,
    note: 'Unusually fiber-dense even for this list — most of that carbohydrate figure is fiber, not sugar or starch. Typically stirred into water/porridge a spoonful at a time, not eaten as a full 100g portion.',
  },
  {
    name: 'Cocoyam / taro (boiled)',
    region: 'West & Central Africa, Pacific',
    aliases: ['taro', 'ede', 'coco', 'dasheen'],
    caloriesPer100g: 112,
    proteinGPer100g: 2,
    carbsGPer100g: 26,
    fatGPer100g: 0,
    fiberGPer100g: 4,
  },
  {
    name: 'Tigernuts, dried',
    region: 'West Africa, Mediterranean',
    aliases: ['chufa', 'aya', 'imumu'],
    caloriesPer100g: 366,
    proteinGPer100g: 4,
    carbsGPer100g: 33,
    fatGPer100g: 24,
    fiberGPer100g: 8,
  },
  {
    name: 'Okra (raw)',
    region: 'Pan-African, South Asia',
    aliases: ['okoro', "lady's finger", 'ila', 'bhindi'],
    caloriesPer100g: 33,
    proteinGPer100g: 2,
    carbsGPer100g: 7,
    fatGPer100g: 0,
    fiberGPer100g: 3,
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
