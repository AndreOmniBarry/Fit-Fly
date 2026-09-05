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

// Kokoro is voice guidance's default engine (see js/features/focus/
// voice-guide.ts's getVoiceEngine()) and its real, tens-of-megabytes
// download triggers automatically the moment any guided session speaks
// its first line — every test in this file starts one. Blocking the
// CDN/HF traffic outright keeps this suite fast and network-independent;
// see tests/e2e/voice-guide.spec.js for the tests that actually exercise
// that download/fallback behavior.
async function blockKokoroNetwork(page) {
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await page.route('https://huggingface.co/**', (route) => route.abort());
}

// route.abort() on those requests still makes Chromium itself log a real
// "Failed to load resource" console entry — a genuine browser artifact of
// deliberately blocking that traffic, not an app bug, so it's filtered
// out of every "zero console errors" assertion below rather than either
// masking real errors by skipping the check, or fighting an unwinnable
// battle to stop the browser logging a failed network request.
function isExpectedKokoroNetworkNoise(text) {
  return text.includes('Failed to load resource');
}

test.describe('guided sessions', () => {
  test.beforeEach(async ({ page }) => {
    await blockKokoroNetwork(page);
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Focus' }).click();
  });

  test('shows all four guided sessions with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedKokoroNetworkNoise(msg.text())) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    for (const id of ['breathing-focus', 'relax', 'focus', 'sleep-focus']) {
      await expect(page.locator(`#btn-guided-session-${id}`)).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test('starting a session shows its title and first caption, and always shows a caption even with voice off', async ({ page }) => {
    await page.locator('#btn-guided-session-breathing-focus').click();
    await expect(page.locator('#guided-session-title')).toHaveText('Breathing Focus');
    await expect(page.locator('#guided-session-caption')).not.toHaveText('—');
    // The caption is a real accessible fallback, not a voice-only extra —
    // it stays populated and visible regardless of the voice toggle.
    await expect(page.locator('#guided-session-caption')).toBeVisible();
  });

  test('progress advances over real elapsed time', async ({ page }) => {
    await page.locator('#btn-guided-session-relax').click();
    await page.waitForTimeout(300);
    const early = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);

    await page.waitForTimeout(4000);
    const later = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);

    expect(parseFloat(later)).toBeGreaterThan(parseFloat(early));
  });

  test('pause freezes progress; resume continues it', async ({ page }) => {
    await page.locator('#btn-guided-session-relax').click();
    await page.waitForTimeout(500);

    await page.locator('#btn-guided-session-pause').click();
    await expect(page.locator('#btn-guided-session-pause')).toHaveText('Resume');
    const frozen = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);

    await page.waitForTimeout(1500);
    const stillFrozen = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);
    expect(stillFrozen).toBe(frozen);

    await page.locator('#btn-guided-session-pause').click();
    await expect(page.locator('#btn-guided-session-pause')).toHaveText('Pause');
    await page.waitForTimeout(1500);
    const resumed = await page.locator('#guided-session-progress').evaluate((el) => el.style.width);
    expect(parseFloat(resumed)).toBeGreaterThan(parseFloat(frozen));
  });

  test('the breathing pacer drives all three rings, timed to the real beat duration', async ({ page }) => {
    await page.locator('#btn-guided-session-breathing-focus').click();
    // The first two beats are prose (no breathPhase) — wait for the
    // caption to actually reach the box-breathing cycle rather than
    // guessing a timeout against their real, word-count-derived durations.
    await expect(page.locator('#guided-session-caption')).toHaveText('Breathe in', { timeout: 15_000 });

    const rings = await page.evaluate(() => {
      const ids = ['guided-session-pacer-core', 'guided-session-pacer-mid', 'guided-session-pacer-outer'];
      return ids.map((id) => {
        const el = document.getElementById(id);
        const style = getComputedStyle(el);
        return { transform: style.transform, transitionDuration: style.transitionDuration };
      });
    });

    // All three rings must actually be moving (not the CSS default
    // 'none'), and the pacer element's --pacer-transition-ms must be set
    // to the real 4s breath-phase duration (box breathing is 4-4-4-4) —
    // regression coverage for the old fixed-3.6s mismatch.
    for (const ring of rings) {
      expect(ring.transform).not.toBe('none');
      expect(ring.transitionDuration).not.toBe('');
    }
    const pacerVar = await page.evaluate(() =>
      getComputedStyle(document.getElementById('guided-session-pacer')).getPropertyValue('--pacer-transition-ms')
    );
    expect(pacerVar.trim()).toBe('4s');
  });

  test('the voice toggle switches on and off', async ({ page }) => {
    await page.locator('#btn-guided-session-focus').click();
    const initial = await page.locator('#btn-guided-session-voice-toggle').getAttribute('aria-pressed');
    await page.locator('#btn-guided-session-voice-toggle').click();
    const toggled = await page.locator('#btn-guided-session-voice-toggle').getAttribute('aria-pressed');
    expect(toggled).not.toBe(initial);
  });

  test('End returns to the Focus screen', async ({ page }) => {
    await page.locator('#btn-guided-session-focus').click();
    await page.locator('#btn-guided-session-end').click();
    await expect(page.locator('#guided-session-grid')).toBeVisible();
  });

  test('the close (X) button also ends the session and returns to Focus', async ({ page }) => {
    await page.locator('#btn-guided-session-focus').click();
    await page.locator('#btn-guided-session-back').click();
    await expect(page.locator('#guided-session-grid')).toBeVisible();
  });

  test('a full session runs through every beat to completion and returns to Focus, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedKokoroNetworkNoise(msg.text())) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.clock.install();
    await page.locator('#btn-guided-session-focus').click();
    await expect(page.locator('#guided-session-title')).toHaveText('Focus');

    // runFor (not fastForward) — the session chains through many beats via
    // recursively-rescheduled setInterval/setTimeout calls, and only
    // runFor actually cascades through timers newly scheduled by other
    // timers as simulated time advances; fastForward fires each
    // currently-pending timer at most once and won't follow the chain.
    await page.clock.runFor('00:01:30'); // well past Focus's ~50s total
    await page.waitForTimeout(200);

    await expect(page.locator('#guided-session-grid')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
