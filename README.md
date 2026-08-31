# Fit Fly

A personalized, on-device health app built as a **hub of mini-apps** — open
it and you land on a launcher (the Hub) with each mini-app as its own
equal-weight tile, the same way opening a phone shows you a home screen of
separate apps rather than one monolithic tool. **Sleep** and **Focus**
are the first two, built to real, commercial-grade depth rather
than broad-but-shallow; the original 14-phase fitness feature set (activity
logging, tailored programs, run mode, heart rate, women's health,
nutrition, recovery, goals, voice control) still lives in full behind the
**Fitness Toolkit** tile, unchanged. More mini-apps (vitals, step counting)
are planned to land in the Hub the same way. Built by OmniBarry Inc Labs.

Onboarding is optional, not a gate — "Skip for now" lands straight in the
Hub, since Sleep and Focus need no profile data at all. Completing it
(any time, from inside the Fitness Toolkit) places you into one fitness
category — sedentary start, cut/fat loss, recomposition,
rehab/recuperation, hypertrophy, or endurance — and that choice shapes
everything inside the Fitness Toolkit: your programs, your warm-ups,
safety flags, even that section's accent color.

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

Fit Fly is a web app — installable as a home-screen PWA on iOS/Android,
works fully offline once loaded — built with **no bundler and no dev
server rewrite step**: every module the browser loads is a real file at a
real path, the same file `import` statements reference. The original
14-phase feature set is plain ES modules; the Hub, Sleep, and Focus
are authored in **TypeScript** (strict mode) and compiled in place by
`tsc` to the adjacent `.js` the browser actually loads — see "TypeScript,
without a bundler" below. Neither approach pulls in a UI framework.

