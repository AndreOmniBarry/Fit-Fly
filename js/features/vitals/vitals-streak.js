// Same consecutive-day-ending-today streak math as every other mini-app's
// own streak — a day counts if it has at least one blood-pressure OR SpO2
// reading logged (either type), since both live under this one Vitals
// mini-app and the Hub tile shows one combined streak, not two competing
// numbers. The actual date-gap walk lives in js/lib/streak.ts now, shared
// with Sleep/Meditate/Steps/Hydration/Badges instead of staying its own
// copy.
import { calculateStreak } from '../../lib/streak.js';
/** @param dates 'YYYY-MM-DD' strings, one per reading (BP and SpO2
 *  combined) — duplicates and any order are fine. */
export function calculateVitalsStreak(dates) {
    return calculateStreak(dates);
}
//# sourceMappingURL=vitals-streak.js.map