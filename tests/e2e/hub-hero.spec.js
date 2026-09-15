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
}

test.describe('hub hero cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('greets with a real time-based eyebrow and an honest fallback name — never a fabricated one, zero console errors', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(page.locator('#hub-greeting-eyebrow')).toHaveText(/Good (morning|afternoon|evening|night)/);
    await expect(page.locator('#hub-greeting-name')).toHaveText('Keep moving today');

    expect(consoleErrors).toEqual([]);
  });

  test('saving a real display name in Settings updates the Hub greeting live', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.locator('#hub-greeting-name')).toHaveText('Keep moving today');

    await page.locator('#btn-hub-settings').click();
    await page.locator('#profile-display-name').fill('Jordan');
    await page.locator('#profile-birthdate').fill('1990-01-01');
    await page.locator('#profile-sex button[data-value="prefer-not-to-say"]').click();
    await page.locator('#profile-height-cm').fill('170');
    await page.locator('#profile-weight-kg').fill('65');
    await page.locator('#btn-profile-save').click();
    await page.locator('#btn-settings-back').click();

    await expect(page.locator('#hub-greeting-name')).toHaveText('Hi, Jordan');
  });

  test('the Steps hero card shows a real today count, an honest empty chart before any history, and a real distance once a profile height is on file', async ({
    page,
  }) => {
    await completeOnboarding(page);

    await expect(page.locator('#hub-stat-steps-value')).toHaveText('0');
    await expect(page.locator('#hub-stat-steps-sub')).toBeHidden();

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('4321');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect(page.locator('#hub-stat-steps-value')).toHaveText('4321', { timeout: 3000 });
    await expect(page.locator('#hub-stat-steps-sub')).toBeVisible();
    await expect(page.locator('#hub-stat-steps-sub')).toContainText('km');
  });

  test('the Steps hero card never fabricates a distance with no profile height on file', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('4000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect(page.locator('#hub-stat-steps-value')).toHaveText('4000', { timeout: 3000 });
    await expect(page.locator('#hub-stat-steps-sub')).toBeHidden();
  });

  test('the Calories hero card stays in its honest empty state until there is a real number, then shows one — mirroring the plain-text Active Energy line', async ({
    page,
  }) => {
    await completeOnboarding(page);

    await expect(page.locator('#hub-stat-calories-empty')).toBeVisible();
    await expect(page.locator('#hub-stat-calories-value')).toBeHidden();

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('9000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect(page.locator('#hub-stat-calories-value')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#hub-stat-calories-empty')).toBeHidden();
    await expect(page.locator('#hub-stat-calories-value')).toContainText(/~\d+/);
    await expect(page.locator('#hub-stat-calories-value')).toContainText('kcal');

    // Matches the same real total the plain-text Active Energy line shows
    // — both read off the exact same already-computed rollup.
    const heroText = (await page.locator('#hub-stat-calories-value').textContent()).replace(/\s+/g, ' ').trim();
    const heroKcal = heroText.match(/~(\d+)/)[1];
    const lineText = await page.locator('#hub-active-energy').textContent();
    const lineKcal = lineText.match(/~(\d+)/)[1];
    expect(heroKcal).toBe(lineKcal);
  });

  test('the Water hero card shows a real today total, zero-filled and honest before anything is logged', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await expect(page.locator('#hub-stat-water-value')).toHaveText('0 ml');

    await page.getByRole('button', { name: 'Hydration' }).click();
    await page.locator('.hydration-quick-log-btn').first().click();
    await page.locator('#btn-hydration-back').click();

    await expect(page.locator('#hub-stat-water-value')).not.toHaveText('0 ml', { timeout: 3000 });
    await expect(page.locator('#hub-stat-water-value')).toContainText('ml');
  });

  test('"Stay Active" opens the same Fitness Toolkit the grid tile does, with zero console errors', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.getByRole('button', { name: 'Skip for now' }).click();

    await page.locator('#btn-hub-stay-active').click();
    await expect(page.getByRole('heading', { name: 'Fitness Toolkit' })).toBeVisible();

    await page.locator('#btn-fitness-toolkit-back').click();
    await expect(page.locator('#btn-hub-stay-active')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