The trade-off accepted deliberately across the whole app: GPS tracking
only works while the screen is on (mitigated with the Screen Wake Lock
API), background audio (Focus, Sleep's Wind Down) is unreliable once
the screen locks — that's the OS's rule, stated plainly in the UI rather
than glossed over — there's no HealthKit/Google Fit bridge, and iOS has no
Bluetooth heart-rate-strap support in the browser. Camera-based PPG
heart-rate estimation and manual entry cover that last gap, always labeled
as an estimate per the rule above. Sleep, similarly, never claims to sense
anything passively overnight — see "Sleep" below for why.

## Accessibility

- **No emoji anywhere** — see "The Hub" below. Every icon is a real,
  `aria-hidden` SVG next to a real text label, never the only description
  of what a control does.
- **`:focus-visible` keyboard-focus rings use each mini-app's own bright
  accent color** on Sleep/Focus's night surfaces (`.theme-sleep
  :focus-visible` / `.theme-focus :focus-visible` in `mini-apps.css`),
  not just the app-wide neutral accent — noticeably higher contrast
  against a dark gradient than a mid-tone blue would be.
- **`prefers-reduced-motion` is honored everywhere something loops or
  pulses** — the Sleep/Focus starfield twinkle, the breathing pacer's
  ring animation, the Focus now-playing ripple, and the guided-session
  pacer's scale transition all either stop or shorten under it (see the
  `@media (prefers-reduced-motion: reduce)` blocks in `mini-apps.css`).
- **A guided session's caption is the primary channel, not a voice-only
  fallback** — see "Guided sessions" below. It's always shown and updated
  in real time, with voice narration as a separate, switchable-off layer
  on top, specifically so it doesn't talk over someone's own screen
  reader.
- Every heading/label/button in this app carries real semantic
  markup and an `aria-label` where its visible content alone wouldn't
  describe it (icon-only buttons throughout: back arrows, the lock, the
  mic, stop/pause controls, ...) — inherited from the original 14-phase
  build and held to the same bar in everything added on top of it.

## TypeScript, without a bundler

`tsconfig.json` compiles every `js/**/*.ts` file **in place** — `tsc`
emits `foo.js` right next to `foo.ts`, imported everywhere (including from
`index.html`) with a literal `.js` specifier, exactly like every
hand-written module in the original 14-phase build. There's still no
bundler and no dev-server rewrite step: the compiled `.js` is committed
alongside its `.ts` source, the same way the vendored fonts and Dexie
build are committed rather than fetched at build time — Vercel serves this
repo as a static site with no build command (see `vercel.json`), so
whatever ships has to already be plain, runnable JS.

`npm run build` runs the compiler; `pretest`/`pretest:e2e`/`preserve` hooks
run it automatically before Vitest, Playwright, or the dev server, so the
compiled output is never stale when you run any of those. A hand-written
`.d.ts` sits next to a handful of the original build's plain-JS modules
(`router.js`, `timer.js`, `id.js`, `chip-group.js`, `client.js`) — a real
typed contract for the boundary where new TypeScript code calls into old
JavaScript, rather than leaving those calls untyped.

The original 14-phase feature set stays plain JavaScript, deliberately not
migrated — rewriting already-shipped, already-tested code wholesale is a
real regression risk with no user-facing benefit, not something to do
opportunistically alongside unrelated feature work.

## Layout

```
index.html            # app shell: splash + screen router mount point
manifest.json          # PWA manifest
tsconfig.json           # compiles js/**/*.ts in place — see "TypeScript, without a bundler"
css/
  tokens.css            # design tokens: light/dark themes, per-category accents
  base.css               # reset, app chrome, screen-router styles
  components.css           # shared buttons/cards/forms/chips/nav
  mini-apps.css              # Hub + Sleep + Focus's own night-surface visual identity
js/
  main.js                   # bootstrap
  lib/                       # cross-feature pure logic + small DOM helpers, including icons.ts (the app's icon system)
  db/                         # Dexie (IndexedDB) schema and store access
  features/
    hub/                        # the launcher — equal-weight mini-app tile grid (TypeScript)
    sleep/                       # Sleep mini-app: score/consistency/debt, dashboard, Wind Down, Insights (TypeScript)
    focus/                  # Focus mini-app: real Web Audio spatial engine, thunderstorms, guided sessions + voice guidance (TypeScript)
    onboarding/                    # profile/BMI intake + category engine (optional — see "The Hub")
    activity/                       # activity logging, measured-vs-estimated UI
    programs/                        # tailored exercise programs, periodization
    exercises/                        # exercise library + hand-authored demo SVGs
    run/                                # GPS run mode: map, history, PRs
    heart-rate/                          # camera PPG, manual entry, BLE (feature-detected)
    womens-health/                        # cycle tracker (encrypted store)
    nutrition/                             # macro/nutrition tracking
    recovery/                               # recovery + readiness scoring
    goals/                                   # goals + local notifications
    voice/                                    # closed-grammar voice commands
  vendor/
    dexie.min.mjs, fonts/                       # vendored libraries + fonts (npm registry, not a live CDN)
assets/
  icons/                     # app icons
  exercise-svgs/              # hand-authored exercise demonstration SVGs
tests/
  unit/                       # Vitest — pure-logic math (BMI/BMR/TDEE, GPS,
                                # cycle prediction, program generation, 1RM,
                                # PPG signal processing, voice-grammar matching,
                                # sleep scoring/consistency/debt/trends/insights,
                                # focus noise synthesis/spatial motion/impulse
                                # response/thunderclaps/guided-session content)
  e2e/                          # Playwright — real UI flows, zero console errors
scripts/
  serve.mjs                   # zero-dependency static server (dev + e2e)
```

## Running locally

```bash
npm install
npm run serve
```

Then open `http://127.0.0.1:4173`. (`npm run serve` compiles TypeScript
first automatically — see "TypeScript, without a bundler" above.)

## Deploying to Vercel

