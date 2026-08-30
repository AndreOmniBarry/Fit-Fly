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
pass. Currently: **Phase 10, nutrition**, is complete.

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

## Onboarding + the category engine

`js/features/onboarding/category-engine.js` is a transparent, rule-based
decision tree — never a black box — that places a person into exactly one
of the six categories. Every branch records a plain-language reason,
which becomes the result screen's "why this" note. Precedence, safety
first:

1. Any red-flag symptom, or a moderate-or-worse current injury/pain, or a
   stated goal of "recovering from injury/surgery" → **rehab-recuperation**,
   always, regardless of what else was answered.
2. Training 0-1 days/week as a self-described beginner → **sedentary-start**
   — build a consistent base before layering on a goal-driven program.
3. Otherwise, routed by the stated goal (fat loss, build muscle,
   recomposition, endurance), with a BMI-informed default for anyone who
   picked "just general fitness."

A red flag also sets `needsProfessionalReview`, which the result screen
surfaces as a caution banner — Fit Fly still isn't a diagnosis, it's a
prompt to go talk to someone qualified.

The wizard (`js/features/onboarding/wizard.js`) walks: basics (birthdate,
sex assigned at birth, height/weight in metric or imperial) → current
activity + experience → primary goal → the safety screen → a result
screen — then writes the profile, an injury-screen record, and a
category-assignment record (the append-only history `categoryAssignments`
table exists for) to IndexedDB. `js/lib/router.js` is the generic
show/hide screen router every later phase's navigation builds on, and
`js/lib/chip-group.js` is the single/multi-select control used throughout
the wizard.

## Activity tracking

The home dashboard (extensible: each phase adds an action card here,
never a rework) links to a quick-log form and a history list. Logging an
activity — type, felt intensity, duration — writes a `sessions` row with
`type: 'activity'`.

Calories burned is never something this app can *measure* — there's no
sensor for it — so `js/features/activity/calorie-estimate.js` derives it
from a standard MET formula (`kcal/min = MET x 3.5 x bodyweight(kg) / 200`)
against a small static MET table, rounds to the nearest 5 kcal (never a
false-precise decimal), and always tags the result `ESTIMATED` with a
confidence — `medium` for a matched activity, `low` for "other" — there is
no `high` tier for this number anywhere in the app, because that would
require a sensor Fit Fly doesn't have.

## Timers

`js/lib/timer.js` is wall-clock-based, deliberately never a naive
`setInterval` tick counter. A ticking `setInterval(fn, 1000)` that does
`remaining -= 1000` per tick silently drifts the moment a tab is
backgrounded/throttled or the screen locks — browsers slow or pause
timers exactly in those cases. Instead, `createCountdown`/
`createStopwatch` record a real timestamp on start and always *compute*
remaining/elapsed time as `now() - startedAt` whenever asked, so however
late the next check-in runs, the value it reports is still exactly
correct — proven in tests with a fake clock that jumps forward in one
huge step (simulating a stalled background tab) and checking the timer
reads precisely as if many small ticks had happened instead. A UI layer
(`js/features/timers/rest-timer.js`) polls on a loose cadence purely to
know when to re-render; that cadence never becomes the source of truth.

The Rest Timer (a new home-dashboard card) is the first thing built on
top of this — presets or a custom duration, start/pause/reset, and a
synthesized completion beep (`js/lib/audio-cue.js`, Web Audio, no audio
file) plus best-effort device vibration, both wrapped so a missing or
blocked API never throws.

## Tailored programs + periodization

`js/features/exercises/exercise-library.js` is a small, curated library —
12 exercises across six movement patterns (squat, hinge, push, pull,
core, cardio), each beginner-reachable in at least one entry, each with a
hand-authored line-art demo SVG under `assets/exercise-svgs/` (loaded
inline via `js/lib/svg-loader.js` so `stroke="currentColor"` picks up the
surrounding theme). `js/features/programs/program-generator.js` turns a
category + experience level + any flagged injury area into a concrete
week: which exercises (deterministic — same inputs always produce the
same program, no randomness to fight in tests), how many sets/reps, how
much rest, and a plain-language "why this" reasoning. Safety routing
(`js/features/programs/body-area-tag.js`) maps the onboarding safety
screen's free-text injury area onto a small keyword-matched tag set and
excludes any exercise whose `contraindications` include it — under-
filtering on a miss, never over-filtering.

`js/features/programs/periodization.js` is a standard 4-week mesocycle:
three weeks of progressive load, then a deload week at reduced volume.
`js/features/programs/week-number.js` derives which week a person is on
from how long ago their program started, so the program itself is never
persisted as static content — `programs` stores just the category,
experience level, and start date, and the week's actual content is
(re)computed live every time, which means an improvement to the
generator applies retroactively to everyone's program, not just new
ones.

## Run mode

`js/features/run/gps-math.js` is the sensor-honest core: haversine
distance between consecutive fixes, a pace formula that returns `null`
(never `Infinity`/`NaN`) with nothing to divide by yet, and
`filterAccuratePoints` — GPS is noisy, so any fix reporting an accuracy
radius worse than 30m is dropped before it can add a phantom couple
hundred meters to the total. `js/features/run/run-tracker.js` drives
`navigator.geolocation.watchPosition` and the Wake Lock API
(`js/lib/wake-lock.js`, feature-detected/best-effort — the accepted
trade-off from the README's platform notes: GPS tracking only survives
with the screen on) into the same wall-clock stopwatch from Phase 5, and
re-requests the wake lock on `visibilitychange` since the spec drops it
automatically the moment a tab backgrounds.

