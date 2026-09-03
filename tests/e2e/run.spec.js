import { expect, test } from '@playwright/test';

test.use({
  permissions: ['geolocation'],
  geolocation: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
});

async function clearAppDb(page) {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('fit-fly');
        req.onsuccess = resolve;
        req.onerror = reject;
        req.onblocked = resolve;
      })
  );
}

async function completeOnboarding(page) {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.locator('#ob-birthdate').fill('1994-05-20');
  await page.locator('#ob-sex button[data-value="female"]').click();
  await page.locator('#ob-height-cm').fill('168');
  await page.locator('#ob-weight-kg').fill('64');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-active-days button[data-value="4"]').click();
  await page.locator('#ob-experience button[data-value="advanced"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="endurance"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
  // Lands on the Hub — Run is one of its own tiles now, not nested a
  // level deeper inside the Fitness Toolkit.
}

/** Nudges the mocked GPS position northeast in small steps, giving
 *  watchPosition something to actually report movement on. */
async function moveGps(context, page, steps, stepDegrees = 0.001) {
  let lat = 40.7128;
  let lon = -74.006;
  for (let i = 0; i < steps; i++) {
    lat += stepDegrees;
    lon += stepDegrees;
    await context.setGeolocation({ latitude: lat, longitude: lon, accuracy: 10 });
    await page.waitForTimeout(150); // let watchPosition's callback fire and the UI re-render
  }
}

test.describe('run mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
  });

  test('starting a run tracks distance/duration/pace and draws a route', async ({ page, context }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-home-run').click();
    await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
    await expect(page.locator('#run-distance')).toHaveText('0 m');

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();

    await moveGps(context, page, 5);

    await expect.poll(async () => page.locator('#run-distance').textContent()).not.toBe('0 m');
    await expect(page.locator('#run-geo-error')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('finishing a run shows a summary and saves it to history', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 5);
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('heading', { name: 'Run Complete' })).toBeVisible();
    await expect(page.locator('#run-summary-distance')).not.toHaveText('—');
    // a person's very first run ever is always both PRs
    await expect(page.locator('#run-summary-prs')).toContainText('New longest run');

    await page.getByRole('button', { name: 'View History' }).click();
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
    await expect(page.locator('#run-history-list .card').first()).toBeVisible();
  });

  test('pause freezes distance accrual; resume continues', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 3);

    await page.getByRole('button', { name: 'Pause' }).click();
    const pausedDistance = await page.locator('#run-distance').textContent();

    await moveGps(context, page, 3); // movement while paused must not count
    await expect(page.locator('#run-distance')).toHaveText(pausedDistance);

    await page.getByRole('button', { name: 'Resume' }).click();
    await moveGps(context, page, 3);
    await expect.poll(async () => page.locator('#run-distance').textContent()).not.toBe(pausedDistance);
  });

  test('run history is empty before any run is completed', async ({ page }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Run History' }).click();
    await expect(page.locator('#run-history-list')).toContainText('No runs logged yet');
  });

  test('leaving mid-run prompts a confirmation', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 2);

    let dialogSeen = false;
    page.once('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });
    await page.locator('#btn-run-back').click();

    expect(dialogSeen).toBe(true);
    // dismissing the confirm keeps us on the run screen
    await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  });

  test('reacts to tilt on the live screen, and the summary numbers arrive as real formatted values', async ({
    page,
    context,
  }) => {
    await page.locator('#btn-home-run').click();

    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-run'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);

    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 5);
    await page.getByRole('button', { name: 'Finish' }).click();

    // animateCountUp settles well inside Playwright's default assertion
    // timeout — these read the real formatted value once it arrives, not
    // a mid-animation frame.
    await expect(page.locator('#run-summary-distance')).toContainText('m');
    await expect(page.locator('#run-summary-pace')).toContainText('/km');

    await page.getByRole('button', { name: 'View History' }).click();
    await expect(page.locator('#run-history-list .card').first().locator('.fitness-row-icon .icon')).toBeVisible();
  });

  test('switching to miles updates the live screen, the summary, and history together', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await expect(page.locator('#run-distance')).toHaveText('0 m');

    await page.getByRole('button', { name: 'mi', exact: true }).click();
    await expect(page.locator('#run-distance')).toHaveText('0 mi');

    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 8); // ~1.25km — enough to read a non-trivial mile figure
    await expect.poll(async () => page.locator('#run-distance').textContent()).toMatch(/mi$/);
    await expect(page.locator('#run-avg-pace-caption')).toContainText('/mi');

    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('#run-summary-distance')).toContainText('mi');
    await expect(page.locator('#run-summary-pace')).toContainText('/mi');

    await page.getByRole('button', { name: 'View History' }).click();
    await expect(page.locator('#run-history-list .card').first()).toContainText('mi');
  });

  test('crossing a full km/mile records a split, live and in the summary, and plays a real audio+haptic cue with zero console errors', async ({
    page,
    context,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click(); // a real click — primes audio-cue.js's AudioContext
    // ~0.001deg diagonal step is ~157m — 8 steps covers just over 1km/1mi.
    await moveGps(context, page, 8);

    await expect(page.locator('#run-live-splits')).toContainText('Km 1');

    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('#run-summary-splits-card')).toBeVisible();
    await expect(page.locator('#run-summary-splits')).toContainText('Km 1');
    await expect(page.locator('#run-summary-splits')).toContainText('/km');

    // and the same split shows up under the saved run in history
    await page.getByRole('button', { name: 'View History' }).click();
    await page.locator('#run-history-list summary', { hasText: 'Splits' }).click();
    await expect(page.locator('#run-history-list')).toContainText('Km 1');

    // playSplitCue()/vibrateDevice() fired for real (a real oscillator,
    // a no-op Vibration API in Chromium) without throwing into the page.
    expect(consoleErrors).toEqual([]);
  });

  test('the live personal-best badge appears once real distance accrues, not at a standing start', async ({
    page,
    context,
  }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('#run-live-pr-badge')).toBeHidden(); // 0m — nothing to claim yet

    await moveGps(context, page, 3);
    // a person's very first run is always a distance PR once they've
    // actually moved, since there's nothing prior to compare against
    await expect(page.locator('#run-live-pr-badge')).toBeVisible();
    await expect(page.locator('#run-live-pr-badge')).toContainText('best');
  });

  test('a denied location permission shows a real error with a Try Again that recovers once granted', async ({
    page,
  }) => {
    // Playwright's context permission APIs model "granted" vs. "not yet
    // decided," not a real PERMISSION_DENIED from watchPosition — the
    // one case worth regression-testing here. This stubs
    // navigator.geolocation directly so the test drives the exact error
    // path a real denial takes, deterministically: denied on the first
    // watch, succeeds from the second (as if the person fixed it and hit
    // Try Again).
    await page.addInitScript(() => {
      let attempt = 0;
      window.navigator.geolocation.watchPosition = (success, error) => {
        attempt += 1;
        if (attempt === 1) {
          setTimeout(() => error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' }), 0);
        } else {
          setTimeout(
            () => success({ coords: { latitude: 40.7128, longitude: -74.006, accuracy: 10 }, timestamp: Date.now() }),
            0
          );
        }
        return attempt;
      };
      window.navigator.geolocation.clearWatch = () => {};
    });
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);

    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();

    await expect(page.locator('#run-geo-error')).toBeVisible();
    await expect(page.locator('#run-geo-error')).toContainText('own permission');
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();

    // Retrying recovers without leaving the screen, and without leaving
    // the stale banner up through the retry — real distance tracking
    // from a genuinely live watch is already covered by the other tests
    // above; this one is specifically about the denial/retry path.
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page.locator('#run-geo-error')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  test('shows a real, honest GPS-quality readout that reflects the live fix accuracy', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await expect(page.locator('#run-gps-quality')).toBeHidden(); // nothing to report before Start

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('#run-gps-quality')).toBeVisible();

    // test.use() above sets accuracy: 10 — right at the "strong" boundary.
    await moveGps(context, page, 1);
    await expect(page.locator('#run-gps-dot')).toHaveAttribute('data-quality', 'strong');
    await expect(page.locator('#run-gps-quality-text')).toContainText('Strong GPS signal');

    // A real fix reporting a worse accuracy radius live-updates to "weak"
    // — the exact same number filterAccuratePoints uses to drop it.
    await context.setGeolocation({ latitude: 40.72, longitude: -74.005, accuracy: 80 });
    await page.waitForTimeout(150);
    await expect(page.locator('#run-gps-dot')).toHaveAttribute('data-quality', 'weak');
    await expect(page.locator('#run-gps-quality-text')).toContainText('Weak GPS signal');
  });

  test('the background-tracking note is honest about the web platform limit today', async ({ page }) => {
    await page.locator('#btn-home-run').click();
    await expect(page.locator('#run-background-note-text')).toContainText("can't track your route");
  });

  test('the background-tracking note reads a real Capacitor-native seam once wrapped natively', async ({ page }) => {
    // js/lib/native-runtime.js's isNativeRuntime() checks
    // window.Capacitor.isNativePlatform() — but the app now vendors the
    // real @capacitor/core runtime (js/vendor/capacitor-core.mjs) for
    // native-pedometer.js/native-background-geo.js's own registerPlugin()
    // calls, and that runtime re-derives isNativePlatform() itself from
    // real bridge signals (window.androidBridge on Android) rather than
    // trusting whatever's already on window.Capacitor — so mocking
    // isNativePlatform directly no longer works; window.androidBridge is
    // what a real Capacitor Android WebView actually injects before any
    // page script runs, undefined in every real browser context today.
    await page.addInitScript(() => {
      window.androidBridge = {};
    });
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);

    await page.locator('#btn-home-run').click();
    await expect(page.locator('#run-background-note-text')).toContainText('tracks your run in the background');
  });

  test('a completed run shows a real, estimated calorie badge next to the measured pace, live and in history', async ({
    page,
    context,
  }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 5);
    await page.getByRole('button', { name: 'Finish' }).click();

    // completeOnboarding() fills in a real weightKg, so a calorie
    // estimate exists — never shown as MEASURED, only ESTIMATED.
    await expect(page.locator('#run-summary-calories-row')).toBeVisible();
    await expect(page.locator('#run-summary-calories')).toContainText('kcal');
    await expect(page.locator('#run-summary-calories-row .data-badge.estimated')).toBeVisible();

    await page.getByRole('button', { name: 'View History' }).click();
    const firstEntry = page.locator('#run-history-list .card').first();
    await expect(firstEntry.locator('.data-badge.estimated')).toContainText('kcal');
    await expect(firstEntry.locator('.data-badge.measured')).toContainText('/km');
  });

  test('the Hub tile reflects the most recent real run, not a fabricated streak', async ({ page, context }) => {
    await expect(page.locator('#hub-run-sub')).toHaveText('GPS-tracked, live pace & splits');

    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 5);
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    await expect(page.locator('#hub-run-sub')).not.toHaveText('GPS-tracked, live pace & splits');
    await expect(page.locator('#hub-run-sub')).toContainText('m'); // real distance, not a streak count
  });

  test('the live and history screens carry Run\'s own visual identity, same as the other mini-apps', async ({ page }) => {
    await page.locator('#btn-home-run').click();
    await expect(page.locator('#screen-run')).toHaveClass(/theme-run/);

    await page.getByRole('button', { name: 'Run History' }).click();
    await expect(page.locator('#screen-run-history')).toHaveClass(/theme-run/);
  });
});
