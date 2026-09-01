// Age-banded sleep-duration guidance — the National Sleep Foundation's
// published recommendations (Hirshkowitz et al., "National Sleep
// Foundation's sleep time duration recommendations: methodology and
// results summary", Sleep Health, 2015), not an arbitrary "8 hours is the
// goal" line. Each band names a "recommended" range (full marks), a wider
// "may be appropriate" range either side of it (partial credit — real
// individual variation exists), and everything past that as "not
// recommended" (both under- *and* over-sleeping score down from there,
// deliberately: sleep research is consistently clear that habitually
// long sleep carries its own associated risks, not just short sleep, so
// "more hours is always better" is exactly the kind of unscientific
// shortcut this module replaces).
export interface DurationBand {
  label: string;
  recommendedMinHours: number;
  recommendedMaxHours: number;
  mayBeAppropriateMinHours: number;
  mayBeAppropriateMaxHours: number;
}

// Sleep-relevant adult bands only — this app doesn't track minors.
const YOUNG_ADULT: DurationBand = {
  label: 'young adult (18-25)',
  recommendedMinHours: 7,
  recommendedMaxHours: 9,
  mayBeAppropriateMinHours: 6,
  mayBeAppropriateMaxHours: 11,
};
const ADULT: DurationBand = {
  label: 'adult (26-64)',
  recommendedMinHours: 7,
  recommendedMaxHours: 9,
  mayBeAppropriateMinHours: 6,
  mayBeAppropriateMaxHours: 10,
};
const OLDER_ADULT: DurationBand = {
  label: 'older adult (65+)',
  recommendedMinHours: 7,
  recommendedMaxHours: 8,
  mayBeAppropriateMinHours: 5,
  mayBeAppropriateMaxHours: 9,
};

/** Sleep works without a profile (see the README's "Onboarding is
 *  optional") — this is the general-adult band NSF's own summary uses
 *  when no more specific age is known, deliberately the same shape as
 *  ADULT rather than a made-up middle ground. */
export const GENERAL_ADULT_BAND: DurationBand = ADULT;

export function durationBandForAge(age: number | null): DurationBand {
  if (age == null) return GENERAL_ADULT_BAND;
  if (age < 26) return YOUNG_ADULT;
  if (age < 65) return ADULT;
  return OLDER_ADULT;
}

/** 100 within the recommended range; a straight taper down to 40 at the
 *  edge of "may be appropriate" either side (real, but not ideal); a
 *  further taper toward 0 beyond that. Symmetric under- and over-sleep
 *  handling — see the module doc comment for why. */
export function scoreDurationAgainstBand(durationMinutes: number, band: DurationBand): number {
  const hours = durationMinutes / 60;
  if (hours >= band.recommendedMinHours && hours <= band.recommendedMaxHours) return 100;

  if (hours < band.recommendedMinHours) {
    if (hours <= band.mayBeAppropriateMinHours) {
      // Beyond "may be appropriate" on the short side: keep tapering
      // toward 0, floor at a 3-hour-short landing rather than a hard
      // cliff, since actigraphy-adjacent scoring should degrade, not
      // truncate.
      const span = band.mayBeAppropriateMinHours; // hours from 0 to that edge
      return Math.max(0, 40 * (hours / span));
    }
    const span = band.recommendedMinHours - band.mayBeAppropriateMinHours;
    const into = hours - band.mayBeAppropriateMinHours;
    return 40 + (into / span) * 60;
  }

  // Over the recommended range.
  const overshoot = hours - band.recommendedMaxHours;
  if (hours <= band.mayBeAppropriateMaxHours) {
    const span = band.mayBeAppropriateMaxHours - band.recommendedMaxHours;
    return 100 - (overshoot / span) * 60;
  }
  // Beyond "may be appropriate" on the long side: keep tapering toward 0
  // over the next three hours past that edge.
  const pastAppropriate = hours - band.mayBeAppropriateMaxHours;
  return Math.max(0, 40 * (1 - pastAppropriate / 3));
}
