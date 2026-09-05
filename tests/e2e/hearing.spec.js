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
  await page.evaluate(() => localStorage.clear());
}

test.describe('hearing health', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
  });

  test('starts honest — no check-ins yet, trend card hidden, real Hub tile default text', async ({ page }) => {
    await expect(page.locator('#hub-hearing-sub')).toHaveText('Check the sound level around you');

    await page.getByRole('button', { name: 'Hearing' }).click();
    await expect(page.getByRole('heading', { name: 'Sound level check-in' })).toBeVisible();
    await expect(page.locator('#hearing-trend-card')).toBeHidden();
    await expect(page.locator('#hearing-history-list')).toContainText('No check-ins yet');
  });

  test('a real check-in runs the full capture pipeline, saves, and updates the Hub tile — with zero console errors', async ({
    page,
  }) => {
    test.setTimeout(30000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#btn-hearing-capture-start').click();
    await expect(page.locator('#hearing-progress')).toBeVisible();
    await expect(page.locator('#btn-hearing-capture-start')).toBeDisabled();

    // The fake audio device produces a synthetic, non-silent tone — real
    // signal processing runs against it end to end (getUserMedia ->
    // AnalyserNode -> RMS -> dBFS -> estimated dB), so this always
    // produces a real result, unlike camera-PPG's fake video pattern
    // which can honestly fail to yield a heart rate.
    await expect(page.locator('#btn-hearing-capture-start')).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('#hearing-progress')).toBeHidden();
    await expect(page.locator('#hearing-result')).toBeVisible();
    await expect(page.locator('#hearing-result-db')).toContainText('dB');

    const entry = page.locator('#hearing-history-list .card').first();
    await expect(entry).toContainText('dB');
    await expect(entry.locator('.data-badge.estimated')).toHaveText('estimated');

    await expect(page.locator('#hearing-trend-card')).toBeVisible();
    await expect(page.locator('#hearing-trend-streak')).toHaveText('1');

    await page.locator('#btn-hearing-back').click();
    await expect(page.locator('#hub-hearing-sub')).toHaveText('1-day check-in streak', { timeout: 3000 });

    expect(consoleErrors).toEqual([]);
  });

  test('shows a live in-progress readout during capture, not just a result after 5 seconds', async ({ page }) => {
    test.setTimeout(30000);
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#btn-hearing-capture-start').click();
    await expect(page.locator('#hearing-progress')).toBeVisible();
    // The fake audio device's synthetic tone is strong enough that the
    // live readout can update within the very first ~200ms poll — too
    // fast to reliably catch the initial "Listening…" placeholder still
    // showing, so this checks the real thing that matters: a live dB
    // readout appears *during* capture, well before the 5s result.
    await expect(page.locator('#hearing-live-text')).toContainText('dB', { timeout: 3000 });
    await expect(page.locator('#btn-hearing-capture-start')).toBeEnabled({ timeout: 15000 });
  });

  test('reacts to tilt, same spatial language as the rest of the app', async ({ page }) => {
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-hearing'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#btn-hearing-back').click();
    await expect(page.getByRole('button', { name: 'Hearing' })).toBeVisible();
  });
});