There's no basemap. Drawing one needs a live tile-imagery service (an
external dependency this on-device app otherwise has none of) and a
mapping library to vendor — `js/features/run/route-canvas.js` instead
normalizes the recorded points into a `<canvas>` and draws just the
route's shape, in the current theme's accent color, no tiles required.
`js/features/run/personal-records.js` checks a finished run against
every prior one for a distance and/or pace PR (pace PRs only count runs
at or past 1km, so a 50-meter sprint can't "beat" a real run). A run is
only written to the `runs` store once completed — a route's points live
as one embedded array on that run's own record rather than a separate
table, since they're only ever read back as a whole to redraw that run's
own path, never queried across runs.

## Heart rate

Three sources feed one `heartRateSamples` store, distinguished by
`source`: camera-based PPG, manual entry, and a Bluetooth strap.

`js/features/heart-rate/ppg-signal.js` is the estimator: detrend (remove
slow baseline drift from finger pressure/lighting), smooth, detect peaks
above a dynamic threshold with a physiological refractory period, take
the median inter-beat interval, and grade a confidence from how
consistent that spacing is — proven with synthetic sine-wave signals at
known BPMs (deterministic, no `Math.random()`, so these tests never
flake) recovered within 2 bpm, and proven to refuse a result (`null`,
never a fabricated number) on too little data, a flat/no-pulse signal, or
an implausible rate. `js/features/heart-rate/camera-ppg.js` is the thin
`getUserMedia` + offscreen-canvas layer that feeds it real frames — a
fingertip over the rear camera makes the average red-channel brightness
pulse with each heartbeat.

`js/features/heart-rate/ble-heart-rate.js` is Web Bluetooth, feature-
detected (`isBluetoothAvailable()`) since it's a Chrome/Android-only API
with no Safari/iOS implementation — the UI degrades to "use the camera or
a manual entry instead" rather than a dead button. Its BLE payload parser
(the standard Bluetooth SIG Heart Rate Measurement format: a flags byte
picking 8- vs 16-bit encoding) is pure and unit-tested from a raw
`DataView`, independent of any actual Bluetooth connection.

Every reading gets exactly one badge: camera-PPG is always `ESTIMATED`
with its confidence; manual entry and a BLE strap are both `MEASURED` —
a typed-in number and a dedicated sensor are both real data, just not
data this app derived through a model.

Playwright's Chromium launches with `--use-fake-device-for-media-stream`
(this sandbox has no real camera), which lets `heart-rate.spec.js` drive
the entire capture pipeline — permission, video frames, canvas sampling,
progress, completion — end to end; the fake device's synthetic test-
pattern video has no real pulse in it, so the test accepts either a
result or the "couldn't get a clear reading" outcome, since what it's
actually proving is that the pipeline runs to completion without
throwing either way.

## Women's health / cycle tracker

The most sensitive data this app holds gets the most protection: real
AES-GCM encryption (`js/lib/crypto.js`, the browser's own Web Crypto API,
not a custom cipher) keyed by a PIN set specifically for this section —
not the general/optional app-lock the platform notes mention elsewhere,
but a hard requirement to use the cycle tracker at all. The PIN itself is
never stored in any form, anywhere; AES-GCM's built-in authentication tag
doubles as the PIN check (decrypting a known probe value with the wrong
derived key just fails), so there's no separate password-hash scheme to
get subtly wrong. The derived key lives only in memory for the life of
the page (`js/features/womens-health/pin.js`) — a reload always re-locks,
on purpose.

Forgetting the PIN makes the data genuinely unrecoverable — that's
correct behavior for real encryption, not a gap. The only way out is an
explicit, clearly-warned reset that deletes the PIN *and* every log it
protected, never a backdoor around either. Each day's record
(`cycleLogs`, keyed by date) keeps only the date and an IV in plaintext;
everything actually logged — flow, symptoms, mood, notes — lives inside
the ciphertext.

`js/features/womens-health/cycle-prediction.js` estimates the next
period and fertile window from a plain list of past period start dates —
deliberately decoupled from the encrypted records themselves, so this
pure/testable module never touches a PIN or a key. Its confidence
reflects how much (and how regular) a history it has to extrapolate
from — `low` off one or two cycles, up to `high` only with a longer,
consistent one — always shown as an estimate, never a certainty.

## Nutrition

`js/features/nutrition/bmr-tdee.js` is BMR (Mifflin-St Jeor) x an
activity-level multiplier off self-reported weekly active days. Both are
population-average formulas, not a metabolic measurement — real
individual variation runs ±10% or more even with perfect inputs — so the
calorie target is always shown as a range (`tdeeConfidenceBand`, rounded
to the nearest 10 kcal) at a confidence that's always `'low'`, never
fabricating more certainty than a formula-and-activity-bucket estimate
can support. The category-based adjustment (a deficit for fat loss, a
surplus for hypertrophy, maintenance otherwise) is deliberately modest —
never a crash-diet-sized cut. `js/features/nutrition/macro-targets.js`
scales protein by bodyweight and category (higher in a cut, to protect
muscle), fixes fat at ~30% of calories, and lets carbs fill whatever's
left — never negative, even against a very low calorie target with a
high protein/fat floor.

Food logging is manual entry only — no packaged food database to search,
which would mean either fabricating nutrition data or another live
external dependency this offline-first app doesn't otherwise have. Daily
totals (`nutritionEntries`, one row per entry, aggregated by date) are
summed and compared against the estimated targets. This is also the
first screen where a person's own free-text input (a food name) gets
rendered back into the page, so it's the first place `js/lib/html.js`'s
`escapeHtml()` matters — every list in the app before this one only ever
rendered static labels or numbers.