The repo is ready to deploy as-is — it's a static site (no backend, no
build step): `index.html`, `css/`, `js/`, `assets/`, and `manifest.json`
are served directly. `vercel.json` tells Vercel to skip `npm install`
and any build step entirely (the `devDependencies` are test tooling
only — Vitest, Playwright, `fake-indexeddb` — never loaded at runtime).

Easiest path — import from GitHub, no CLI needed:
1. [vercel.com/new](https://vercel.com/new) → import this repository
   (`AndreOmniBarry/Fit-Fly`).
2. Framework preset: **Other**. Leave the build/output/install command
   fields as detected from `vercel.json` — don't override them.
3. Deploy. That's it.

Or via the CLI, from the repo root: `npx vercel` (first deploy asks a
few setup questions; same "Other" framework preset), then
`npx vercel --prod` to promote it.

A couple of things worth knowing once it's live:
- Every browser tab/device gets its **own** IndexedDB — there's no
  account and no sync, so data doesn't follow you between them (see
  "Your data stays on this device" above).
- GPS (run mode), the camera (heart-rate PPG), Bluetooth, and
  notifications all require HTTPS to work — Vercel serves everything
  over HTTPS by default, so this just works without extra config.
- To test on an iPhone: open the Vercel URL in Safari, then **Share →
  Add to Home Screen** to install it as a standalone PWA.

## Testing

```bash
npm test          # Vitest — pure-logic unit tests
npm run test:e2e  # Playwright — end-to-end UI tests (starts its own server)
```

Both are expected to pass, with zero console errors in the Playwright
runs, before any phase of work is considered done.

## Status

The original fitness tracker was built in 14 phases — foundation, data
layer, onboarding/category engine, activity tracking, timers, tailored
programs, run mode, heart rate, women's health, nutrition, recovery,
goals, voice, and a final polish pass — and lives on in full behind the
Hub's Fitness Toolkit tile. On top of that, the app restructured into the
Hub/mini-apps model described above, with **Sleep** and **Focus**
built out as the first two real mini-apps — Focus including four guided
sessions with free, on-device voice guidance. 425 Vitest unit tests and
198 Playwright end-to-end tests (desktop + mobile-viewport, zero console
errors) are green.

Known, deliberate gaps rather than oversights: no accounts or sync yet —
still entirely on-device, no server, by design (a real backend for
coach/doctor access and cross-device history is planned, deliberately not
built opportunistically alongside this round of work); no export/import
for on-device data either yet; no offline service worker/asset caching
yet; voice commands cover a small closed set of navigation phrases (not
yet extended to Sleep/Focus); and Sleep currently uses a fixed 8-hour
goal rather than a per-person configurable one.

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

## The Hub

Onboarding hands off to the Hub (`#screen-hub` in `index.html`,
`js/features/hub/hub-view.ts`) instead of straight into a feature list.
It's an **equal-weight grid** — every mini-app is the same size tile, none
made a hero at the expense of the others — deliberately, because it's the
pattern every future mini-app (vitals, step counting, and beyond) has to
slot into without the grid needing a rework or something ending up buried
under "more tools." Sleep and Focus get their own gradient identity
per tile; Fitness Toolkit and the "Vitals & Steps — coming soon" tile use
the app's existing neutral surface, since they aren't mini-apps with their
own visual identity (yet, in the coming-soon case).

**No emoji anywhere in the app** — `js/lib/icons.ts` plus a sprite of real
inline SVG `<symbol>` definitions at the top of `index.html` (search it for
"ICON SPRITE") is the app's one and only icon system. An emoji renders as a
different picture per OS (or not at all on some), can't take the
surrounding theme's color, and some screen readers announce its full
Unicode name instead of describing what the button does — real SVG, always
`aria-hidden` next to a real text label or `aria-label`, has none of those
problems. A static HTML spot (`<use href="#icon-name">`) and a JS-built one
(`iconMarkup('name')`) both reference the exact same sprite, so they're
always pixel-identical.

