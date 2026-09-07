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
// its first line — several tests below start one. Blocking the CDN/HF
// traffic outright keeps this suite fast and network-independent; see
// tests/e2e/voice-guide.spec.js for the tests that actually exercise
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

test.describe('meditate', () => {
  test.beforeEach(async ({ page }) => {
    await blockKokoroNetwork(page);
    await page.goto('/');
    await clearAppDb(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Meditate' }).click();
  });

  test('shows all meditations and breathwork techniques, real icons, zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedKokoroNetworkNoise(msg.text())) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    for (const id of [
      'quiet-mind', 'body-scan', 'sadness', 'anger', 'grief', 'change', 'anxiety',
      'self-compassion', 'loving-kindness', 'gratitude', 'resilience', 'quick-reset', 'sleep-wind-down',
    ]) {
      const tile = page.locator(`#btn-meditate-${id}`);
      await expect(tile).toBeVisible();
      await expect(tile.locator('svg use')).toHaveCount(1);
    }
    for (const id of ['four-seven-eight', 'physiological-sigh', 'box-breathing']) {
      await expect(page.locator(`#btn-meditate-${id}`)).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  });

  test('renders a real category per distinct technique/use-case, not one undifferentiated grid', async ({ page }) => {
    // Real, distinct use-cases (see MEDITATE_CATEGORIES in meditations.ts) —
    // stress reduction, self-compassion/connection, focus, sleep prep, and
    // breathwork each get their own labeled section.
    await expect(page.getByText('WORKING WITH STRESS & DIFFICULT EMOTIONS')).toBeVisible();
    await expect(page.getByText('SELF-COMPASSION & CONNECTION')).toBeVisible();
    await expect(page.getByText('FOCUS & GROUNDING')).toBeVisible();
    await expect(page.getByText('SLEEP PREP')).toBeVisible();
    await expect(page.getByText('BREATHWORK', { exact: true })).toBeVisible();

    // Sleep prep is its own category — the wind-down technique lives there,
    // not lumped in with generic breathwork or focus tiles.
    const sleepSection = page.locator('#meditate-category-sleep');
    await expect(sleepSection.locator('#btn-meditate-sleep-wind-down')).toBeVisible();
    await expect(sleepSection.locator('#btn-meditate-box-breathing')).toHaveCount(0);

    const focusSection = page.locator('#meditate-category-focus');
    await expect(focusSection.locator('#btn-meditate-body-scan')).toBeVisible();
    await expect(focusSection.locator('#btn-meditate-quiet-mind')).toBeVisible();
  });

  test('shows a real streak/minutes card and the "not medical advice" note', async ({ page }) => {
    await expect(page.locator('#meditate-stat-streak')).toBeVisible();
    await expect(page.locator('#meditate-stat-minutes')).toBeVisible();
    await expect(page.getByText('not a substitute for a therapist or a diagnosis')).toBeVisible();
  });

  test('starting a meditation opens the shared player themed for Meditate, not Focus', async ({ page }) => {
    await page.locator('#btn-meditate-quiet-mind').click();
    await expect(page.locator('#guided-session-title')).toHaveText('A Quiet Mind');
    await expect(page.locator('#screen-guided-session')).toHaveClass(/theme-meditate/);
    await expect(page.locator('#screen-guided-session')).not.toHaveClass(/theme-focus/);
  });

  test('the new MBSR body scan plays through real captioned beats', async ({ page }) => {
    test.setTimeout(45_000);
    // Two real, word-count-paced intro beats (~18s combined) precede the
    // first named body region — the caption wait must cover that real time,
    // not a guessed shorter one.
    await page.locator('#btn-meditate-body-scan').click();
    await expect(page.locator('#guided-session-title')).toHaveText('Full Body Scan');
    await expect(page.locator('#guided-session-caption')).toHaveText(/left foot/i, { timeout: 25_000 });
  });

  test('the new sleep wind-down (PMR) plays through a real tense/release beat', async ({ page }) => {
    test.setTimeout(45_000);
    // Same real-pacing note as above — ~21s of intro before the first
    // "squeeze" (tense) beat of the first muscle group.
    await page.locator('#btn-meditate-sleep-wind-down').click();
    await expect(page.locator('#guided-session-title')).toHaveText('Wind-Down for Sleep');
    await expect(page.locator('#guided-session-caption')).toHaveText(/squeeze/i, { timeout: 27_000 });
  });

  test('never reintroduces crisis-line content — a plain wellness disclaimer only', async ({ page }) => {
    const bodyText = await page.locator('#screen-meditate').innerText();
    expect(bodyText).not.toMatch(/988/);
    expect(bodyText.toLowerCase()).not.toMatch(/crisis/);
    await expect(page.getByText('not a substitute for a therapist or a diagnosis')).toBeVisible();
  });

  test('End returns to the Meditate screen, not Focus', async ({ page }) => {
    await page.locator('#btn-meditate-gratitude').click();
    await page.locator('#btn-guided-session-end').click();
    await expect(page.locator('#meditate-categories')).toBeVisible();
    await expect(page.locator('#btn-meditate-gratitude')).toBeVisible();
  });

  test('a breathwork technique follows the real pacer, timed to its own beats', async ({ page }) => {
    await page.locator('#btn-meditate-four-seven-eight').click();
    // Two real, word-count-paced intro beats (~18-19s combined) precede the
    // first breath cycle here — longer than Focus's own equivalent intro,
    // so this needs a longer timeout than that suite's, not a shorter wait.
    await expect(page.locator('#guided-session-caption')).toHaveText('Breathe in', { timeout: 25_000 });
    // 4-7-8 breathing: the pacer's transition duration must match the real
    // 4-second inhale, not a guessed constant.
    const pacerVar = await page.evaluate(() =>
      getComputedStyle(document.getElementById('guided-session-pacer')).getPropertyValue('--pacer-transition-ms')
    );
    expect(pacerVar.trim()).toBe('4s');
  });

  test('completing a session end-to-end logs it and updates the real streak, with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedKokoroNetworkNoise(msg.text())) consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.clock.install();
    // A Quick Reset genuinely runs under 30s — the fastest real, honest
    // way to exercise a full natural completion (not an early "End").
    await page.locator('#btn-meditate-quick-reset').click();
    await expect(page.locator('#guided-session-title')).toHaveText('A Quick Reset');

    await page.clock.runFor('00:00:35');
    await page.waitForTimeout(200);

    await expect(page.locator('#meditate-categories')).toBeVisible();
    await expect(page.locator('#meditate-stat-streak')).toHaveText('1', { timeout: 5000 });
    expect(consoleErrors).toEqual([]);
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.locator('#btn-meditate-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });

  test('the screen reacts to tilt, same spatial language as the Hub', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-meditate'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
