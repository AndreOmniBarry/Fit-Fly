# Third-party vendored libraries

## Dexie.js 4.4.5

`dexie.min.mjs` (+ its `.map`) is Dexie's official "modern" minified ESM
build, redistributed unmodified. Apache License 2.0.
https://github.com/dexie/Dexie.js

Fetched via `npm pack dexie@4.4.5` (the npm registry, not a live CDN) and
copied straight from `dist/modern/dexie.min.mjs` — see js/db/schema.js for
how it's used.

## @capacitor/core 8.5.1

`capacitor-core.mjs` (+ its `.map`) is Capacitor's own unminified ESM
build, redistributed unmodified (only the `sourceMappingURL` comment was
repointed at the renamed `.map` file alongside it). MIT License.
https://github.com/ionic-team/capacitor

Unlike Dexie, `@capacitor/core` also stays a real npm dependency (see
package.json) — this vendored copy is only what the plain web page
itself imports at runtime (this project has no bundler to resolve a bare
`@capacitor/core` specifier from `node_modules`), while the real
installed package is still what the Capacitor CLI (`cap sync`, `cap
add`) and the native Android build need. Copied straight from
`dist/index.js` — see js/lib/native-runtime.js and js/features/steps/
native-pedometer.js for how it's used. `registerPlugin()` from this
build is what makes the "real native reading, honest no-op everywhere
else" contract work in the browser too: it resolves to a proxy whose
methods reject rather than throwing, so importing it is always safe
even outside a native build.

## Kokoro-js 1.2.1 (loaded from a CDN — the one exception here)

Everything above is vendored specifically so this app can stay fully
offline from its very first load. `kokoro-js` (Apache-2.0,
https://github.com/hexgrad/kokoro, itself bundling `@huggingface/
transformers` and ONNX Runtime Web) breaks that: it exists to run a real
82-million-parameter neural TTS model (Kokoro-82M) whose weights live on
Hugging Face Hub with no vendorable npm form, so using it at all means a
genuine one-time network fetch no vendoring choice avoids — see
js/features/focus/kokoro-voice.ts's own doc comment for the full
reasoning. Given that, committing kokoro-js's own bundled engine (its
self-contained browser build, `dist/kokoro.web.js`, plus the ONNX
Runtime WebAssembly binary it loads alongside itself — ~21MB on its
own) into this repository's permanent git history would cost real,
irreversible size for zero offline benefit.

So this one library is `import()`ed at runtime from
`https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js` — the
CDN kokoro-js's own README recommends for no-bundler use — instead of
being vendored, and only when a person explicitly opts in from Settings'
Voice guide section (never on app boot). It's cached by the browser
after that first load, same as the model weights it fetches from
Hugging Face Hub, so it isn't re-fetched every session. This is the one
place in Fit Fly's own code that talks to a third party at runtime at
all (see the README's "Your data stays on this device" for the only
other one, Nutrition's food search) — sw.js's fetch handler deliberately
leaves this traffic untouched rather than trying to precache it.
