// Stamps sw.js's CACHE_VERSION with the real commit this deploy is built
// from, so every real deploy forces a real service-worker update — see
// sw.js's own long comment on why a hand-maintained version number is
// exactly the failure mode this replaces: CACHE_VERSION sat unbumped for
// days/weeks at a time across real deploys (once literally never bumped
// at all through this project's entire early history), each of those
// deploys silently invisible to every already-installed PWA. Deriving
// the version from the commit itself means there is no "remember to bump
// it" step left to forget — every deploy is definitionally a new commit,
// so every deploy is definitionally a new CACHE_VERSION.
//
// Run as this project's Vercel buildCommand (see vercel.json) — Vercel
// sets VERCEL_GIT_COMMIT_SHA automatically for every build, no
// configuration needed. Falls back to the local git HEAD for `npm run
// serve`/local testing, and leaves the file untouched (not an error) if
// neither is available — a plain checkout with no .git directory (some
// CI/sandbox contexts) shouldn't fail a build over a cache-busting nicety.
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SW_PATH = fileURLToPath(new URL('../sw.js', import.meta.url));

function resolveCommitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync('git rev-parse HEAD', { cwd: fileURLToPath(new URL('..', import.meta.url)) })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

async function main() {
  const sha = resolveCommitSha();
  if (!sha) {
    console.warn('stamp-sw-cache-version: no commit SHA available (no VERCEL_GIT_COMMIT_SHA, no .git) — leaving sw.js as-is.');
    return;
  }
  const shortSha = sha.slice(0, 12);

  const source = await readFile(SW_PATH, 'utf8');
  const pattern = /const CACHE_VERSION = '[^']*';/;
  if (!pattern.test(source)) {
    throw new Error('stamp-sw-cache-version: could not find `const CACHE_VERSION = \'...\';` in sw.js — refusing to guess.');
  }
  const stamped = source.replace(pattern, `const CACHE_VERSION = '${shortSha}';`);
  await writeFile(SW_PATH, stamped);
  console.log(`stamp-sw-cache-version: sw.js CACHE_VERSION -> ${shortSha}`);
}

await main();
