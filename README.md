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

**One narrow, explicit exception**: Nutrition's food search sends the
text you type to [Open Food Facts](https://openfoodfacts.org), a free,
open food database, to look up nutrition facts — that's the only network
request this app makes anywhere, on to a third party, ever. It only
happens when you tap Search (never live-as-you-type), only carries the
search text, and never touches what you've actually logged, which stays
local exactly like everything else. Recent and Favorites don't need it
at all — both are built entirely from data already on this device.

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

The trade-off accepted deliberately across most of the app: background
audio (Focus, Sleep's Wind Down) is unreliable once the screen locks —
that's the OS's rule, stated plainly in the UI rather than glossed
over — there's no HealthKit/Google Fit bridge, and iOS has no Bluetooth
heart-rate-strap support in the browser. Camera-based PPG heart-rate
estimation and manual entry cover that last gap, always labeled as an
estimate per the rule above. Sleep, similarly, never claims to sense
anything passively overnight — see "Sleep" below for why. Steps and Run
mode's own GPS tracking used to carry the identical "screen must stay
on" limit — see "Native builds (Capacitor)" below for the real fix.

## Native builds (Capacitor)

Steps and Run are the two features that actually benefit from running
outside the browser's own limits — a background pedometer and
background GPS both need the OS to keep a sensor listener alive with
the screen locked, which no web page can do. `js/lib/native-runtime.js`'s
`isNativeRuntime()` is the seam: `false` in every browser context today
(provably, since `window.Capacitor` is never present there), `true` once
this project is genuinely wrapped with [Capacitor](https://capacitorjs.com)
— and as of this round, that wrapping is real, not just documented.

**What's real here today.** A full Capacitor Android project lives in
`android/` (`npx cap add android`), with two real background-capable
plugins wired behind `isNativeRuntime()` — the web path is completely
unchanged either way:

- **Run's GPS** uses `@capacitor-community/background-geolocation`
  (`js/features/run/native-background-geo.js`) — a real Android
  foreground service (a persistent notification while tracking, the
  same one every commercial fitness-tracking app shows) that keeps
  delivering fixes with the screen locked, feeding the exact same
  `gps-math.js`/`splits.js`/personal-record pipeline the web build
  already uses.
- **Steps' pedometer** is this project's *own* native plugin
  (`android/app/src/main/java/app/fitfly/mobile/stepcounter/`,
  wired through `js/features/steps/native-pedometer.js`) rather than a
  third-party one — the off-the-shelf Capacitor pedometer plugins
  evaluated for this all unregister their sensor listener the moment
  the host Activity pauses, which quietly defeats "works with the
  screen locked" the same way the plain web build already does. This
  project's own `StepCounterService` instead runs a real foreground
  service around Android's `TYPE_STEP_COUNTER` hardware sensor — the
  same low-power counter the phone's own health app reads from — and
  persists every real reading, so "today's step count" is accurate the
  moment the app is reopened even if it was never in the foreground
  while those steps happened.

Both are gated behind the real permission each one needs
(`ACTIVITY_RECOGNITION` for Steps, fine/coarse location for Run) and
degrade to an honest status message — never an uncaught error — if the
native plugin genuinely can't be reached.

**What isn't done here, and can't be.** This sandboxed dev session has
no way to compile or run this native code — `dl.google.com`, the
Android SDK's real download host, is blocked by this environment's own
network policy (the same wall the Steps round hit trying to build an
APK directly). Every file in `android/` and every native plugin call
was written and reviewed carefully, but **none of it has been compiled
here** — the first real build is the real test.

**Building it yourself:**

```bash
npm install                # installs @capacitor/core, @capacitor/android, the plugins
npm run cap:sync           # builds the web app into www/, copies it into the native project
npx cap open android       # opens android/ in Android Studio (needs it installed locally)
```

From there, Android Studio builds and installs the app to a real device
over USB (Settings → Developer Options → USB debugging) the normal way
— **a real device, not the emulator**: a background foreground-service
notification and a locked-screen test are both far more representative
on real hardware. Grant the Activity Recognition and Location
permissions when the app asks. To actually verify background sensing
works: open Steps, turn on background counting; open Run, start a run;
then lock the phone, walk around for a minute or two, and reopen the
app — both screens' real counts should already reflect the time spent
locked, not restart from zero.

`npm run cap:sync` re-runs whenever native code changes (a new
build/test cycle); `scripts/prepare-native-www.mjs` is what copies this
bundler-free app's real files into the `www/` folder Capacitor expects
— gitignored, regenerated fresh every time, never a second source of
truth to hand-edit.

## Accessibility

- **No emoji anywhere** — see "The Hub" below. Every icon is a real,
  `aria-hidden` SVG next to a real text label, never the only description
  of what a control does.
- **`:focus-visible` keyboard-focus rings use each mini-app's own bright
  accent color** on Sleep/Focus/Meditate/Vitals/Steps/Hydration/Run's
  night surfaces (`.theme-sleep :focus-visible` / `.theme-focus
  :focus-visible` / `.theme-meditate :focus-visible` / `.theme-vitals
  :focus-visible` / `.theme-steps :focus-visible` / `.theme-hydration
  :focus-visible` / `.theme-run :focus-visible` in `mini-apps.css`), not
  just the app-wide neutral accent — noticeably higher contrast against a
  dark gradient than a mid-tone blue would be.
- **A real dark-mode contrast bug, found and fixed this round**: every
  category accent's `-strong` token (the text color `.btn-secondary` and
  similar pairs read against a `-soft` background) had no dark-mode value
  at all, so it stayed a color tuned for a *pale* background even once
  dark mode flipped that background dark — dark text on a dark
  background, app-wide, for anyone with a category assigned. All seven
  `-strong` tokens now have real dark-mode values in `tokens.css`. See
  "Vitals" below for the full story, including a second specificity bug
  the same pass caught in `.safety-flag`'s warning-red text.
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
capacitor.config.ts     # Capacitor project config — see "Native builds (Capacitor)"
android/                 # the real native Android project (npx cap add android) — Steps'/Run's own background-sensing plugins live under app/src/main/java/app/fitfly/mobile/
css/
  tokens.css            # design tokens: light/dark themes, per-category accents
  base.css               # reset, app chrome, screen-router styles
  components.css           # shared buttons/cards/forms/chips/nav
  mini-apps.css              # Hub + Sleep + Focus + Meditate + Vitals + Steps + Hydration's own night-surface visual identity
js/
  main.js                   # bootstrap
  lib/                       # cross-feature pure logic + small DOM helpers — icons.ts (icon system), tilt.ts (spatial-tilt engine, used by the Hub/Sleep/Focus/Meditate/Vitals/Steps/Hydration), motion.ts (shared prefers-reduced-motion check), count-up.ts (number count-up), guided-session.ts (shared session/beat types + pacing math, used by Focus and Meditate), bluetooth.js (shared Web Bluetooth feature-detect, used by Heart Rate and Vitals), ieee11073.js (shared SFLOAT decoder, used by Vitals), step-detector.js (pure step-detection algorithm, used by Steps), notifications.js (local/in-session Notification wrapper, used by Goals and Hydration)
  db/                         # Dexie (IndexedDB) schema and store access
  features/
    hub/                        # the launcher — equal-weight mini-app tile grid (TypeScript)
    sleep/                       # Sleep mini-app: NSF-banded score/consistency/debt, dashboard, History calendar, Wind Down, Insights (TypeScript)
    focus/                  # Focus mini-app: real Web Audio spatial engine, thunderstorms, guided sessions + voice guidance + the shared guided-session player (TypeScript)
    meditate/                # Meditate mini-app: 12-session library of cited meditations + breathwork, real streak tracking (TypeScript)
    vitals/                   # Vitals mini-app: blood pressure + SpO2, manual entry or BLE, AHA/pulse-ox categorization, real trend/streak (TypeScript)
    steps/                     # Steps mini-app: real motion-sensed live walk or manual entry, threshold-crossing step detector, real goal/streak, native-pedometer.js (real background step counting on a native build) (TypeScript)
    hydration/                  # Hydration mini-app: real running daily total, water-fill figure, cited goal, interval-based reminder (TypeScript)
    run/                         # Run mini-app: GPS route/splits/PRs, live GPS-quality feedback, pace-inferred calorie estimate, its own night-surface theme, native-background-geo.js (real background GPS on a native build) — promoted from a Fitness Toolkit list row to a standalone Hub tile
    onboarding/                    # profile/BMI intake + category engine (optional — see "The Hub")
    activity/                       # activity logging, measured-vs-estimated UI
    programs/                        # tailored exercise programs, periodization
    exercises/                        # exercise library + hand-authored demo SVGs
    heart-rate/                          # camera PPG, manual entry, BLE (feature-detected)
    womens-health/                        # cycle tracker (encrypted store)
    nutrition/                             # macro/nutrition tracking
    recovery/                               # recovery + readiness scoring
    goals/                                   # goals + local notifications
    voice/                                    # closed-grammar voice commands
  vendor/
    dexie.min.mjs, capacitor-core.mjs, fonts/     # vendored libraries + fonts (npm registry, not a live CDN)
assets/
  icons/                     # app icons
  exercise-svgs/              # hand-authored exercise demonstration SVGs
tests/
  unit/                       # Vitest — pure-logic math (BMI/BMR/TDEE, GPS,
                                # cycle prediction, program generation, 1RM,
                                # PPG signal processing, voice-grammar matching,
                                # sleep scoring/consistency/debt/trends/insights/duration-guideline/calendar-math,
                                # focus noise synthesis/spatial motion/impulse
                                # response/thunderclaps/guided-session content,
                                # meditate session catalog/streak trends,
                                # IEEE 11073 SFLOAT decoding/BLE payload
                                # parsing/AHA+pulse-ox categorization/vitals
                                # trends+streak, step-detection algorithm/
                                # steps trends, hydration trends/interval-
                                # based reminder logic)
  e2e/                          # Playwright — real UI flows, zero console errors
scripts/
  serve.mjs                   # zero-dependency static server (dev + e2e)
  prepare-native-www.mjs        # copies the real app into www/ for Capacitor — see "Native builds (Capacitor)"
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
- To test on Android as an installed app: open the Vercel URL in Chrome,
  then the **⋮ menu → Install app** (or the install prompt Chrome shows
  on its own) — same standalone-PWA install as iOS, using the real
  192×192/512×512 icons `manifest.json` now declares.
- **To get a real, installable `.apk`** (not just a browser install) —
  useful for sideloading onto a device, or testing outside Chrome
  entirely: [PWABuilder](https://www.pwabuilder.com) packages any live
  PWA URL into a real Android app (a Trusted Web Activity) in a couple of
  minutes, entirely in your own browser — no Android Studio, no
  emulator, no Capacitor setup required on your end. Point it at the
  deployed Vercel URL once `manifest.json`'s icons (already in place)
  are live, and it hands back a signed `.apk`/`.aab` ready to install on
  a real device via `adb install` or just opening the file. (This
  environment's own outbound network policy blocks `dl.google.com`, the
  actual Android SDK's download host, so building an APK from inside a
  sandboxed dev session directly isn't possible here — PWABuilder runs
  entirely on its own infrastructure and sidesteps that completely.)

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
Hub/mini-apps model described above, with **Sleep**, **Focus**,
**Meditate**, **Vitals**, **Steps**, **Hydration**, and now **Run**
built out as real mini-apps — Focus and Meditate together sharing one
guided-session engine with free, on-device voice guidance, Vitals and
Steps together sharing a Bluetooth feature-detect with Heart Rate,
Steps' own real motion-sensed step detector, Hydration sharing Goals'
local-notification approach for its own interval-based reminder, and Run
picking up its own night-surface identity, live GPS-quality feedback, a
real Capacitor-readiness seam actually wired in (not just documented),
audible/haptic split cues, and an estimated calorie badge before being
promoted from a Fitness Toolkit list row to a standalone 8th Hub tile in
the same round (see "Run mode" below for both) — and the Hub itself
rebuilt as a real spatial-tilt, kinetic-data scene (`js/lib/tilt.ts`, see
"The Hub" above). **Every Hub tile is real now** — Steps was the last
"coming soon" placeholder. The Fitness Toolkit's last four tilt-less
screens (Activity, Rest Timer, the Cycle Tracker, Readiness) caught up
to that same spatial language, and — the first genuinely native work in
this project — the Capacitor-readiness seam most of this stopped being
theoretical: a real Android project now lives in `android/`, with Steps'
and Run's own background sensing routed through real native plugins
behind `isNativeRuntime()`, the web build entirely unchanged either way
(see "Native builds (Capacitor)" above).
616 Vitest unit tests and 402 Playwright end-to-end tests
(desktop + mobile-viewport, zero console errors) are green.

Known, deliberate gaps rather than oversights: no accounts or sync yet —
still entirely on-device, no server, by design (a real backend for
coach/doctor access and cross-device history is planned, deliberately not
built opportunistically alongside this round of work); no export/import
for on-device data either yet; no offline service worker/asset caching
yet. Steps and Run's own passive background sensing is real now on a
native build (see "Native builds (Capacitor)" above) — the plain web
build still can't do it (a browser tab stops the moment the screen locks
or it isn't the active tab, the same limit every other feature-detected
API here already has), and Sleep still has no passive sensing at all,
native or otherwise, on purpose — overnight audio monitoring is a
different, unbuilt feature, not the same gap as Steps'/Run's, and would
need a phone genuinely staying awake on a nightstand even with a native
wrapper.

## Data layer

`js/db/schema.js` is the source of truth for what's persisted — Dexie
(IndexedDB) stores for the profile, category-assignment history, injury
screens, the exercise library, programs, sessions, and sets, each with a
thin repository module under `js/db/repositories/` (plain CRUD + the
handful of queries each feature needs — no ORM magic). Dexie itself is
vendored locally at `js/vendor/dexie.min.mjs` (fetched via `npm pack`, not
a live CDN — see `js/vendor/THIRD_PARTY_NOTICES.md`).

Later phases (run mode, heart rate, women's health, nutrition, recovery,
goals, Meditate) each add their own store via a new `db.version(N).stores({...})`
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
pattern every future mini-app has to slot into without the grid needing a
rework or something ending up buried under "more tools." Sleep, Focus,
Meditate, Vitals, Steps, Hydration, and Run each get their own gradient
identity per tile; Fitness Toolkit uses the app's existing neutral
surface, since it isn't a mini-app with its own visual identity. **Every
tile on the grid is real now** — Steps (see below) was the last "coming
soon" placeholder. Run is the grid's 8th tile and its only one promoted
out of the Fitness Toolkit after the fact rather than built here from the
start — see "Run mode" below for why.

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
straight in the Hub — Sleep, Focus, Meditate, Vitals, Steps, Hydration,
and Run need zero profile data, so nothing about them requires
registering first (Run's own calorie estimate is the one exception that
wants a profile weight, and simply skips showing that one row without it
— see "Run mode" below). Skipping
is remembered
(`localStorage`, the same lightweight preference store the theme setting
already uses) so it only has to happen once. The Fitness Toolkit still
benefits from a real profile (personalized programs, calorie targets,
readiness scoring), so it shows a plain "set up your profile" prompt
instead of silently rendering blank targets when one is missing — onboard
later, from inside the Fitness Toolkit, whenever it's actually wanted.

**The grid is a shared 3D scene, not a stack of flat cards.**
`js/lib/tilt.ts` reads real input — pointer movement on desktop, actual
device tilt on a phone, once granted — and turns it into a few degrees of
rotation applied to every tile at once, with each tile's icon and its
kinetic-data layer sitting at their own depth so they visually separate as
the grid tilts, the way things at different distances from a light source
actually do. One rAF loop lerps toward the latest reading every frame —
that lerp *is* the spring, deliberately with no competing CSS transition
fighting it — and the loop only runs while the Hub is actually the visible
screen (a `MutationObserver` on `hidden`), so it costs nothing, and risks
nothing, the moment you navigate away. Under `prefers-reduced-motion` the
whole thing is a no-op: full depth via static shadows and layering, zero
motion.

**The tile data is real, not decorative.** The Sleep tile's mini ring runs
the exact same score math as its dashboard ring and draws in via a real
`stroke-dashoffset` transition the moment a night is logged — before that,
it's an honest empty "waiting for data" state, never a fabricated number.
Focus's mini waveform only animates when a soundscape is actually playing
(subscribed to the same shared audio engine's state, live, from wherever
playback was started — its own screen or Wind Down), and sits low and
still otherwise.

**Typography, app-wide.** `--font-display`/`--miniapp-font-display` are
**Space Grotesk** everywhere — the Hub, Sleep, Focus, and the Fitness
Toolkit alike — paired with Manrope for body text (`js/vendor/fonts/`,
fetched via `npm pack`, never a live CDN, same as every other vendored
asset). A confident geometric grotesk rather than an editorial serif: the
typographic register real product-engineering teams ship, not a boutique
magazine — and, unlike the app's previous `Fraunces` declaration, which
was never actually vendored and silently fell back to the browser's
default serif everywhere it was used, this one is real, on every surface.

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
number" contract as `readiness.js` — standardized against real, named
sleep-science instruments throughout, not an invented formula wearing a
scientific-looking number:
- **Duration** — scored against the National Sleep Foundation's own
  age-banded recommendations (Hirshkowitz et al., *Sleep Health*, 2015;
  see `sleep-duration-guideline.ts`), not a flat "8 hours" goal. Full
  marks within the recommended range for the person's age (or the
  general-adult band — 7-9h — with no profile), tapering down on *both*
  sides past it: sleep research is clear that habitually long sleep has
  its own associated downsides, not just short sleep, so "more hours is
  always better" is deliberately not how this works.
- **Consistency** — `sleep-consistency.ts` computes the standard deviation
  of recent bedtimes (shifted so "noon" is the zero-point, so a bedtime
  that crosses midnight doesn't register a fake ~24-hour jump) — tight
  bedtimes score high, erratic ones score low. Needs at least two logged
  nights; returns `null` rather than guessing with less.
- **Quality** — the person's own 1-5 rating of how it felt, worded with
  the Consensus Sleep Diary's own published anchors (Carney et al.,
  2012: Very poor / Poor / Fair / Good / Very good — see
  `#sleep-log-quality`'s chips), not bare unlabeled numbers. Optional —
  omitting it doesn't block a score, the other components just carry more
  weight.

Sleep debt (`sleep-debt.ts`) is measured against 7 hours — the NSF
recommended-range *minimum* every adult age band agrees on — not the old
flat 8-hour figure.

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

**History — a real month calendar, not just "today."** Every logged
night is one row in `sleepLogs`, keyed by its own date (`date` is the
primary key — logging a new night has never overwritten an older one;
what was actually missing was a way to *see* them again after the day
passed). `#screen-sleep-history` (`sleep-calendar.ts` for the pure
month-grid math, tested in isolation) opens from **two real, visible
entry points, not one clever-but-easy-to-miss gesture**: a calendar icon
button in the header (the same pattern as the already-proven Insights
button right next to it) and an explicitly-labeled ghost button in the
flow itself — *"Missed a night? Log any past day"* on the blank form,
*"View full history"* on a logged result — so it's reachable regardless
of whether tonight is already logged, and unmistakable as a tappable
control rather than a plain date label that happened to also be a
button. Every day in the calendar is color-coded by that night's
category, and every non-future day — logged or not — is tappable.
Logged opens that night's real result; unlogged opens a genuinely
blank form for that specific date, so a missed night can be logged
retroactively instead of being unreachable forever. Scoring a night
from History uses only the logs on or before its own date
(`scoreLogInContext` — the same "no hindsight" windowing
`renderInsightChart` already used per point), so reviewing an old night
scores it the way it actually looked at the time.

**The dashboard carries the same spatial-tilt/kinetic-data language as
the Hub** (`js/lib/tilt.ts`, `js/lib/count-up.ts`) — deliberately scoped
to the dashboard only, not Insights (chart-dense) or Wind Down (its own
breathing-pacer motion language already fills that role): restraint, not
the effect applied everywhere it could technically go. The score ring
draws in for real via a `stroke-dashoffset` transition instead of
snapping to its final state, its number counts up rather than appearing
outright, the streak/debt stats on Insights do the same, and the week
strip's bars grow in from zero — real data (each bar's height already
*is* that night's real duration) drawn as motion, not decoration. Stat
tiles tilt with the rest of the screen; the ring itself deliberately
doesn't (a precise data circle spinning in 3D reads as a gimmick, not
depth) — only its value floats a little via `data-tilt-depth`.

The week strip itself is a compact single row, not two stacked ones — a
label+stat on the left beside a tight sparkline on the right, the way
real analytics apps (Whoop, Oura) show a weekly trend chip: a shape at a
glance, not a labeled bar chart to read exact values off of (that finer
detail already lives on Insights' full trend chart). Per-day letters
came off the bars for it — the sparkline carries one summary
`aria-label` instead, and each bar keeps a real hover `title` for
anyone using a mouse.

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

**"It says Playing but I hear nothing" has two real causes, and only one
of them is a bug this app can detect.** A genuine failure — the browser
withheld playback despite `start()` running inside a real click handler —
is now caught explicitly: `FocusAudioState.blocked` goes true only when
the `AudioContext` never actually reaches `'running'`, and the screen
shows an honest "Playback didn't start — tap a sound again" banner
instead of a `Playing` state for a context producing no sound at all. The
far more common cause — the device is muted or its media volume is at
zero — has **no web API to detect at all**, deliberately; a website
cannot know or override that, and shouldn't try to. The only honest fix
is the permanent hint under the volume slider: *"Plays through your
media volume — check your device isn't muted or on silent if you don't
hear anything."*

**The catalog carries the same spatial-tilt language as the Hub and
Sleep's dashboard**, `attachTilt()`'d the same way. The sound/session
tiles are structured the same two-layer way the Hub's tiles are —
`.focus-sound-tile` is the `.tilt-card` (surface + rotation),
`.focus-sound-tile-face` its `.tilt-press` (layout + the press-spring) —
because a JS-lerped rotate and a CSS-sprung press can't safely share one
`transform` declaration (see `js/lib/tilt.ts`'s doc comment). These three
primitives (`.tilt-card`, `.tilt-press`, `data-tilt-depth`) are shared,
generic CSS now, not Hub-specific — the Hub's own tiles were refactored
onto them at the same time this was built, so there's exactly one
implementation of the mechanism, used in three places.

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

**Voice quality, without a different engine.** Two real, free
improvements on top of the same on-device API: `pickVoice` favors any
voice whose name signals a genuinely better on-device/vendor-bundled
engine ("Natural", "Neural", "Enhanced", "Premium", "Wavenet" — the
labels Windows/Edge, macOS/iOS, and some Android builds already use for
their best free voices) ahead of the previous local-service-only guess.
And rather than handing a whole sentence to one flat `SpeechSynthesisUtterance`
— what actually makes browser TTS read as a monotone "computer voice",
since most engines don't reliably treat internal punctuation as a pause
or pitch cue — `speak()` splits a line at its natural clause boundaries
and speaks it as a chain of shorter utterances, each with a touch of
natural rate variance and a real pitch drop on the line's final clause
(the same "terminal declination" real speech uses to signal a thought
ending, versus a slight lift on one that continues), with a short
breath-length pause between them.

**The breathing pacer reacts on four channels, not one.** Each ring
(`guided-session-pacer-core/-mid/-outer`) moves a smaller fraction of the
breath's swing than the one inside it, and settles a beat later — a
ripple moving outward through real depth, not three shapes scaling in
lockstep — with a warm brightness lift on the inhale and a cooler settle
on the exhale (light, not just size). The transition's real duration is
set from that beat's actual `durationSeconds` (`--pacer-transition-ms`),
never a guessed constant, so the visual stays exactly as metronomic as
the voice/caption pacing above it. The fourth channel is non-visual: a
short haptic pulse via the free, standard Vibration API at the start of
an actual in/out transition (never on a hold — stillness deserves
silence there too) — best-effort, and a silent no-op on the many devices
that don't support it (all of iOS Safari included), same contract as
`audio-cue.js`'s existing `vibrateDevice`.

## Meditate

A third sibling mini-app, not a Focus sub-feature — an expert-led library
of guided meditations and breathwork, built for real emotional moments
(sadness, anger, grief, adapting to change) as well as calmer everyday
practice, rather than one generic "relax" track. Deliberately not
"hundreds" of interchangeable sessions padded out for a big number: 12
sessions, each built on one specific, named, cited technique — the same
discipline Focus's own guided sessions hold, just applied at real scope.

**Shares the exact same engine Focus's guided sessions run on, not a
second copy of it.** The session/beat types and the word-count-based
pacing math that used to live only in `guided-sessions.ts` were pulled out
into `js/lib/guided-session.ts` so both libraries build on identical
primitives; the player itself
(`js/features/focus/guided-session-view.ts`) was generalized rather than
forked — `initGuidedSessionFeature()` now returns a `playGuidedSession(session,
returnScreenId, { onComplete, themeClass })` handle, so Meditate hands it
a session from its own catalog, where "End"/"Back" should land, its own
`theme-meditate` class (so the shared player screen reads as Meditate's
own warm palette, not Focus's teal, depending on who launched it), and a
completion callback — fired only when every beat plays through, never on
an early exit, so an abandoned session is never logged as a real one.

### The library

- **A Quiet Mind** — basic mindfulness of breath (anapanasati), the
  foundational technique nearly every other practice here builds on.
- **Sitting with Sadness** — RAIN (Recognize, Allow, Investigate,
  Nurture), Tara Brach's widely-taught approach to a difficult emotion.
- **Working with Anger** — body-awareness plus extended-exhale breathing,
  a standard combination for down-regulating arousal before responding.
- **A Meditation for Grief** — grounding through breath, sound, or touch,
  the common technique across mindfulness-based bereavement support.
- **Adapting to Change** — separating what's actually controllable from
  what isn't, a core CBT/ACT technique.
- **Easing Anxiety** — breath-focused attention plus a brief body scan, to
  interrupt a racing-thoughts spiral.
- **A Self-Compassion Break** — Kristin Neff's three-part structure
  (mindfulness, common humanity, self-kindness), one of the most
  widely-studied self-compassion practices.
- **A Gratitude Practice** — specific, not generic, reflection; research
  on gratitude consistently finds specificity matters more than quantity.
- **Building Resilience** — strengths-recall, recalling real evidence of
  having gotten through something hard, distinct from generic positive
  thinking.
- **A Quick Reset** — one real, fully-noticed breath, genuinely under 30
  seconds — for a moment with no time to spare, not a shortened version of
  something longer.
- **4-7-8 Breathing** — inhale 4, hold 7, exhale 8. Controlled studies
  show measured heart-rate-variability and blood-pressure improvements
  from the extended-exhale vagal activation this produces.
- **Physiological Sigh** — cyclic sighing (a double inhale, then one long
  exhale). A 2023 Stanford study (Balban et al.) found this pattern beat
  mindfulness meditation itself for mood improvement over a month of daily
  practice, and reduced breathing rate more than the other techniques
  tested — a genuinely differentiated, evidence-backed addition, not just
  another breathing pattern for its own sake.

Every session's `basis` field in `meditations.ts` cites its real technique
— documentation for maintainers, never shown in the product UI — and
`tests/unit/meditate/meditations.test.js` enforces it stays real: a
banned-clinical-vocabulary check (disorder, therapy, patient, diagnosis,
treatment, overthink, depress — deliberately *not* plain emotion words
like "sadness" or "anxiety," which these sessions name openly, matched
against every beat's actual text and each `description`), a citation-length
sanity check, and structural checks on the two breathwork techniques'
exact cycle timing (4-7-8's real 4/7/8-second beats; cyclic sighing's
two-inhale-then-one-longer-exhale shape).

### A real streak, not just a session log

`js/db/repositories/meditation.js` logs one row per **completed** session
(`meditationSessions`, `db.version(10)`) — never a started-but-abandoned
one, since only the player's natural-completion path calls
`recordMeditationSession`. `meditate-trends.ts`'s `calculateMeditationStreak`
is the same consecutive-day-ending-today math as Sleep's own logging
streak (`sleep-trends.ts`), because logging a session and logging a night
are the same kind of "did this happen today" streak. The Meditate screen
shows this streak plus real minutes practiced in the last 7 days — both
recomputed fresh every time the screen is reached, the same "reload on
entry" discipline as Sleep's dashboard — and the Hub's own Meditate tile
subtitle updates to match (`setMeditateTileSubtitle`, the same
Hub-doesn't-need-to-know-how-a-mini-app-computes-its-data handoff as
Sleep's and Focus's own tiles).

### Honest about what this is and isn't

The Meditate screen carries its own crisis-resources note alongside the
app's existing "Not medical advice" framing, extended for mental-health
content specifically — a real, named resource (the 988 Suicide & Crisis
Lifeline, for anyone in the US), not a vague "seek help if needed." These
are real techniques with real evidence behind them, not a substitute for
a therapist, and the app never pretends otherwise.

**Deliberately out of scope for this round**, sequenced rather than
crammed in: a written "Self-Care Tools & Resources" guide/article section,
and deeper cross-linking into Focus's own productivity framing (a shared
"quick reset before you start working" entry point, for example). Both are
real, buildable next steps — not attempted opportunistically alongside
this round, the same discipline every other mini-app here has held.

## Vitals

A fourth sibling mini-app — blood pressure and blood oxygen (SpO2),
manual entry or a real Bluetooth cuff/pulse oximeter. Converts the Hub's
former "Vitals & Steps — coming soon" placeholder into a real tile;
**Steps stays its own honest "coming soon" placeholder**, split out into
its own tile rather than silently dropped, since it's a genuinely
separate technical project (a real background pedometer needs either a
native Capacitor plugin or a from-scratch accelerometer-based step
algorithm — see the native-runtime seam in "Heart rate" above — not
something to bolt on opportunistically alongside blood pressure/SpO2).

**No camera-estimated path for either metric, and the app says so
plainly** — unlike heart rate, which has a real camera-PPG technique
behind it, there is no honest way to estimate blood pressure or SpO2 from
a phone: a phone has no sensor that measures pressure at all, and real
pulse oximetry needs calibrated red + infrared light absorption ratios, not
just brightness — a phone camera only sees RGB. So every reading here is
**measured**, never estimated: `js/db/repositories/blood-pressure.js` and
`spo2.js` each define only `'manual' | 'ble'` as valid sources, with no
third, camera-based one to even tempt reusing heart rate's `confidence`
field for.

**Real Bluetooth, not just heart rate's.** `js/lib/bluetooth.js` pulls
the shared `isBluetoothAvailable()` feature-detect out of
`ble-heart-rate.js` so all three BLE integrations (heart rate, blood
pressure, pulse oximeter) share one implementation instead of three
copies of the same check. `ble-blood-pressure.js` and
`ble-pulse-oximeter.js` connect to the standard Bluetooth SIG Blood
Pressure and Pulse Oximeter GATT services (`blood_pressure`/
`blood_pressure_measurement`, `pulse_oximeter`/
`plx_continuous_measurement`) the same feature-detected,
degrade-gracefully way `ble-heart-rate.js` already does.

**A real IEEE 11073-20601 float decoder, not heart rate's simple
8/16-bit split.** Both GATT services encode their measurement values
(systolic/diastolic/mean arterial pressure, SpO2%, pulse rate) as
16-bit SFLOATs — a 4-bit signed exponent plus a 12-bit signed mantissa,
`mantissa × 10^exponent` — rather than a plain integer. `js/lib/
ieee11073.js`'s `parseSFloat` is a pure, independently-tested decoder for
it, shared by both BLE integrations, that also recognizes the format's
five reserved bit patterns (NaN, "not at this resolution", ±Infinity, one
reserved value) and returns `null` for every one of them rather than
guessing a number — the same "refuse to fabricate a value" contract as
`parseHeartRateMeasurement`.

**Real published categorization, never a diagnosis.** `blood-pressure-
category.js` implements the American Heart Association's five-tier table
(Normal / Elevated / Hypertension Stage 1 / Stage 2 / Hypertensive
Crisis) exactly — checked most-severe-first so whichever number (systolic
or diastolic) is worse determines the category, not systolic alone.
`spo2-category.js` uses the commonly published pulse-oximetry reference
ranges (95%+ Normal, 91-94% Low, ≤90% flagged to seek care promptly). Both
are purely informational — a category badge next to a reading, nothing
framed as a diagnosis — and Stage 2/Crisis/Low/Seek-care readings get a
visually distinct `.is-concerning` badge treatment so something that
genuinely warrants attention doesn't look identical to a routine reading.

**A real trend and a real streak, the same discipline as every other
mini-app here.** `blood-pressure-trend.js`/`spo2-trend.js` mirror heart
rate's own `summarizeHeartRateTrend` — latest, average, min/max, a delta
from the previous reading, a sparkline — computed fresh from whatever's
actually logged. `vitals-streak.js` is the same consecutive-day streak
math as Sleep's and Meditate's, counting a day once whether it has a
blood-pressure reading, an SpO2 reading, or both — one combined streak on
the Hub tile, not two competing numbers.

**Its own visual identity, a clinical-trust blue** — `--vitals-*` tokens
and `.theme-vitals` in `mini-apps.css`, distinct from Sleep's
indigo/amber, Focus's teal/mint, and Meditate's terracotta/rose, same
fixed night-surface mechanics as all three.

**A real bug this screen's own dark-mode pass surfaced and fixed, not
specific to Vitals.** Every mini-app night surface's own warning box
(`.safety-flag`) — Meditate's crisis note included — was silently losing
its red warning-text color: `.miniapp-night p{ color:inherit }`, a
generic override for headings/paragraphs, outranks `.safety-flag{
color:var(--danger) }` on CSS specificity alone whenever `.safety-flag`
is itself a `<p>`, since a class+element selector beats a lone class one
regardless of source order. The background and border stayed correctly
red; only the text quietly became the surrounding ink color. Fixed with
one higher-specificity rule (`.miniapp-night .safety-flag{
color:var(--danger) }`), verified with real computed-style checks in a
headless browser, not just a glance at a screenshot.

**A second, wider dark-mode bug, same discipline.** Checking
`.btn-secondary`'s contrast in dark mode on this new screen (nothing in
this app used `.btn-secondary` inside a night-surface mini-app before)
surfaced that `--accent-strong` — and every category's own `-strong`
variant (`--accent-sedentary-start-strong` and five others) — was never
given a dark-mode value anywhere in `tokens.css`, even though every
matching `-soft` background variant was. In light mode `-strong` is a
*darker* shade than `-soft`, meant to read as text on that pale
background; once dark mode flips `-soft` to a dark background without
`-strong` also flipping to something lighter, the result is dark text on
a dark background, app-wide, for anyone with a category assigned — not a
Vitals-specific bug, just one this screen's own verification pass was the
first to actually check for. Fixed by giving all seven `-strong` tokens
(the neutral default plus all six category accents) real dark-mode
values, brightened the same way `--danger`/`--warning`/`--success`/
`--info` already were, verified with real computed-style checks against
both the pre-onboarding neutral accent and a real assigned category.

## Steps

A fifth sibling mini-app, and the last real "Vitals & Steps" placeholder
becomes an actual feature: a live-counted walk via real motion sensing, or
manual entry for a full day's total. **Every Hub tile is now real** — no
tile on the Hub grid is a "coming soon" placeholder any longer, the first
time that's been true this whole project.

**A real step-detection algorithm, not a fabricated counter.**
`js/lib/step-detector.js`'s `createStepDetector` is a genuine
threshold-crossing peak detector — the same basic technique behind most
simple pedometer implementations: a light moving-average low-pass filter
smooths raw accelerometer noise, then a step is counted every time the
smoothed magnitude rises above a real threshold (1.2 m/s², a typical
footfall spike once gravity is already removed) and falls back below it,
with a 250ms refractory period so one footfall's rise-then-fall can't be
double-counted as two steps. Pure, stateful-but-synchronous, and
independently unit-tested against synthetic rise-peak-fall sample
sequences — the same synthetic-signal testing discipline as the
camera-PPG heart-rate estimator, deterministic and requiring no real
sensor to verify.

**Real motion sensing, honestly scoped.** `js/features/steps/motion-
steps.js` uses the Generic Sensor API's `LinearAccelerationSensor` —
gravity already removed by the sensor itself, which is what makes a fixed
threshold in the detector meaningful (the raw `Accelerometer` would need
to subtract ~9.8 m/s² of gravity itself first). Feature-detected
(`isMotionSensingAvailable()`) since, like Web Bluetooth, this is a
Chrome/Android(+desktop-with-a-real-sensor) API with no Safari/iOS
implementation at all — "Start a Walk" is disabled with an honest status
message rather than a dead button wherever it's missing.

**No passive background pedometer on the plain web build, and the
screen says so plainly.** A browser tab has no service worker or
background execution — a live walk only counts steps while this screen
stays open and active, the same "no true passive sensing" honesty as
Sleep's own overnight note. For a full day's real total, "Log Today's
Total" sets the day's count outright from whatever a phone's own health
app or a fitness band already reports — deliberately a *set*, not an
*add*, since it's meant to be the authoritative number for the day. A
live-counted walk's steps, in contrast, always add to whatever's already
logged for today, since a walk is always genuinely new activity
happening right now — several walks in one day add up rather than
overwriting each other (`js/db/repositories/steps.js`'s `addStepsToDate`
vs `setStepsForDate`). Wrapped natively via Capacitor, this stops being
the whole story — see "Native builds (Capacitor)" above for the real
background pedometer this screen drives once `isNativeRuntime()` is
true, tagged with its own honest `native-pedometer` source in History
rather than blending in with a live-counted walk's `sensor` source or a
typed-in `manual` one.

**A real, cited daily goal, not the popularized "10,000."** The default
suggested goal (7,500 steps/day, user-editable) cites Lee et al., 2019,
*JAMA Internal Medicine* — a study of step volume and all-cause mortality
in older women that found the mortality benefit leveling off around this
range, a real, specific citation rather than parroting the far more
widely known but less rigorously sourced 10,000-step figure (which
traces back to 1960s Japanese pedometer marketing, not a health study).
Progress draws in as a real circular ring, the same honest
`stroke-dashoffset`-as-attribute technique as Sleep's own score ring —
never a competing CSS value fighting the JS-driven fill.

**A real streak, and the app's own new PWA installability groundwork.**
`js/features/steps/steps-trend.js` mirrors every other mini-app's own
streak math (Sleep, Meditate, Vitals). Alongside this round, `manifest.json`
picked up real 192×192/512×512 PNG icons (both `any` and `maskable`
purpose, generated from the app's existing brand mark) — previously the
manifest only declared one inline SVG icon, workable in a browser install
prompt but not what a proper Android adaptive-icon mask wants; this is
what a tool like [PWABuilder](https://www.pwabuilder.com) needs to
package a real, installable Android app from this site's own live URL,
without wrapping the codebase in a native Capacitor build at all.

## Hydration

The Hub's seventh tile: a running daily total logged from real serving
sizes or a custom amount, drawn as a human figure that actually fills
with water as the day's log grows — not a decorative animation loop, a
real reading of today's total against the daily goal.

**A real fill, not a trick of CSS.** The figure is one clipped SVG
silhouette (`#hydrationFigureClip`) with a `<rect>` behind it
(`#hydration-water-fill`) whose `y` and `height` attributes are set
directly from `todayMl / goal`, the exact same "real attribute drives the
data, CSS only eases the transition" technique as Sleep's score ring and
Steps' goal ring — the ring's `stroke-dashoffset`, this screen's `y`/
`height`, never a competing value fighting the JS-driven fill. The one
purely decorative piece is the small wave riding the water's surface
(`.hydration-wave-scroll`'s own looping `@keyframes`, positioned by JS to
track the fill's real top edge but animated by CSS) — it never encodes
data itself, and `prefers-reduced-motion` turns it (and the fill's own
eased transition) off entirely, jumping straight to the real value like
every other kinetic reading in this app.

**A real, cited daily goal, not the popular "8 glasses a day."** The
default suggested goal (2,200ml, user-editable) is drawn from the
National Academies of Medicine's Dietary Reference Intake for total
water — roughly 3.7L/day for men and 2.7L/day for women including food,
about 3.0L and 2.2L from drinks alone — a real range rather than the
much more widely repeated but unsourced eight-glasses folk rule.

**Every entry is real and additive.** Three quick-log servings (a 250ml
cup, a 500ml bottle, a 750ml large bottle) or a custom amount each add
one real, timestamped row (`js/db/repositories/hydration.js`'s
`hydrationEntries`, append-only like nutrition's own log) rather than
overwriting a single day's number — several drinks logged across a day
sum into the running total shown on the figure and in "Today's Log."
`js/features/hydration/hydration-trend.js` mirrors every other mini-app's
own streak and 7-day-average math, grouping multiple same-day entries
into one real daily total first.

**A real reminder, honestly scoped.** The Reminders card is the same
local/in-session notification approach as Goals (`js/lib/
notifications.js`) — asked for once, never on its own, then a real
system notification. Unlike Goals' once-per-calendar-day nudge, water
needs reminding more than once a day, so `js/features/hydration/
hydration-reminders.js`'s `hydrationNeedsReminder` is interval-based (a
user-editable "remind every N hours," checked against a persisted
timestamp of the last reminder rather than a date string) — checked on
every app load and every time this screen opens, and it stands down for
the rest of the day the moment today's goal is actually met, so it never
nags once you're done. And it's honest about its real limit: this only
ever fires while the app is open — there's still no push server behind
this on-device app — the same "not a true background alarm" caveat as
Goals' own nudge, spelled out on the screen itself rather than implied.

## The Fitness Toolkit

Everything from the original 14-phase build — activity logging, tailored
programs, heart rate, women's health, nutrition, recovery, goals, voice
control — lives on unchanged, just one tap deeper behind the Hub's
Fitness Toolkit tile instead of being the app's front door. Every id,
every controller, every test below is exactly as it was; only the
navigation path to reach it moved. (Run mode moved further still — out
to its own standalone Hub tile; see "Run mode" below.)

**The home list now carries the same spatial-tilt/kinetic-data language
as the Hub, Sleep, and Focus** — `js/main.js` calls `attachTilt()` on
`#screen-home` the same way each mini-app does on its own screen, and
every row is a `.tilt-card`/`.tilt-press` pair with a depth-separated
icon badge, using the exact same shared, generic primitives from
`mini-apps.css` (not a reimplementation) inside the app's own
light/dark-adaptive theme rather than a mini-app's fixed night surface.
Each of the 9 rows also gained a real icon for the first time — the
same icon-sprite system as everywhere else, chosen for what the row
actually does (a heart for Heart Rate, a flame for Nutrition, a target
for Goals, ...), not decoration.

**Programs and Nutrition carry the same language one screen deeper**,
each `attachTilt()`'d to its own screen exactly as the home list is. My
Program's week/block indicator is a real kinetic stat — the week number
counts up (`animateCountUp`) each time the screen renders — and every day
card carries a depth-separated icon badge picked for what kind of day it
actually is (a dumbbell for a lift day, wind for cardio, a leaf for
mobility — a new `icon-dumbbell` was added to the sprite for this, there
wasn't one before). Nutrition's three cards and every logged entry are
`.tilt-card`/`.tilt-press` pairs, and today's running totals count up
live as entries are added or removed — the one set of numbers on that
screen that actually changes as you use it, which is also why the static
calorie/macro *targets* deliberately don't animate. All of it reuses the
same generic `.tilt-card`/`.tilt-press`/`data-tilt-depth` primitives and
a shared `.tilt-stagger` entrance-stagger utility (`css/components.css`,
generalized off the home list's own per-row stagger so these
dynamically-rendered lists don't reimplement it) — no new mechanism, just
the existing one applied further in. (Run mode picked up this exact same
treatment first, before it moved out to its own Hub tile — see "Run mode"
below for where that description lives now.)

**Every remaining Fitness Toolkit screen now carries it too.** Log
Activity, Activity History, the Rest Timer, the Cycle Tracker's PIN
lock/unlock and main screens, and Readiness were the last ones still on
the app's plain surface with no `attachTilt()` call at all — each now
gets its own scoped instance, the identical `attachTilt(screen)` +
one-time `pointerdown` motion-permission request every other screen
already uses. History rows that had no icon before (Activity, Readiness)
now carry one, reusing that same feature's own already-established icon
(`icon-sliders` for Activity, `icon-sparkle` for Readiness — the same
one its own Fitness Toolkit list row already uses, not a new one) rather
than inventing a fresh meaning. The Rest Timer's duration picker and the
Cycle Tracker's PIN/prediction/log-entry panels are now real `.tilt-card`/
`.tilt-press` pairs, the same "the *form itself* is the pressable card"
treatment as Goals' own New Goal card — no new mechanism anywhere here,
every one of these reuses the exact same generic primitives the Hub and
Programs/Nutrition already established.

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

**Its own Hub tile now, not a row inside the Fitness Toolkit.** Run
started life as one line among many in the original 14-phase build's home
list; once it had its own night-surface identity (see below) it made
sense to give it the same standalone-tile treatment as Sleep, Focus,
Meditate, Vitals, Steps, and Hydration — an 8th Hub tile
(`hub-tile--run`, `#icon-wind`), its subtitle showing the most recent
real run's distance and date (`setRunTileSubtitle` in `hub-view.ts`,
same "real number or an honest default, never fabricated" rule as every
other tile) rather than a streak, since running every single day isn't
the natural cadence Steps/Hydration's daily subtitles assume. "Run
History," previously its own separate home-list row, is now a small
icon-button in the live screen's own header (`#icon-chart-line`) —
reachable from inside Run rather than needing its own Hub tile, the same
way Sleep's History lives behind its own dashboard rather than the Hub
grid.

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

**Real runner-facing depth, not just distance/duration/pace.**
`gps-math.js`'s `recentPaceSecPerKm` computes pace over only the last
30 seconds of recorded points — that's the live "Pace" number on the
run screen, a real current speed rather than the whole-run average
(shown underneath it, labeled `avg`, so both are visible at once — a
runner cares whether they've sped up in the last minute, which an
average by definition can't show). `js/features/run/splits.js`'s
`computeSplits` walks the recorded route and records a real split every
time cumulative distance crosses a full km/mile, each with its own pace
— shown live as they're crossed, on the finish summary, and (computed
fresh from the saved route) under a "Splits" disclosure on every past
run in History, so "which part of this run was fastest" has a real
answer instead of needing to be inferred from one average number.
`js/features/run/run-units.js` adds a persisted km/mi distance-unit
preference (same `js/lib/storage.js` pattern as theme), with unit-aware
formatters wrapping — not duplicating — `gps-math.js`'s existing metric
formatters; the toggle lives on the live screen and applies everywhere
distance/pace show up. And the live screen now checks the person's own
prior runs (snapshotted once at Start, not re-queried every tick) against
their current distance/pace with every render, surfacing a real "on pace
for a new best" badge *during* the run — the app already computed this
for the post-run summary; this is the same honest math, just also shown
while it can still change how the run goes.

**A geolocation permission bug, actually diagnosed, not just retried.**
"Location access was denied" persisting after fixing it in Settings
almost always means one specific thing on iOS: a web app installed via
Add to Home Screen runs as its own origin-scoped context, with its own
location permission entirely separate from the Safari tab it was
installed from — granting it in Safari does nothing for the installed
app, and vice versa. The error copy now says this plainly instead of a
generic "check your browser settings" that doesn't fix that case. Two
real bugs went with it: `startWatching()` never actually reported failure
to its caller (a denied fix still flipped the UI into "Pause"/tracking
state, an honestly confusing state to be in), and a fresh attempt didn't
clear the previous error, so a genuinely-fixed permission could still
look stuck through a retry. Both are fixed — the banner now clears
optimistically on every fresh attempt, carries a real **Try Again**
button wired to the exact same start path the main button uses, and
`checkGeoPermissionUpfront()` best-effort checks the Permissions API on
screen entry so a known-denied state shows before anyone has to tap
Start and watch it fail.

**A real identity, not the Fitness Toolkit's neutral chrome borrowed
wholesale.** Run's three screens (live, summary, history) now carry
their own night-surface theme — a hot track-red/amber palette
(`--run-accent`/`--run-accent-2` in `mini-apps.css`), the same
`.miniapp-night`/`.theme-*` mechanics as Sleep/Focus/Meditate/Vitals/
Steps/Hydration, applied to a screen that already had the most
sophisticated real logic of any of them (live GPS, splits, PR
detection) but none of their visual polish. Everything underneath —
the stat card, the route canvas, the splits list, the PR badge — is
unchanged; only the surface it sits on is new.

**Live GPS-quality feedback, the same fix Heart Rate's camera capture
already got.** The original build silently dropped any GPS fix worse
than 30m (`filterAccuratePoints`) with nothing to show for it — accurate,
but gave someone stuck indoors or under tree cover no way to understand
why their distance wasn't climbing. `js/features/run/gps-signal-
quality.js`'s `assessGpsSignalQuality` reads the real accuracy radius off
the latest fix (even one just filtered out) and shows it live — "Strong/
Fair/Weak GPS signal (±Nm)" plus a colored dot — the exact same "give a
person something to react to during live capture" fix as heart rate's
own `signal-quality.js`, just for a GPS fix's accuracy instead of a
camera-PPG signal's coefficient of variation.

**A real Capacitor-readiness seam — and, as of a later round, a real
plugin behind it, not just the message-flip.** `js/lib/native-runtime.js`'s
`isNativeRuntime()` already existed as a seam for future native builds
(see "Heart rate" below) but wasn't called from anywhere yet. Run's own
honesty note — "keep this screen open, a web app can't track your route
once it's backgrounded" — reads that seam directly: false in every
browser context today (so the message is unchanged for anyone using
this app right now), and once this project is actually wrapped with
Capacitor, the same check flips to a real "this device tracks your run
in the background" message. That flip stopped being hypothetical once
Run's live GPS watch itself started routing through a genuine
`@capacitor-community/background-geolocation` foreground service on a
native build — see "Native builds (Capacitor)" above for the real
mechanism, not just the honest copy describing it.

**Real audible and haptic split cues — the one thing that most made this
not feel like a runner's app.** `js/lib/audio-cue.js` gained
`playSplitCue()` (a single synthesized "ding," deliberately a different
shape from the rest-timer's two-note completion chime) plus a short
device vibration, fired the instant `computeSplits` reports a *new* split
— not on every render tick re-drawing the same list. The same honest,
best-effort, no-audio-file approach as the rest-timer's own beep;
`primeAudio()` unlocks it from inside the real Start/Resume click, since
splits themselves fire later, asynchronously.

**A real, cited-from-the-same-estimator calorie badge — reusing Activity
logging's MET formula, not a second one.** Run mode never showed a
calorie figure at all, unlike Activity logging just across the Fitness
Toolkit. `js/features/run/run-calorie-estimate.js`'s `estimateRunCalories`
calls the exact same `estimateActivityCalories` MET-formula estimator
Activity already has — no new number-fabricating path — but infers
intensity from the run's own real recorded average pace
(`intensityFromPaceSecPerKm`: sub-5:00/km reads as vigorous, 5:00-7:00/km
as moderate, slower as light) instead of needing it self-reported after
the fact. Always tagged `estimated`, right next to the pace's own
`measured` GPS badge, on both the finish summary and every past run in
History (recomputed live from each run's own saved distance/duration/
pace and the *current* profile weight, same "never stored, always fresh"
rule as splits) — and simply hidden, never a fabricated number, for
anyone without a profile weight on file yet.

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

**Camera-PPG's real gap wasn't the technique — a fingertip-over-camera
pulse read is genuinely how commercial phone apps do this — it was
giving someone nothing to react to during the 15 seconds it takes.**
Four fixes:
- **Live signal-quality feedback** (new `js/features/heart-rate/signal-
  quality.js`) — a coefficient-of-variation read on the last few seconds
  of raw samples, shown as real text ("Signal looks good — hold steady",
  "No pulse detected yet — press your fingertip fully over the camera
  and flash", "Signal is noisy — hold still") that updates live during
  capture, instead of a silent wait followed by a single pass/fail.
- **A settling window** (`ppg-signal.js`'s new `SETTLE_MS`) — the first
  second of samples is dropped before estimation. A camera's auto-
  exposure/white-balance visibly swings right after a stream starts;
  left in, that transient was corrupting the detrend baseline for
  everything estimated from it.
- **Auto-torch where the browser exposes one** (Chrome/Android only —
  torch control isn't a standard API, it's a Chrome-specific
  `MediaTrackConstraint`) — a real, meaningful signal-quality
  improvement wherever it's available, feature-detected and silently
  inert everywhere else, turned back off the moment a reading ends.
- **Waits for a real video frame** before sampling starts, rather than
  risking the first sample(s) being a black frame from before the
  stream actually had image data.

**Readings were already being auto-saved on every capture** — the gap
was that nothing was ever done with them. `js/features/heart-rate/
trend.js`'s `summarizeHeartRateTrend` is real, pure insight computed
from the samples already in the store: latest reading, average/min/max
over the most recent readings, the delta from the one before it, and a
sparkline — shown as a kinetic stat card at the top of the screen
(`animateCountUp` on the latest bpm, real grow-in bars sized from real
values, same technique as Sleep's own week-strip, generalized to this
screen's app-wide theme tokens instead of Sleep's night surface).

The whole screen also picked up the same spatial-tilt language as the
rest of the Fitness Toolkit — `attachTilt()` on `#screen-heart-rate`,
depth-separated icon badges on every reading in Recent Readings.

**A seam for native health data, not a promise it works today.**
`js/lib/native-runtime.js`'s `isNativeRuntime()` checks for the
`window.Capacitor` global a Capacitor-wrapped native build injects at
runtime — `undefined` in every browser context today, so it's provably
`false` everywhere this app currently runs, the same "false in the
browser, real once the platform supports it" contract as every other
feature-detected API in this app. This is the seam future native-only
features (HealthKit/Health Connect step counts, a real *background*
pedometer that keeps counting once the app isn't the foregrounded,
active tab — Steps' own live-counted walk, covered below, already works
today without it — and BLE that isn't Chrome/Android-only) gate behind
once this project is actually wrapped with Capacitor — deliberately not
yet wired to a specific native plugin call, since guessing at one a plain web
build has no way to install or exercise would risk shipping something
wrong instead of just not-yet-built. Blood pressure and SpO2 no longer
wait on this seam at all — see "Vitals" below, which ships a real
Bluetooth GATT path today, the same Web Bluetooth API this section's own
BLE strap already uses. Run mode (below) is the first feature actually
calling `isNativeRuntime()`, not just documenting it — its own
background-tracking honesty note reads real, live output from this same
function.

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

Daily totals (`nutritionEntries`, one row per entry, aggregated by date)
are summed and compared against the estimated targets. This is also the
first screen where a person's own free-text input (a food name) gets
rendered back into the page, so it's the first place `js/lib/html.js`'s
`escapeHtml()` matters — every list in the app before this one only ever
rendered static labels or numbers.

**Quick Add stopped being "type everything from memory, every time."**
The research on why food logging apps get abandoned is consistent: past
roughly 30 seconds per entry, adherence collapses within weeks, and a
small fraction of foods account for most of what anyone actually logs.
Three real shortcuts, in order of how exact their numbers are:
- **Search** (new `js/features/nutrition/food-search.js`) — real food
  lookups against [Open Food Facts](https://openfoodfacts.org), a free,
  open (ODbL-licensed) database with no API key and no account. This is
  the one place in this app that talks to a server at all: the search
  text is sent to Open Food Facts to look up nutrition facts; nothing
  about what's actually logged is (see "Your data stays on this device"
  above for the exact boundary). Deliberately *not* wired to fire on
  every keystroke — Open Food Facts asks that `/search` not be used for
  search-as-you-type — only an explicit Search tap or Enter. Results
  carry Open Food Facts' own **per-100g** figures, not a guessed serving
  size, and selecting one fills the form with a visible "adjust to match
  your actual portion" hint that stays up until Add — a search result
  never gets logged as-is.
- **Recent** (new `js/features/nutrition/recent-foods.js`) — built
  entirely from what's already been logged (deduplicated by name,
  most-recently-logged amounts win), no separate list to maintain. These
  *are* exact amounts someone already ate, not a per-100g figure, so a
  tap here logs immediately — no review step.
- **Favorites** (new `favoriteFoods` store, schema v9) — a small, person-
  curated list, saved once from the Quick Add form, then one tap from
  then on. Distinct from Recent: intentional, not automatic, and doesn't
  rotate out.

**A real weekly insight**, not just today's total —
`js/features/nutrition/weekly-trend.js`'s `summarizeWeeklyNutrition`
averages calories/protein across the last 7 days *of days actually
logged* (not diluted by unlogged days, which would understate what a
tracked day really looks like) plus how many of the 7 days got logged at
all — shown as its own kinetic stat card, hidden entirely with nothing
logged yet rather than a zeroed one.

The whole screen also carries the same spatial-tilt language as the rest
of the Fitness Toolkit.

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
notification-worthy happens while the app is open. Feature-detected and
silently no-op wherever Notifications aren't available or permitted,
never throwing into the caller.

**Progress now has a real history, not just a number that forgets
everything before it.** `logGoalProgress` (schema: an embedded `history`
array on the goal's own record, same pattern as a run's saved route)
keeps every update instead of overwriting `currentValue` in place — the
foundation for anything that needs to look back, not just at "now."

**Real celebrations, not silence until the very end.**
`js/features/goals/milestones.js`'s `newlyCrossedMilestones` detects
crossing 25/50/75% (100% stays the existing achieved/notification path,
unchanged) between a goal's previous and current progress — a real,
one-time-per-threshold celebration card and notification, not a repeat
every time progress is logged after already passing it.

**A real "time to smash your goals today" nudge** — `js/features/goals/
reminders.js`'s `goalsNeedingTodaysNudge` flags any active goal that
hasn't had progress logged yet today, checked once per calendar day on
app load (`checkGoalReminders()` in `goals-view.js`, gated behind a
persisted `lastGoalsReminderDate` pref so a reload doesn't re-fire it).
Worth being precise about what this is and isn't: it only ever fires
while the app is actually open — there's still no push server, so this
is the honest on-open version of a reminder, not a true background
alarm, and it never prompts for notification permission on its own, only
acting once it's already granted. A genuine scheduled notification that
fires with the app fully closed becomes possible once this project is
wrapped with Capacitor (see "Heart rate" above on `js/lib/native-
runtime.js`) via its Local Notifications plugin — a real capability
difference the web platform alone doesn't have, not something to fake
here.

The whole screen also picked up the same spatial-tilt language as the
rest of the Fitness Toolkit, plus a real grow-in progress bar
(`transform:scaleX`, same technique as the app's other kinetic bars) and
an `animateCountUp`'d percentage.

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

The vocabulary originally only covered six of the app's screens; it now
reaches Nutrition, Heart Rate, the Cycle Tracker, Goals, Run History,
Sleep, Focus, Meditate, Vitals, Steps, and Hydration too. The feedback bubble also picked up two real fixes:
it shows a few example phrases while listening (`EXAMPLE_PHRASES` in
`voice-control.js`) instead of a bare "Listening…" with no indication of
what it understands, and it now carries a real dismiss button rather
than only ever going away on its own timeout — the mic button showing up
with no visible purpose and no way to make its feedback leave was a fair
complaint about the control as it shipped, not a request to remove it.
