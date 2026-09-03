import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.fitfly.mobile',
  appName: 'Fit Fly',
  // Fit Fly is bundler-free and normally serves index.html straight from
  // the repo root (scripts/serve.mjs) — there's no existing "dist" output
  // for Capacitor to point at. www/ is a generated copy (see
  // scripts/prepare-native-www.mjs, run via `npm run cap:prepare`), never
  // committed or hand-edited.
  webDir: 'www',
};

export default config;