**Onboarding is optional.** "Skip for now" on the splash screen lands
straight in the Hub — Sleep and Focus need zero profile data, so nothing
about them requires registering first. Skipping is remembered
(`localStorage`, the same lightweight preference store the theme setting
already uses) so it only has to happen once. The Fitness Toolkit still
benefits from a real profile (personalized programs, calorie targets,
readiness scoring), so it shows a plain "set up your profile" prompt
instead of silently rendering blank targets when one is missing — onboard
later, from inside the Fitness Toolkit, whenever it's actually wanted.

## Sleep

Sleep is built to the standard the rest of this README holds every
feature to — real math, honest about what it doesn't know, nothing
fabricated — applied to a category where that's easy to get wrong.

**No passive overnight sensing, on purpose, not as a limitation to work
around later.** A phone's microphone and motion sensors both stop
receiving data the moment the screen locks (iOS Safari, confirmed
directly), so any "senses your sleep automatically" claim from a
browser-based PWA would be fiction. Sleep is a fast, honest manual log
instead — bedtime, wake time, how it felt — surfaced right on the
dashboard, never hidden behind a settings screen.

`js/features/sleep/sleep-score.ts` blends three components into one 0-100
score, each with its own reasoning string, the same "why this, not just a
number" contract as `readiness.js`:
- **Duration** — logged hours against an 8-hour goal.
- **Consistency** — `sleep-consistency.ts` computes the standard deviation
  of recent bedtimes (shifted so "noon" is the zero-point, so a bedtime
  that crosses midnight doesn't register a fake ~24-hour jump) — tight
  bedtimes score high, erratic ones score low. Needs at least two logged
  nights; returns `null` rather than guessing with less.
- **Quality** — the person's own 1-5 rating of how it felt. Optional —
  omitting it doesn't block a score, the other components just carry more
  weight.

`sleep-debt.ts` sums only the *shortfall* against the goal across recent
nights — a great night deliberately doesn't cancel out debt from a rough
one, since sleep debt doesn't work that way physiologically and pretending
otherwise would be exactly the kind of fabricated precision this app
avoids everywhere else. `sleep-insights.ts`'s "what's helping" cards are
**real correlations pulled from a person's own logged nights** (e.g.
"consistent bedtime" vs. not, compared by average score) — a card only
renders once there are enough nights on both sides of the comparison to
say anything meaningful; there is no generic or placeholder stat standing
in for missing data.

Sleep's Wind Down screen — a pulsating breathing pacer (CSS animation,
three concentric rings) plus three quick ambient-sound picks — drives the
exact same shared audio engine Focus's own screen does (see below),
not a disconnected copy.

## Focus

A second, standalone mini-app — not a Sleep sub-feature — for anyone who
wants steady background sound or a short guided session while falling
asleep, sitting with a busy mind, or just working: rain, a thunderstorm,
ocean waves, a river, wind, a fireplace, or plain steady noise, plus four
guided sessions. The catalog and its framing (`js/features/focus/soundscapes.ts`,
`guided-sessions.ts`) deliberately avoid diagnostic or clinical language —
it offers techniques and sounds, it never suggests a reason someone might
need them.

**Real audio, not a looped sample file** — there's nothing to fetch in an
offline-first PWA with no server, so every soundscape is procedurally
generated Web Audio, run at a requested 48kHz:
- `noise-synthesis.ts` generates real white/pink/brown noise PCM (Paul
  Kellet's refined pink-noise filter; a leaky-integrator random walk for
  brown), then blends the buffer's tail into its head
  (`crossfadeLoopBuffer`) so a long loop never exposes an audible seam.
- Each soundscape layers one or more of those buffers through a real
  `BiquadFilterNode` chain (highpass/lowpass/bandpass) that shapes plain
  noise into something that actually sounds like rain, waves, or wind —
  data-driven per soundscape, not a single fixed filter for everything.
