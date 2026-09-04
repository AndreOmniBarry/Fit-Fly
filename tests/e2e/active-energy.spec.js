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

test.describe('active energy', () => {
  test('is hidden on the Hub with nothing logged today, even with a real profile weight on file', async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await expect(page.locator('#hub-active-energy')).toBeHidden();
  });

  test('stays hidden with no profile weight, even after logging real steps', async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('9000');
    await page.locator('#btn-steps-manual-save').click();
    // Steps' own screen never fabricates a number either, with no weight to estimate from.
    await expect(page.locator('#steps-active-energy')).toBeHidden();

    await page.locator('#btn-steps-back').click();
    await expect(page.locator('#hub-active-energy')).toBeHidden();
  });

  test('a real step count and a real profile weight produce a real, matching kcal estimate on both Steps and the Hub', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('9000');
    await page.locator('#btn-steps-manual-save').click();

    const stepsText = await page.locator('#steps-active-energy').textContent();
    expect(stepsText).toMatch(/~\d+ kcal today/);

    await page.locator('#btn-steps-back').click();
    await expect(page.locator('#hub-active-energy')).toBeVisible({ timeout: 3000 });
    const hubText = await page.locator('#hub-active-energy').textContent();
    expect(hubText).toMatch(/~\d+ kcal active today/);

    // With only Steps contributing today, the two real numbers must match.
    const stepsKcal = stepsText.match(/~(\d+) kcal/)[1];
    const hubKcal = hubText.match(/~(\d+) kcal/)[1];
    expect(hubKcal).toBe(stepsKcal);

    expect(consoleErrors).toEqual([]);
  });

  test('returning to the Hub after logging steps elsewhere updates the total live, not only on next app load', async ({
    page,
  }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);

    // The Hub itself hasn't seen any activity yet at first load.
    await expect(page.locator('#hub-active-energy')).toBeHidden();

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('6000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect(page.locator('#hub-active-energy')).toBeVisible({ timeout: 3000 });
  });
});
