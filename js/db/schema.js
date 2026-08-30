// The Dexie (IndexedDB) schema — the single source of truth for every store
// this app persists. Grows one Dexie.version() bump per phase that needs a
// new store; never edit an already-shipped version's store list except to
// add a real migration.
//
// A couple of IndexedDB rules that shaped the choices below:
//   - Only strings, numbers, dates, binary, and arrays of those are valid
//     index keys — booleans are NOT, so status/flag fields are indexed as
//     strings (e.g. 'active'/'archived'), never `true`/`false`.
//   - Timestamps are stored as ISO 8601 UTC strings everywhere. They sort
//     lexicographically in the same order as chronologically, so range
//     queries on an indexed timestamp field just work, and they stay
//     trivially JSON-serializable for exports/backups later.

export function defineSchema(db) {
  // v1 — Phase 2 (data layer): the stores every later feature phase reads
  // or writes.
  db.version(1).stores({
    // Singleton row, always id: 'primary'. Everything the category engine
    // (onboarding) reads to place a person into a category, and everything
    // programs/safety-flags read afterward.
    profile: 'id',

    // One row per time the category engine ran, oldest first — an audit
    // trail so "why this" transparency notes can point at what changed
    // and why re-onboarding moved someone to a new category.
    categoryAssignments: '++id, assignedAt',

    // Pain/injury screening results feeding program safety flags and
    // red-flag prompts.
    injuryScreens: '++id, screenedAt, bodyArea',

    // The exercise library. Hand-authored content, not user data, but
    // stored here (rather than a static JSON fetch) so future edits or
    // custom exercises share one code path with the built-in set.
    exercises: 'id, *muscleGroups, equipment, difficulty',

    // Tailored programs the program-generation engine builds.
    programs: 'id, category, createdAt, status',

    // Workout sessions: strength, cardio, run, rest-day check-ins, ...
    sessions: 'id, startedAt, programId, type',

    // Individual sets, normalized out of sessions for fast per-exercise
    // history queries (PRs, volume trends) without scanning every session.
    sets: '++id, sessionId, exerciseId, completedAt',
  });

  // v2 — run mode: GPS runs. Every version() call must restate the full
  // schema for that version (Dexie drops any store left unmentioned), so
  // v1's stores are repeated here unchanged alongside the new one.
  db.version(2).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',

    // A completed run's GPS route is only ever read back as a whole (to
    // redraw that one run's path) — never queried point-by-point across
    // runs — so it's stored as an embedded `route` array on the run
    // record itself rather than a separate points table. Runs are only
    // written once complete (a run in progress lives in memory), so
    // there's no partial/interrupted-write state to model here either.
    runs: 'id, startedAt, distanceMeters',
  });
}