- **Genuinely 3D, not stereo panning** — a `PannerNode` in `HRTF` mode,
  animated by `spatial-motion.ts`'s pure orbit math (`positionAtTime`),
  moves each soundscape's sound around the listener over tens of seconds
  (wind drifts, waves roll) rather than sitting static in one spot.
- `impulse-response.ts` procedurally generates a reverb tail
  (exponentially-decaying filtered noise — the standard way to build a
  plausible room IR when no real IR file can be fetched) fed into a
  `ConvolverNode` for spatial depth.
- **Real thunderclaps, not a sample or a fixed loop** — `thunder.ts`
  synthesizes a fresh crack-and-rumble burst (a fast noise-burst attack,
  then a longer decaying low-frequency tail — the same two-part shape a
  real clap has) every time one plays. The Thunderstorm soundscape
  schedules them at a random 9-32 second interval via `audio-engine.ts`'s
  `scheduleNextThunderclap` — each clap gets its own one-shot `PannerNode`
  positioned in a random direction, independent of the continuous rain
  layer's own motion, since real thunder doesn't travel with the rain.

`js/features/focus/audio-engine.ts` is the thin, stateful
orchestration layer that wires all of the above into a real Web Audio
graph — feature-detected and defensive throughout (a missing/blocked
`AudioContext` degrades to "nothing plays," never a thrown error), the
same contract as `audio-cue.js`'s `primeAudio()`. It owns a **single
shared engine instance** (`getFocusAudioEngine()`) so Focus's own
screen and Sleep's Wind Down screen always reflect the exact same live
playback state — start a sound from Wind Down, open the full Focus
screen, and it shows that same sound already playing, not a second
disconnected player. Every pure math module above is Vitest-tested
directly (deterministic via a seeded PRNG, `prng.ts`); `audio-engine.ts`
itself — real `AudioContext`/`PannerNode`/`ConvolverNode` construction —
is exercised through Playwright in a real Chromium instead, since Node has
no Web Audio implementation for Vitest to run against.

