// Fit Fly ships as plain, bundler-free static files served directly from
// the repo root (see scripts/serve.mjs) — there's no existing "build the
// web app into a dist folder" step for Capacitor to point at. This copies
// the exact set of files the app actually needs to run into www/, which
// capacitor.config.ts's webDir points at. Run before `npx cap sync`
// (npm run cap:prepare does this) — www/ itself is gitignored, generated
// fresh every time, never a second source of truth to keep in sync by
// hand.
import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wwwDir = path.join(root, 'www');

const ENTRIES = ['index.html', 'manifest.json', 'css', 'js', 'assets'];

async function main() {
  await rm(wwwDir, { recursive: true, force: true });
  await mkdir(wwwDir, { recursive: true });

  for (const entry of ENTRIES) {
    const src = path.join(root, entry);
    const dest = path.join(wwwDir, entry);
    await cp(src, dest, {
      recursive: true,
      // js/ has both hand-written .js and tsc's compiled output sitting
      // next to their .ts/.d.ts/.map sources — the native app only needs
      // the runtime .js, not the source maps or TypeScript itself.
      filter: (source) => !source.endsWith('.ts') && !source.endsWith('.map'),
    });
  }

  console.log(`prepare-native-www: copied ${ENTRIES.join(', ')} into www/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
