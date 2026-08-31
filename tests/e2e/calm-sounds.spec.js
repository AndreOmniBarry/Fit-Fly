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

test.describe('calm sounds', () => {
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

    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await expect(page.getByRole('heading', { name: 'Sounds to settle into' })).toBeVisible();
    for (const id of ['rain', 'ocean', 'river', 'wind', 'fireplace', 'steady-noise']) {
      await expect(page.locator(`#calm-sound-${id}`)).toBeVisible();
    }
    await expect(page.locator('#calm-now-playing')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('starting a sound shows it as playing with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await page.locator('#calm-sound-rain').click();

    await expect(page.locator('#calm-now-playing')).toBeVisible();
    await expect(page.locator('#calm-now-playing-name')).toHaveText('Rain');
    await expect(page.locator('#calm-now-playing-status')).toContainText('Playing');
    await expect(page.locator('#calm-sound-rain')).toHaveAttribute('aria-pressed', 'true');

    expect(consoleErrors).toEqual([]);
  });

  test('switching sounds stops the first and starts the second, not both at once', async ({ page }) => {
    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await page.locator('#calm-sound-rain').click();
    await expect(page.locator('#calm-sound-rain')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#calm-sound-ocean').click();
    await expect(page.locator('#calm-now-playing-name')).toHaveText('Ocean Waves');
    await expect(page.locator('#calm-sound-rain')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#calm-sound-ocean')).toHaveAttribute('aria-pressed', 'true');
  });

  test('tapping the same playing tile again stops it', async ({ page }) => {
    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await page.locator('#calm-sound-rain').click();
    await expect(page.locator('#calm-now-playing')).toBeVisible();

    await page.locator('#calm-sound-rain').click();
    await expect(page.locator('#calm-now-playing')).toBeHidden();
    await expect(page.locator('#calm-sound-rain')).toHaveAttribute('aria-pressed', 'false');
  });

  test('picking a stop timer reflects a real remaining-time countdown', async ({ page }) => {
    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await page.locator('.calm-timer-pill[data-value="15"]').click();
    await expect(page.locator('.calm-timer-pill[data-value="15"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.calm-timer-pill[data-value="30"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#calm-sound-rain').click();
    await expect(page.locator('#calm-now-playing-status')).toContainText('15 min left');
  });

  test('the stop button fades out and clears the now-playing card', async ({ page }) => {
    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await page.locator('#calm-sound-rain').click();
    await expect(page.locator('#calm-now-playing')).toBeVisible();

    await page.locator('#btn-calm-stop').click();
    await expect(page.locator('#calm-now-playing')).toBeHidden({ timeout: 3000 });
  });

  test("Wind Down's Begin button and Calm Sounds share the same live playback state", async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();
    await page.getByRole('button', { name: 'Start Wind-Down' }).click();

    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.locator('#btn-wind-down-begin')).toContainText('Playing');

    await page.locator('#btn-wind-down-more-sounds').click();
    await expect(page.locator('#calm-now-playing-name')).toHaveText('Rain');
    await expect(page.locator('#calm-sound-rain')).toHaveAttribute('aria-pressed', 'true');
  });

  test('starting a new sound right after stopping the last one survives the fade-out cleanup', async ({ page }) => {
    // Regression coverage for a real race in audio-engine.ts: stop()'s
    // node disposal is deferred behind a fade-out, and it must never
    // reach in and clobber a *newer* graph started in that window.
    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await page.locator('#calm-sound-rain').click();
    await expect(page.locator('#calm-now-playing')).toBeVisible();

    await page.locator('#btn-calm-stop').click();
    await page.locator('#calm-sound-ocean').click();
    await expect(page.locator('#calm-now-playing-name')).toHaveText('Ocean Waves');

    // Wait past the stop-fade's deferred cleanup window and confirm the
    // new sound is still reported as playing, not silently killed.
    await page.waitForTimeout(1800);
    await expect(page.locator('#calm-now-playing')).toBeVisible();
    await expect(page.locator('#calm-now-playing-name')).toHaveText('Ocean Waves');
    await expect(page.locator('#calm-sound-ocean')).toHaveAttribute('aria-pressed', 'true');
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.getByRole('button', { name: 'Calm Sounds' }).click();
    await page.locator('#btn-calm-sounds-back').click();
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
  });
});
