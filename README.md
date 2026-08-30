# Fit Fly

A personalized, on-device fitness and health tracker. Onboarding places you
into one category — sedentary start, cut/fat loss, recomposition,
rehab/recuperation, hypertrophy, or endurance — and that choice shapes
everything downstream: your programs, your warm-ups, safety flags, even the
app's accent color. Built by OmniBarry Inc Labs.

Genuinely inspired by the broader "personal fitness tracker" category,
built from scratch — this repo, like its sibling projects, never names or
compares itself to any specific existing fitness app, wearable, or
platform anywhere in its code, docs, or history.

## Not medical advice

Fit Fly is a self-tracking tool, not a medical device and not a substitute
for a doctor, physical therapist, or other qualified professional. Its
programs, safety flags, readiness scores, and injury/pain screening are
general-purpose heuristics, not a diagnosis or a treatment plan. If
something hurts, stop and get it checked out. If you have an existing
condition, are pregnant, or are recovering from an injury or surgery, talk
to a professional before starting or changing a program. In a medical
emergency, contact emergency services — not this app.

## Your data stays on this device

There is no account and no server. Everything Fit Fly tracks — profile,
workouts, GPS routes, heart-rate samples, cycle logs, nutrition, goals —
lives in this browser's IndexedDB, on this device, and nowhere else. That
matters most for the women's-health/cycle data, which is additionally
encrypted at rest (AES-GCM via Web Crypto) and gated behind the app's
optional PIN lock. Uninstalling the app or clearing site data deletes it
permanently — there is no cloud copy to restore from, and no export/import
tooling yet is a known gap, not an oversight.

## Honesty about measured vs. estimated data

Anything Fit Fly cannot directly measure — calories burned, camera-based
heart rate, sleep quality — is always labeled as an **estimate**, never
presented with false precision. Look for the badge:

- `MEASURED` — came straight from a sensor or a value you entered.
- `ESTIMATED` — a heuristic or model output, shown with its confidence.

## Platform notes (why web, not a native app)

Fit Fly is a plain ES-module web app — no framework, no bundler — the same
proven pattern as this publisher's other on-device apps. It's installable
as a home-screen PWA on iOS/Android and works fully offline once loaded.
The trade-off, accepted deliberately: GPS tracking only works while the
screen is on (mitigated with the Screen Wake Lock API), there's no
HealthKit/Google Fit bridge, and iOS has no Bluetooth heart-rate-strap
support in the browser — camera-based PPG heart-rate estimation and manual
entry cover that gap, always labeled as an estimate per the rule above.

## Layout

```
index.html            # app shell: splash + screen router mount point
manifest.json          # PWA manifest
css/
  tokens.css            # design tokens: light/dark themes, per-category accents
  base.css               # reset, app chrome, screen-router styles
  components.css           # shared buttons/cards/forms/chips/nav
js/
  main.js                   # bootstrap
  lib/                       # cross-feature pure logic + small DOM helpers
  db/                         # Dexie (IndexedDB) schema and store access
  features/
    onboarding/                # profile/BMI intake + category engine
    activity/                    # activity logging, measured-vs-estimated UI
    programs/                     # tailored exercise programs, periodization
    exercises/                     # exercise library + hand-authored demo SVGs
    run/                             # GPS run mode: map, history, PRs
    heart-rate/                       # camera PPG, manual entry, BLE (feature-detected)
    womens-health/                     # cycle tracker (encrypted store)
    nutrition/                          # macro/nutrition tracking
    recovery/                            # recovery + readiness scoring
    goals/                                # goals + local notifications
    voice/                                 # closed-grammar voice commands
  vendor/                                  # vendored libraries (npm registry, not a live CDN)
assets/
  icons/                     # app icons
  exercise-svgs/              # hand-authored exercise demonstration SVGs
tests/
  unit/                       # Vitest — pure-logic math (BMI/BMR/TDEE, GPS,
                                # cycle prediction, program generation, 1RM,
                                # PPG signal processing, voice-grammar matching)
  e2e/                          # Playwright — real UI flows, zero console errors
scripts/
  serve.mjs                   # zero-dependency static server (dev + e2e)
```

## Running locally

```bash
npm install
npm run serve
```

Then open `http://127.0.0.1:4173`.

## Testing

```bash
npm test          # Vitest — pure-logic unit tests
npm run test:e2e  # Playwright — end-to-end UI tests (starts its own server)
```

Both are expected to pass, with zero console errors in the Playwright
runs, before any phase of work is considered done.

## Status

Building in phases — foundation, data layer, onboarding/category engine,
activity tracking, timers, tailored programs, run mode, heart rate,
women's health, nutrition, recovery, goals, voice, and a final polish
pass. Currently: **Phase 2, data layer**, is complete.

## Data layer

`js/db/schema.js` is the source of truth for what's persisted — Dexie
(IndexedDB) stores for the profile, category-assignment history, injury
screens, the exercise library, programs, sessions, and sets, each with a
thin repository module under `js/db/repositories/` (plain CRUD + the
handful of queries each feature needs — no ORM magic). Dexie itself is
vendored locally at `js/vendor/dexie.min.mjs` (fetched via `npm pack`, not
a live CDN — see `js/vendor/THIRD_PARTY_NOTICES.md`).

Later phases (run mode, heart rate, women's health, nutrition, recovery,
goals) each add their own store via a new `db.version(N).stores({...})`
bump rather than speculatively defined now — see the comments in
`schema.js` for the ground rules that keep IndexedDB indexing correct
(most importantly: never index a boolean field, it silently fails).

Unit tests for the data layer run against
[`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) in Node;
`tests/e2e/db.spec.js` additionally exercises the same vendored Dexie
build against a real browser's IndexedDB, since fake-indexeddb doesn't
reproduce every real-browser quirk.
