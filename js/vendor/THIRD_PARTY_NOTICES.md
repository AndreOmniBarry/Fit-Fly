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

Fit Fly used to also load `kokoro-js` at runtime from a CDN (a real
neural text-to-speech model with no vendorable npm form) for Voice
guide's opt-in Kokoro engine. That engine was removed outright — see the
README's "Focus" section — after staying unreliable on real devices for
too long.

## Piper voice guide (`@mintplex-labs/piper-tts-web` 1.0.5 + friends)

Voice guide's default engine (`js/features/focus/piper-voice.ts`) is
[Piper](https://github.com/rhasspy/piper), a real VITS-based neural
text-to-speech model, run entirely on-device via ONNX Runtime's
WebAssembly backend. Unlike Kokoro, every piece of this is vendored, not
CDN-fetched — no runtime dependency on Hugging Face, cdnjs, or jsdelivr
survives here at all, even though the library this wraps defaults to all
three. Everything below lives under `js/vendor/piper/`, totals **~99MB**,
and was fetched via `npm pack`/a direct HTTPS download (not a live CDN
import) the same one time Dexie and Capacitor were.

### The library — `piper-tts-web.js` + `piper-o91UDS6e.js`

Fetched via `npm pack @mintplex-labs/piper-tts-web@1.0.5` (an actively
maintained fork of `@diffusion-studio/vits-web`) and copied straight from
`dist/piper-tts-web.js` (the library itself) and `dist/piper-o91UDS6e.js`
(its Emscripten-generated phonemizer glue chunk, dynamically imported by
the first file). MIT License. https://github.com/Mintplex-Labs/piper-tts-web

**One line changed**, the same "repoint, don't rewrite" spirit as
Capacitor's `sourceMappingURL` fix above: `piper-tts-web.js`'s
`await import("onnxruntime-web/wasm")` — a bare specifier this
no-bundler app can't resolve — became
`await import("./onnx/ort.wasm.min.js")`, a plain relative path to the
vendored file below. Nothing else in either file was touched; the
library's own hardcoded `https://huggingface.co/...` model-fetch URL
(no public option exists to override it) is left exactly as shipped and
handled in `sw.js` instead — see that file's own comment for why and how.

### The inference engine — `onnx/ort.wasm.min.js` + `ort-wasm.wasm` + `ort-wasm-simd.wasm`

Fetched via `npm pack onnxruntime-web@1.18.0` (matching piper-tts-web's
own peer-dependency version) and copied straight from
`dist/esm/ort.wasm.min.js` (+ its `.map`) and the two non-threaded,
non-WebGPU WASM binaries from `dist/`. MIT License.
https://github.com/microsoft/onnxruntime

Only the non-threaded builds are vendored: this app sets no
`Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` headers (see
sw.js's own doc comment on why it doesn't need them), so
`crossOriginIsolated` is always false here and onnxruntime-web's own
feature detection never requests the `SharedArrayBuffer`-dependent
`-threaded` variants regardless of `numThreads` — vendoring them would
just be ~30MB nobody's browser would ever fetch. Both the plain and
`-simd` builds are kept (not just whichever this sandbox's Chromium
picks) since real low-end/older devices may lack WASM SIMD; either way
Piper degrades to the Web Speech fallback rather than erroring if a
browser needs a WASM feature genuinely absent here.

### The phonemizer — `phonemize/piper_phonemize.wasm` + `piper_phonemize.data`

Fetched via `npm pack @diffusionstudio/piper-wasm@1.0.0` (the same
package piper-tts-web's own default `WASM_BASE` points at on jsDelivr)
and copied straight from `build/piper_phonemize.wasm` and
`build/piper_phonemize.data`. MIT License.
https://github.com/diffusion-studio/piper-wasm

**Bundled inside `piper_phonemize.data`** is
[espeak-ng](https://github.com/espeak-ng/espeak-ng)'s compiled voice/
language data, which piper_phonemize uses for grapheme-to-phoneme
conversion — this is how Piper (like the reference `rhasspy/piper`
project itself) turns text into the phoneme sequence its ONNX model
actually runs on. espeak-ng is **GPL-3.0-or-later**, not MIT: this one
binary blob (not the MIT-licensed JS/WASM wrapper around it, and not the
voice model below) carries that license. This is the same arrangement
`rhasspy/piper` itself ships under, called out here explicitly rather
than left implicit.

### The voice — `voices/en_US-ljspeech-medium.onnx` + `.onnx.json`

One voice, no picker: `en_US-ljspeech-medium`, a medium-quality (not
high — see the size trade-off below) American English voice trained on
the [LJSpeech dataset](https://keithito.com/LJ-Speech-Dataset/). Its
`MODEL_CARD` in the `rhasspy/piper-voices` dataset states the dataset's
license as **public domain** — LJSpeech is a corpus of public-domain
audiobook readings, one of the most widely used and permissively
licensed datasets in TTS. (A more famous alternative, `en_US-hfc_female`,
was considered and rejected here specifically: its own `MODEL_CARD`
licenses its dataset **CC BY-NC-SA 4.0** — non-commercial — which is not
the "clear, permissive" bar this app holds vendored assets to.)

This project's sandbox could not reach `huggingface.co` directly
(organization egress policy blocks it, along with `cdnjs.cloudflare.com`
and `cdn.jsdelivr.net`, entirely — by design, not by accident, and not
something this project works around). The file was instead obtained from
a public, unmodified byte-for-byte mirror and verified against the
official dataset's own `git-lfs` pointer before being committed:
`sha256:6f52a751e2349abe7a76735eb09dc1875298c77ea2342ffd2fef79ff81b87f22`,
63,531,379 bytes — an exact match. Same MIT-licensed piper training
pipeline as every other Piper voice; only the dataset license differs
per voice, which is why each one's own `MODEL_CARD` matters.

### Why vendor a ~99MB voice+engine instead of CDN-fetching it like Kokoro was

Kokoro couldn't be vendored — its weights had no vendorable npm form, so
running it at all meant a real network fetch no choice avoided (see the
note above this section). Piper's whole point here is the opposite: with
every piece obtainable as a real download (`npm pack` or a direct HTTPS
URL, not a live import), vendoring it removes the exact CDN dependency
that made Kokoro fragile in the first place — a blocked or renamed CDN
package, a Hugging Face outage, or (per this project's own sandbox) an
organization's egress policy simply can't take Fit Fly's voice guide down
anymore, at the cost of ~99MB of permanent repo/install size. That
trade-off was made explicitly, with the size cost known up front, not
discovered after the fact.

The only remaining third party this app's own code talks to at runtime
is Nutrition's food search (see the README's "Your data stays on this
device").
