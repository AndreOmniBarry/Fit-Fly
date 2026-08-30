import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // This sandbox ships one pre-installed Chromium build, pinned to a
    // different revision than @playwright/test's own auto-download
    // manifest expects — point straight at it instead of downloading.
    // The fake-device flags give getUserMedia() a synthetic video/audio
    // source (there's no real camera in this sandbox) so the camera-PPG
    // heart rate flow is exercisable in CI at all.
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Chromium's mobile-viewport emulation, not true WebKit/Mobile Safari —
    // this sandbox only ships a Chromium browser. The user tests real
    // Safari behavior by hand on-device; this project just catches
    // small-viewport layout breakage early.
    { name: 'mobile-viewport', use: { ...devices['Pixel 7'] } },
  ],
});