test.describe('hearing health: ambient monitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#hearing-mode-toggle button[data-value="monitor"]').click();
  });

  test('switching to Monitor mode hides Check-in and shows the idle Monitor card', async ({ page }) => {
    await expect(page.locator('#hearing-checkin-mode')).toBeHidden();
    await expect(page.locator('#hearing-monitor-mode')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ambient monitor' })).toBeVisible();
    await expect(page.locator('#hearing-monitor-idle')).toBeVisible();
    await expect(page.locator('#hearing-exposure-card')).toBeHidden(); // no completed session yet
  });

  test('a real monitor session shows a live readout, an accumulating real dose, and a real session summary on stop', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-hearing-monitor-start').click();
    await expect(page.locator('#hearing-monitor-active')).toBeVisible();
    await expect(page.locator('#hearing-monitor-idle')).toBeHidden();

    // The fake audio device's synthetic tone is real and non-silent —
    // the first real sample (a full interval later) produces a live
    // reading, same "real signal processing end to end" contract as the
    // check-in capture above.
    await expect(page.locator('#hearing-monitor-live-db')).toContainText('dB', { timeout: 20000 });

    // A second real sample (a full interval after the first) gives
    // samplesToDoseSegments something to measure a real duration
    // against — dose stops reading "0%". Generous timeout: this is
    // genuinely waiting on two full real 10s sample intervals end to
    // end, not a fixed short animation.
    await expect(page.locator('#hearing-monitor-dose')).not.toHaveText('0%', { timeout: 25000 });

    await page.locator('#btn-hearing-monitor-stop').click();
    await expect(page.locator('#hearing-monitor-summary')).toBeVisible();
    await expect(page.locator('#hearing-monitor-active')).toBeHidden();
    await expect(page.locator('#hearing-monitor-summary-twa')).toContainText('dB');
    await expect(page.locator('#hearing-monitor-summary-dose')).toContainText('%');

    await page.locator('#btn-hearing-monitor-done').click();
    await expect(page.locator('#hearing-monitor-idle')).toBeVisible();
    await expect(page.locator('#hearing-exposure-card')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('leaving the screen mid-session stops it cleanly, with no lingering interval', async ({ page }) => {
    test.setTimeout(30000);
    await page.locator('#btn-hearing-monitor-start').click();
    await expect(page.locator('#hearing-monitor-active')).toBeVisible();
    await expect(page.locator('#hearing-monitor-live-db')).toContainText('dB', { timeout: 15000 });

    await page.locator('#btn-hearing-back').click();
    await expect(page.getByRole('button', { name: 'Hearing' })).toBeVisible();

    // Re-entering shows the idle Monitor card again, not still "active"
    // — the session was really stopped, not just visually hidden.
    await page.getByRole('button', { name: 'Hearing' }).click();
    await expect(page.locator('#hearing-monitor-idle')).toBeVisible();
    await expect(page.locator('#hearing-monitor-active')).toBeHidden();
  });
});

test.describe('hearing screening test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Hearing' }).click();
    await page.locator('#btn-hearing-test-entry').click();
  });

  test('the intro is honest about being a screening tool, not diagnostic', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Hearing screening' })).toBeVisible();
    await expect(page.locator('#hearing-test-intro')).toContainText('screening tool, not a diagnostic');
    await expect(page.locator('#hearing-test-intro')).toContainText('never a substitute for a real audiologist');
  });

  test('back returns to the Hearing screen', async ({ page }) => {
    await page.locator('#btn-hearing-test-back').click();
    await expect(page.getByRole('heading', { name: 'Sound level check-in' })).toBeVisible();
  });

  test('completing a test (hearing every tone immediately) produces real per-ear results with zero console errors', async ({
    page,
  }) => {
    test.setTimeout(30000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-hearing-test-start').click();
    await expect(page.locator('#hearing-test-running')).toBeVisible();
    await expect(page.locator('#hearing-test-progress-label')).toContainText('Left ear · Tone 1 of 6');

    // 6 frequencies × 2 ears — hearing every tone immediately keeps each
    // trial to a single staircase step, the fastest real path through
    // the whole test.
    for (let i = 0; i < 12; i++) {
      await page.locator('#btn-hearing-test-heard').click();
      await page.waitForTimeout(100);
    }

    await expect(page.locator('#hearing-test-results')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#hearing-test-running')).toBeHidden();
    // Heard every tone on the very first (quietest) presentation — no
    // real elevated-threshold or not-detected pattern to flag.
    await expect(page.locator('#hearing-test-elevated-flag')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('a repeat test against a real prior one shows no false worsening when nothing meaningfully changed', async ({
    page,
  }) => {
    test.setTimeout(30000);
    // Seed a real prior test whose thresholds match exactly what an
    // immediate-hear run through this screen produces (the staircase's
    // own start gain, 0.04, for every frequency/ear) — the honest
    // "nothing changed" baseline compareThresholdChange must not flag.
    await page.evaluate(async () => {
      const { saveHearingScreeningTest } = await import('/js/db/repositories/hearing-screening.js');
      const { EARS, TEST_FREQUENCIES_HZ } = await import('/js/features/hearing/pure-tone-test.js');
      const results = [];
      for (const ear of EARS) {
        for (const frequencyHz of TEST_FREQUENCIES_HZ) results.push({ ear, frequencyHz, thresholdGain: 0.04 });
      }
      await saveHearingScreeningTest(results);
    });

    await page.locator('#btn-hearing-test-start').click();
    for (let i = 0; i < 12; i++) {
      await page.locator('#btn-hearing-test-heard').click();
      await page.waitForTimeout(100);
    }
    await expect(page.locator('#hearing-test-results')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#hearing-test-change-flag')).toBeHidden();
  });
});
