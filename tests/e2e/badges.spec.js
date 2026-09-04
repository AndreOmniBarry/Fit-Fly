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

test.describe('badges', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
  });

  test('the Hub tile and screen both start honest — no badges yet, real total tier count', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.locator('#hub-badges-sub')).toHaveText('Real milestones, not stickers');

    await page.getByRole('button', { name: 'Badges' }).click();
    await expect(page.getByRole('heading', { name: 'Real milestones' })).toBeVisible();
    await expect(page.locator('#badges-earned-count')).toHaveText('0');
    const totalCount = Number(await page.locator('#badges-total-count').textContent());
    expect(totalCount).toBeGreaterThan(0);
    await expect(page.locator('#badges-earned-grid')).toContainText('No badges yet');
    // Every real tier in the catalog shows up as an in-progress card.
    await expect(page.locator('#badges-locked-grid .badge-card')).toHaveCount(totalCount);

    expect(consoleErrors).toEqual([]);
  });

  test('a real single-day step milestone earns its badge, live, and updates the Hub tile', async ({ page }) => {
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('12000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect(page.locator('#hub-badges-sub')).toHaveText('1 earned', { timeout: 3000 });

    await page.getByRole('button', { name: 'Badges' }).click();
    await expect(page.locator('#badges-earned-count')).toHaveText('1');
    const earnedCard = page.locator('#badges-earned-grid .badge-card--earned');
    await expect(earnedCard).toContainText('10K Day');
    await expect(earnedCard).toContainText('Earned');
  });

  test('a badge earned once stays earned — logging further activity never un-earns it', async ({ page }) => {
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('11000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();
    await page.getByRole('button', { name: 'Badges' }).click();
    await expect(page.locator('#badges-earned-count')).toHaveText('1');
    const earnedAtFirst = await page
      .locator('#badges-earned-grid .badge-card--earned')
      .locator('p')
      .last()
      .textContent();

    await page.locator('#btn-badges-back').click();
    await page.getByRole('button', { name: 'Badges' }).click(); // re-open, re-evaluates against current data
    await expect(page.locator('#badges-earned-count')).toHaveText('1');
    const earnedAtSecond = await page
      .locator('#badges-earned-grid .badge-card--earned')
      .locator('p')
      .last()
      .textContent();

    expect(earnedAtSecond).toBe(earnedAtFirst);
  });

  test('back returns to the Hub', async ({ page }) => {
    await page.getByRole('button', { name: 'Badges' }).click();
    await page.locator('#btn-badges-back').click();
    await expect(page.getByRole('button', { name: 'Badges' })).toBeVisible();
  });

  test('reacts to tilt, same spatial language as the rest of the app', async ({ page }) => {
    await page.getByRole('button', { name: 'Badges' }).click();
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-badges'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
