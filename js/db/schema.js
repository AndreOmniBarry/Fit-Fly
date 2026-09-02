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

  // v3 — heart rate: camera-PPG estimates, manual entries, and BLE strap
  // readings all land in one store, distinguished by `source`.
  db.version(3).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',

    // source: 'camera-ppg' | 'manual' | 'ble'. Only camera-ppg readings
    // carry a confidence — manual entries and a real BLE strap are both
    // MEASURED, not estimated, so there's nothing to grade there.
    heartRateSamples: '++id, recordedAt, source',
  });

  // v4 — women's health + settings.
  db.version(4).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',

    // Small key-value store for app-level settings. Currently just the
    // women's-health PIN verifier (see js/lib/crypto.js) — never the PIN
    // itself, only enough to check a later attempt against.
    settings: 'key',

    // One row per logged day, keyed by the date itself (a day has at
    // most one entry, so this also gives upsert-by-date for free). Only
    // `date` and `updatedAt` are plaintext — everything a person
    // actually logged (flow, symptoms, mood, notes) lives inside
    // `cipherBytes`, AES-GCM-encrypted with the PIN-derived key. `iv`
    // must stay alongside its ciphertext (it's not secret, but reusing
    // an iv with the same key breaks AES-GCM's guarantees, so each
    // row gets its own).
    cycleLogs: 'date, updatedAt',
  });

  // v5 — nutrition: manual food entries, aggregated per day.
  db.version(5).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',

    // `date` (YYYY-MM-DD) is what daily-totals queries actually filter
    // on; `loggedAt` (full timestamp) is only for display/ordering
    // within a day.
    nutritionEntries: '++id, date, loggedAt',
  });

  // v6 — recovery: one readiness check-in per day.
  db.version(6).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',
    nutritionEntries: '++id, date, loggedAt',

    // Keyed by date like cycleLogs — at most one check-in per day, so a
    // second save for today just overwrites the first.
    readinessCheckins: 'date, checkedAt',
  });

  // v7 — goals.
  db.version(7).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',
    nutritionEntries: '++id, date, loggedAt',
    readinessCheckins: 'date, checkedAt',

    // status: 'active' | 'achieved' | 'abandoned' — a string enum, not a
    // boolean, for the same IndexedDB-indexing reason as programs.status.
    goals: 'id, status, createdAt',
  });

  // v8 — Sleep, the first "mini-app": one logged night, keyed by date like
  // cycleLogs/readinessCheckins.
  db.version(8).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',
    nutritionEntries: '++id, date, loggedAt',
    readinessCheckins: 'date, checkedAt',
    goals: 'id, status, createdAt',

    sleepLogs: 'date, loggedAt',
  });

  // v9 — favorite foods for Nutrition's Quick Add: a small, curated,
  // person-maintained list, distinct from nutritionEntries (a per-date
  // log of what was actually eaten) and from a search result (someone
  // else's product data) — this is "foods I log often," one tap away.
  db.version(9).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',
    nutritionEntries: '++id, date, loggedAt',
    readinessCheckins: 'date, checkedAt',
    goals: 'id, status, createdAt',
    sleepLogs: 'date, loggedAt',

    favoriteFoods: 'id, createdAt',
  });

  // v10 — Meditate: one row per completed guided meditation or breathwork
  // session, keyed by when it happened (not by which session — the same
  // meditation can be played any number of times) so streak/trend math
  // can query a real date range, the same shape as heartRateSamples.
  db.version(10).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',
    nutritionEntries: '++id, date, loggedAt',
    readinessCheckins: 'date, checkedAt',
    goals: 'id, status, createdAt',
    sleepLogs: 'date, loggedAt',
    favoriteFoods: 'id, createdAt',

    meditationSessions: '++id, date, completedAt, sessionId',
  });

  // v11 — Vitals: blood pressure and blood oxygen (SpO2), each its own
  // store since their fields genuinely differ (systolic/diastolic vs a
  // single percentage) — same "one row per reading, keyed by when it
  // happened" shape as heartRateSamples, since a person may log either
  // more than once a day.
  db.version(11).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',
    nutritionEntries: '++id, date, loggedAt',
    readinessCheckins: 'date, checkedAt',
    goals: 'id, status, createdAt',
    sleepLogs: 'date, loggedAt',
    favoriteFoods: 'id, createdAt',
    meditationSessions: '++id, date, completedAt, sessionId',

    // source: 'manual' | 'ble' — both MEASURED, never estimated (see
    // js/db/repositories/blood-pressure.js).
    bloodPressureSamples: '++id, recordedAt, source',
    // source: 'manual' | 'ble' — same MEASURED-only contract (see
    // js/db/repositories/spo2.js).
    spo2Samples: '++id, recordedAt, source',
  });

  // v12 — Steps: one row per date, like sleepLogs/readinessCheckins —
  // a running daily total, not a point-in-time sample, since a live-
  // counted walk adds to whatever's already logged for today rather
  // than being its own separate reading.
  db.version(12).stores({
    profile: 'id',
    categoryAssignments: '++id, assignedAt',
    injuryScreens: '++id, screenedAt, bodyArea',
    exercises: 'id, *muscleGroups, equipment, difficulty',
    programs: 'id, category, createdAt, status',
    sessions: 'id, startedAt, programId, type',
    sets: '++id, sessionId, exerciseId, completedAt',
    runs: 'id, startedAt, distanceMeters',
    heartRateSamples: '++id, recordedAt, source',
    settings: 'key',
    cycleLogs: 'date, updatedAt',
    nutritionEntries: '++id, date, loggedAt',
    readinessCheckins: 'date, checkedAt',
    goals: 'id, status, createdAt',
    sleepLogs: 'date, loggedAt',
    favoriteFoods: 'id, createdAt',
    meditationSessions: '++id, date, completedAt, sessionId',
    bloodPressureSamples: '++id, recordedAt, source',
    spo2Samples: '++id, recordedAt, source',

    // source: 'manual' | 'sensor' — records which kind of entry most
    // recently set/added-to this date, not a full history of how it got
    // there (see js/db/repositories/steps.js).
    stepEntries: 'date, updatedAt',
  });
}
