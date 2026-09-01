// Real one-tap "log this again" shortcuts, built entirely from what's
// actually been logged before — nothing new to maintain, and (unlike a
// search result) these are exact amounts someone actually ate, not a per-
// 100g product figure, so a tap here can log immediately rather than
// needing a review-and-adjust step first.

const DEFAULT_LIMIT = 8;

/**
 * @param {{name:string, calories:number, proteinG:number, carbsG:number, fatG:number}[]} entriesNewestFirst
 * @param {number} [limit]
 * @returns {typeof entriesNewestFirst} - deduplicated by name (case/
 *   whitespace-insensitive), each name's most recently-logged amounts,
 *   ordered by how recently each was last logged.
 */
export function computeRecentFoods(entriesNewestFirst, limit = DEFAULT_LIMIT) {
  const seenNames = new Set();
  const recent = [];
  for (const entry of entriesNewestFirst) {
    const key = entry.name.trim().toLowerCase();
    if (!key || seenNames.has(key)) continue;
    seenNames.add(key);
    recent.push(entry);
    if (recent.length >= limit) break;
  }
  return recent;
}