Same platform honesty as everywhere else in this README: background audio
is unreliable once the screen locks (stated plainly in the Wind Down
screen's own copy, not glossed over) — that's the OS's rule, not a bug
here.

### Guided sessions

Four short (under-a-minute to ~3-minute) sessions, each built on one real,
named, well-established technique — never invented copy standing in for
one — documented with its source in `guided-sessions.ts`'s `basis` field
on every entry:

- **Breathing Focus** — box breathing (4-4-4-4: in, hold, out, hold), the
  technique taught for fast physiological calming before a high-stakes
  task. Six full cycles.
- **Relax** — a short progressive muscle relaxation pass (Jacobson's
  technique), abbreviated to three muscle groups: tense on purpose, then
  release.
- **Focus** — 5-4-3-2-1 sensory grounding, framed plainly as a way to
  arrive before starting something, with zero clinical language attached.
- **Sleep Focus** — a guided body scan, feet to head, the standard
  technique behind most sleep-focused meditations.

Every session is an ordered list of "beats" (`guided-sessions.ts`'s
`SessionBeat`) — a line of text plus an *exact* duration, deliberately not
derived from however long text-to-speech takes to say it: a breathing
exercise has to be metronomic regardless of voice/engine speed, so pacing
runs on the same wall-clock-timer discipline as every other timer in this
app (`js/lib/timer.js`'s `createCountdown`), and voice narration just
plays alongside it, never in front of it.

**The caption is never a voice-only fallback — it's the primary channel,
with voice as a real, switchable-off enhancement.** `voice-guide.ts` wraps
the browser's own free, on-device `SpeechSynthesis` API — no account, no
API key, no per-call cost, works fully offline. It's genuinely available
in effectively every modern browser, so there's no "read text instead"
degraded mode to fall back to: the on-screen caption *is* that mode,
shown and updated in real time regardless of whether voice is on, with its
own voice toggle (`btn-guided-session-voice-toggle`) for anyone who wants
captions only — including someone running their own screen reader
alongside the app, where a second synthesized voice narrating on top of
it would just talk over their own assistive technology.

## The Fitness Toolkit

Everything from the original 14-phase build — activity logging, tailored
programs, run mode, heart rate, women's health, nutrition, recovery,
goals, voice control — lives on unchanged, just one tap deeper behind the
Hub's Fitness Toolkit tile instead of being the app's front door. Every
id, every controller, every test below is exactly as it was; only the
navigation path to reach it moved.

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

## Recovery / readiness

`js/features/recovery/readiness.js` blends four self-reported/derived
signals into one score — sleep hours (against an 8-hour target),
energy and soreness (both 1-5 daily check-in questions), and recent
training load (sessions in roughly the last 2 days, from the same
`sessions` store the activity/program features write to) — into a
weighted 0-100 score with a `low`/`moderate`/`high` category. Every
result carries the reasoning behind it (which factor actually pulled the
score down), never a bare number: this is a transparent, rule-based
blend, not a wearable-derived HRV score (there's no wearable integration
here) or a medical assessment. A check-in with only one or two of the
four inputs still produces a score — only the truly-missing signal is
skipped, not the whole calculation — but at least one real self-report is
required; recent training load alone isn't a check-in.

`readinessCheckins` is keyed by date like `cycleLogs`, so revisiting the
same day prefills what was already logged and a second save just
overwrites rather than duplicating.

## Goals + notifications

`js/features/goals/goal-progress.js` is one generic progress calculation
that works for any numeric goal — a target bodyweight, a run distance, a
weekly activity-days count, any custom number someone names themselves —
as long as it knows a start value, a current value, and a target
(`calculateProgressPercent`, clamped to 0-100 either direction so
overshoot or a regression never breaks the display). `direction`
('increase' or 'decrease') is the only thing that changes between "hit
10 workouts" and "get down to a target weight."

Notifications (`js/lib/notifications.js`) are local/in-session only —
there's no server here to drive push notifications while the app is
fully closed, which would need a backend and VAPID keys, exactly the
kind of dependency this on-device, no-account app deliberately doesn't
have. What it does honestly: ask permission once, then show a real
system notification (`new Notification(...)`) the moment something
notification-worthy happens while the app is open — right now, that's
reaching a goal's target. Feature-detected and silently no-op wherever
Notifications aren't available or permitted, never throwing into the
caller.

## Voice commands

`js/features/voice/voice-grammar.js` is a **closed grammar** — a small,
fixed, fully-listed set of recognized phrases — deliberately not open-
ended NLU/AI parsing of arbitrary speech. That's a safety/predictability
choice as much as a scope one: everything voice control can ever do is
auditable right there in the phrase list, and a misheard word can never
accidentally trigger something that wasn't on it. Matching tries an exact
phrase first, then falls back to a lenient in-order-words check (tolerant
of a stray "hey"/"please" without accepting unrelated text), preferring
the most specific phrase when more than one could match.

`js/features/voice/voice-control.js` wires the (feature-detected)
`SpeechRecognition`/`webkitSpeechRecognition` API to it — the mic button
stays hidden entirely on a browser without it, rather than a dead
control. Recognized commands are dispatched by simulating a click on
that feature's own home-dashboard button, reusing its exact async
render logic (fetching profile/program/history first) rather than a
second copy of it — which also means voice control reaches any feature
from any screen, the button just floats above every screen rather than
living only on home.

Real speech recognition needs a live mic and, in Chromium, a network
round-trip — neither works headless in CI. `tests/e2e/voice.spec.js`
installs a fake `SpeechRecognition` class via `page.addInitScript`
(the same spirit as the heart-rate suite's fake camera device) that
tests drive through `window.__voiceTestHooks.fireResult(transcript)`,
exercising the real recognition-event-handling and command-dispatch code
end to end without ever touching an actual microphone.
