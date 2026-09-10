import { expect, test } from '@playwright/test';

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
  await page.locator('#ob-experience button[data-value="intermediate"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="build-muscle"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
}

test.describe('focus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
  });

  test('shows the full catalog with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Focus' }).click();
    await expect(page.getByRole('heading', { name: 'Take a moment' })).toBeVisible();
    for (const id of ['rain', 'thunderstorm', 'ocean', 'river', 'wind', 'fireplace', 'steady-noise']) {
      await expect(page.locator(`#focus-sound-${id}`)).toBeVisible();
    }
    for (const id of [
      'breathing-focus',
      'relax',
      'focus',
      'sleep-focus',
      'swim-breath',
      'marathon-breath',
      'cardio-depth-breath',
    ]) {
      await expect(page.locator(`#btn-guided-session-${id}`)).toBeVisible();
    }
    await expect(page.locator('#focus-now-playing')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('starting a sound shows it as playing with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-rain').click();

    await expect(page.locator('#focus-now-playing')).toBeVisible();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Rain');
    await expect(page.locator('#focus-now-playing-status')).toContainText('Playing');
    await expect(page.locator('#focus-sound-rain')).toHaveAttribute('aria-pressed', 'true');
    // A real "playing" state here means the AudioContext actually reached
    // 'running' — the honest-failure banner must not show alongside it.
    await expect(page.locator('#focus-audio-blocked')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('the volume control explains it plays through media volume, not app volume', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click();
    // No web API can detect a muted device or a media-volume slider at
    // zero — regression coverage for the one honest fix available for
    // "it says Playing but I hear nothing": telling people what to check.
    // Scoped to this screen — Settings' own Voice guide card carries the
    // same honest phrase for the exact same reason, and it's still in
    // the DOM (just hidden) while Focus is showing.
    await expect(page.locator('#focus-volume')).toBeVisible();
    await expect(page.locator('#screen-focus').getByText(/media volume/i)).toBeVisible();
  });

  test('switching sounds stops the first and starts the second, not both at once', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-rain').click();
    await expect(page.locator('#focus-sound-rain')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#focus-sound-ocean').click();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Ocean Waves');
    await expect(page.locator('#focus-sound-rain')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#focus-sound-ocean')).toHaveAttribute('aria-pressed', 'true');
  });

  test('tapping the same playing tile again stops it', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-rain').click();
    await expect(page.locator('#focus-now-playing')).toBeVisible();

    await page.locator('#focus-sound-rain').click();
    await expect(page.locator('#focus-now-playing')).toBeHidden();
    await expect(page.locator('#focus-sound-rain')).toHaveAttribute('aria-pressed', 'false');
  });

  test('picking a stop timer reflects a real remaining-time countdown', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('.focus-timer-pill[data-value="15"]').click();
    await expect(page.locator('.focus-timer-pill[data-value="15"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.focus-timer-pill[data-value="30"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#focus-sound-rain').click();
    await expect(page.locator('#focus-now-playing-status')).toContainText('15 min left');
  });

  test('the stop button fades out and clears the now-playing card', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-rain').click();
    await expect(page.locator('#focus-now-playing')).toBeVisible();

    await page.locator('#btn-focus-stop').click();
    await expect(page.locator('#focus-now-playing')).toBeHidden({ timeout: 3000 });
  });

  test("Wind Down's Begin button and Focus share the same live playback state", async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();
    await page.getByRole('button', { name: 'Start Wind-Down' }).click();

    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('#btn-wind-down-begin')).toContainText('Playing');

    await page.locator('#btn-wind-down-more-sounds').click();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Rain');
    await expect(page.locator('#focus-sound-rain')).toHaveAttribute('aria-pressed', 'true');
  });

  test('starting a new sound right after stopping the last one survives the fade-out cleanup', async ({ page }) => {
    // Regression coverage for a real race in audio-engine.ts: stop()'s
    // node disposal is deferred behind a fade-out, and it must never
    // reach in and clobber a *newer* graph started in that window.
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-rain').click();
    await expect(page.locator('#focus-now-playing')).toBeVisible();

    await page.locator('#btn-focus-stop').click();
    await page.locator('#focus-sound-ocean').click();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Ocean Waves');

    // Wait past the stop-fade's deferred cleanup window and confirm the
    // new sound is still reported as playing, not silently killed.
    await page.waitForTimeout(1800);
    await expect(page.locator('#focus-now-playing')).toBeVisible();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Ocean Waves');
    await expect(page.locator('#focus-sound-ocean')).toHaveAttribute('aria-pressed', 'true');
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#btn-focus-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the screen reacts to tilt, same spatial language as the Hub', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click();
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-focus'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });

  test('Thunderstorm plays real, randomly-timed thunderclaps with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    // Fake JS timers only — Web Audio's own scheduling runs on the real
    // audio-hardware clock, so this just lets the thunderclap's
    // setTimeout-based scheduler (audio-engine.ts's
    // scheduleNextThunderclap) fire without a real wait.
    await page.clock.install();

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-thunderstorm').click();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Thunderstorm');

    // runFor (not fastForward) — each clap reschedules the next one via a
    // fresh setTimeout call made from inside the previous one firing,
    // and only runFor actually cascades through timers newly scheduled
    // by other timers as simulated time advances; fastForward fires each
    // currently-pending timer at most once and won't follow the chain.
    // Three minutes at a 9-32s random gap is several claps deep — real
    // coverage of the reschedule loop, not just its first firing.
    await page.clock.runFor('00:03:00');
    await page.waitForTimeout(200); // let the last onended's cleanup microtask settle

    await expect(page.locator('#focus-now-playing-name')).toHaveText('Thunderstorm');
    expect(consoleErrors).toEqual([]);
  });

  // Regression coverage for a real, previously-silent gap: start()'s
  // catch block used to swallow a genuine graph-build failure with zero
  // sign of it anywhere — no console entry, no UI change, tapping a
  // tile looked identical to the tap doing nothing. It now reuses the
  // same honest "didn't start" banner the autoplay-blocked case already
  // shows, and logs the real error, whatever throws.
  test('a genuine graph-build failure surfaces the same honest "didn\'t start" banner, not silence', async ({ page }) => {
    await page.addInitScript(() => {
      // Fails the very first BiquadFilterNode a soundscape's graph tries
      // to create — every real soundscape has at least one filter stage,
      // so this reliably reproduces "something inside start() threw"
      // without depending on which specific soundscape is tapped.
      const original = AudioContext.prototype.createBiquadFilter;
      AudioContext.prototype.createBiquadFilter = function patchedCreateBiquadFilter() {
        throw new Error('simulated graph-build failure');
      };
      window.__restoreCreateBiquadFilter = () => {
        AudioContext.prototype.createBiquadFilter = original;
      };
    });
    // addInitScript only takes effect on the *next* navigation — the
    // shared beforeEach above already loaded this page before this test
    // body ran, so reload once now that the patch is actually armed.
    // App state (onboarding, DB) persists across the reload.
    await page.reload();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-rain').click();

    await expect(page.locator('#focus-audio-blocked')).toBeVisible();
    await expect(page.locator('#focus-now-playing')).toBeHidden();
    await expect(page.locator('#focus-sound-rain')).toHaveAttribute('aria-pressed', 'false');
    expect(consoleErrors.some((text) => text.includes('simulated graph-build failure'))).toBe(true);

    // The failure is real and reported — not a dead end that silently
    // never recovers either: restoring the API and trying again works.
    await page.evaluate(() => window.__restoreCreateBiquadFilter());
    await page.locator('#focus-sound-rain').click();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Rain');
    await expect(page.locator('#focus-audio-blocked')).toBeHidden();
  });

  test('every soundscape — including the new rain droplets, ocean/wind wander, and fireplace crackle — plays with zero console errors', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Focus' }).click();
    for (const id of ['rain', 'ocean', 'river', 'wind', 'fireplace', 'steady-noise']) {
      await page.locator(`#focus-sound-${id}`).click();
      await expect(page.locator('#focus-now-playing-status')).toContainText('Playing');
      await expect(page.locator('#focus-audio-blocked')).toBeHidden();
      await page.waitForTimeout(150);
    }

    expect(consoleErrors).toEqual([]);
  });

  test('Ocean\'s wave wander and Wind\'s gust wander keep running cleanly through several real refill cycles', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    // Same fake-JS-timers-only rationale as the Thunderstorm test above —
    // this exercises audio-engine.ts's own scheduleWander() recursive
    // refill loop (the wave/gust equivalent of scheduleNextThunderclap)
    // without a real multi-minute wait. Web Audio's own AudioParam
    // automation still runs on the real audio-hardware clock regardless.
    await page.clock.install();

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-ocean').click();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Ocean Waves');

    // Several real refills deep — each wander chunk covers ~25s, refilling
    // ~19s in, so 3 minutes is well past a handful of them.
    await page.clock.runFor('00:03:00');
    await page.waitForTimeout(100);
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Ocean Waves');

    await page.locator('#focus-sound-wind').click();
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Wind');
    await page.clock.runFor('00:03:00');
    await page.waitForTimeout(100);
    await expect(page.locator('#focus-now-playing-name')).toHaveText('Wind');

    expect(consoleErrors).toEqual([]);
  });
});
