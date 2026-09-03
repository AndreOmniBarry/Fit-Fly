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
