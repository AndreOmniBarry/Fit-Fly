// A standard D/W/M/6M/Y time-range switcher — the primitive every mini-
// app's own trend chart had been missing. Steps and Hydration each had
// their own hardcoded 14-day window (same shape, same duplication
// pattern js/lib/streak.ts already found and fixed for streaks);
// extracted here as a real shared primitive instead of a third copy.
//
// Longer ranges bucket into coarser points on purpose — 365 individual
// daily bars would be unreadable in the same bar-chart width a week's 7
// bars already fill, and no real analytics app (Apple Health included)
// draws one bar per day past a month. D/W/M stay daily; 6M buckets by
// week; Y buckets by month.

export type TimeRangeKey = 'D' | 'W' | 'M' | '6M' | 'Y';

export const TIME_RANGE_KEYS: TimeRangeKey[] = ['D', 'W', 'M', '6M', 'Y'];

const RANGE_DAYS: Record<TimeRangeKey, number> = { D: 1, W: 7, M: 30, '6M': 183, Y: 365 };
const RANGE_BUCKET: Record<TimeRangeKey, 'day' | 'week' | 'month'> = {
  D: 'day',
  W: 'day',
  M: 'day',
  '6M': 'week',
  Y: 'month',
};

export interface TimeRangeBounds {
  /** YYYY-MM-DD, inclusive. */
  start: string;
  /** YYYY-MM-DD, inclusive — always `todayDate`. */
  end: string;
  bucket: 'day' | 'week' | 'month';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The real date window a range key covers, ending today — `todayDate`
 *  injected rather than computed with `new Date()` here, same
 *  determinism rule js/lib/calendar-grid.ts's own day-grid math follows. */
export function timeRangeBounds(range: TimeRangeKey, todayDate: string): TimeRangeBounds {
  const anchor = new Date(`${todayDate}T00:00:00`);
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - (RANGE_DAYS[range] - 1));
  return { start: formatDate(start), end: todayDate, bucket: RANGE_BUCKET[range] };
}

/** Real, honest copy for what's actually on screen — never a bare
 *  unlabeled "D/W/M/6M/Y" left for someone to guess the meaning of. */
export function timeRangeDescription(range: TimeRangeKey): string {
  switch (range) {
    case 'D':
      return 'Today only.';
    case 'W':
      return 'Last 7 days.';
    case 'M':
      return 'Last 30 days.';
    case '6M':
      return 'Last 6 months, grouped by week.';
    case 'Y':
      return 'Last 12 months, grouped by month.';
  }
}

export interface DailyPoint {
  /** YYYY-MM-DD. */
  date: string;
  value: number;
}

export interface BucketedPoint {
  /** The bucket's own key — the date itself for 'day', the bucket's
   *  first day (Sunday-start, same convention as calendar-grid.ts's
   *  month grid) for 'week', YYYY-MM for 'month'. */
  key: string;
  /** The average of every logged day's value within this bucket — never
   *  a sum, and never treating a day with no entry as a fabricated zero.
   *  A sum would scale with how many days happen to be in the bucket
   *  (and a partial trailing bucket at the range edge would look
   *  artificially low); averaging only the days that actually have data
   *  is the one honest way to compare buckets of different real lengths. */
  value: number;
  /** How many real logged days this average is actually built from —
   *  callers can use this to caveat a bucket built from just one or two
   *  days rather than presenting it with the same confidence as a full
   *  week/month of data. */
  daysLogged: number;
}

function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return formatDate(d);
}

/** Groups already-per-day points into the requested bucket size. `'day'`
 *  is a pass-through (one point per point) since D/W/M stay daily; for
 *  `'week'`/`'month'`, real days sharing a bucket are averaged together
 *  (see BucketedPoint's own doc comment on why average, not sum).
 *  Input order doesn't matter; output is sorted by bucket key. */
export function bucketDailyPoints(points: DailyPoint[], bucket: 'day' | 'week' | 'month'): BucketedPoint[] {
  if (bucket === 'day') {
    return [...points]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({ key: p.date, value: p.value, daysLogged: 1 }));
  }

  const groups = new Map<string, number[]>();
  for (const point of points) {
    const key = bucket === 'week' ? weekStartOf(point.date) : point.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(point.value);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({
      key,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
      daysLogged: values.length,
    }));
}

/** Parses a month-bucket key ("YYYY-MM") into that month's 1st, in local
 *  time — a plain `new Date("YYYY-MM")` would parse as UTC midnight,
 *  which can roll back a day in any timezone behind UTC (the same class
 *  of bug program-calendar.js's own localDateFromIso guards against). */
function monthBucketDate(key: string): Date {
  const parts = key.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  return new Date(year, month - 1, 1);
}

/** Short text under a trend-chart bar — a weekday initial for a single
 *  day (matches Steps/Hydration's own pre-existing style), a short date
 *  for a week bucket, a month abbreviation for a month bucket. Shared
 *  once instead of re-implemented per mini-app, same reasoning as
 *  bucketDailyPoints itself. */
export function formatBucketAxisLabel(key: string, bucket: 'day' | 'week' | 'month'): string {
  if (bucket === 'month') {
    return monthBucketDate(key).toLocaleDateString(undefined, { month: 'short' });
  }
  const date = new Date(`${key}T00:00:00`);
  return bucket === 'week'
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : date.toLocaleDateString(undefined, { weekday: 'narrow' });
}

/** The muted second tooltip line naming exactly what real span of time a
 *  bucket covers — "Mon 15" for a single day, "Week of Mar 15" for a
 *  week (never just its first day with no indication it's a range), the
 *  full "March 2026" for a month. */
export function formatBucketDetailLabel(key: string, bucket: 'day' | 'week' | 'month'): string {
  if (bucket === 'month') {
    return monthBucketDate(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const date = new Date(`${key}T00:00:00`);
  if (bucket === 'week') {
    return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
