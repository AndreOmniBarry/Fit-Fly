// The onboarding safety screen collects the injured area as free text
// ("right knee", "lower back", ...) because forcing it into a dropdown
// loses real detail people want to say. Program generation still needs a
// reliable way to route around it, so this is a small, honest keyword
// heuristic — not a body-part classifier — that maps free text onto the
// same small tag set exercises declare in their `contraindications`.
// Unrecognized text safely falls through to 'other', which no exercise's
// contraindications list uses, so nothing gets excluded on a false miss —
// the failure mode here is under-filtering, never over-filtering.

export const BODY_AREA_TAGS = Object.freeze([
  'knee',
  'lower-back',
  'shoulder',
  'wrist',
  'hip',
  'ankle',
  'neck',
]);

const KEYWORDS = Object.freeze({
  knee: ['knee'],
  'lower-back': ['lower back', 'low back', 'lumbar', 'spine', 'sciatic'],
  shoulder: ['shoulder', 'rotator cuff', 'rotator'],
  wrist: ['wrist', 'forearm'],
  hip: ['hip', 'groin'],
  ankle: ['ankle', 'shin', 'calf', 'achilles'],
  neck: ['neck', 'cervical'],
});

/** Maps free-text body-area input to one of BODY_AREA_TAGS, or 'other'
 *  if nothing matches. */
export function tagBodyArea(freeText) {
  if (!freeText) return 'other';
  const normalized = freeText.toLowerCase();
  for (const tag of BODY_AREA_TAGS) {
    if (KEYWORDS[tag].some((kw) => normalized.includes(kw))) return tag;
  }
  return 'other';
}
