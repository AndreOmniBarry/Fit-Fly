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

  test('personal bests start honest — no fabricated record before any real data exists', async ({ page }) => {
    await page.getByRole('button', { name: 'Badges' }).click();
    await expect(page.locator('#badges-personalbests-grid')).toContainText('No personal bests yet');
  });

  test('a real steps day sets a live personal best, shown with its real value — not a tiered/locked card', async ({ page }) => {
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('9500');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await page.getByRole('button', { name: 'Badges' }).click();
    const pbCard = page.locator('#badges-personalbests-grid .badge-card--earned');
    await expect(pbCard).toContainText('Best Steps Day');
    await expect(pbCard).toContainText('9,500 steps');
  });

  test('the All/Personal Bests/Achievements filter really does filter, not just relabel', async ({ page }) => {
    await page.getByRole('button', { name: 'Badges' }).click();

    await expect(page.locator('#badges-personalbests-section')).toBeVisible();
    await expect(page.locator('#badges-achievements-section')).toBeVisible();

    await page.locator('#badges-filter-toggle .chip[data-value="personal-bests"]').click();
    await expect(page.locator('#badges-personalbests-section')).toBeVisible();
    await expect(page.locator('#badges-achievements-section')).toBeHidden();

    await page.locator('#badges-filter-toggle .chip[data-value="achievements"]').click();
    await expect(page.locator('#badges-personalbests-section')).toBeHidden();
    await expect(page.locator('#badges-achievements-section')).toBeVisible();

    await page.locator('#badges-filter-toggle .chip[data-value="all"]').click();
    await expect(page.locator('#badges-personalbests-section')).toBeVisible();
    await expect(page.locator('#badges-achievements-section')).toBeVisible();
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

  test('a newly earned badge shows the shared achievement toast, live', async ({ page }) => {
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('12000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click(); // back on the Hub — refreshHubTile evaluates and announces

    const toast = page.locator('#app-achievement-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('New badge earned!');
    await expect(toast).toContainText('10K Day');

    // Auto-dismisses on its own timer, same as Hydration's own record toast.
    await expect(toast).toBeHidden({ timeout: 6000 });
  });

  test('the toast never re-fires for a badge that was already earned on an earlier visit', async ({ page }) => {
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('12000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();
    await expect(page.locator('#app-achievement-toast')).toBeVisible();
    await expect(page.locator('#app-achievement-toast')).toBeHidden({ timeout: 6000 });

    // Returning to the Hub again re-evaluates the same already-earned
    // badge — isNewlyEarned is false this time, so no second toast.
    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#btn-steps-back').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#app-achievement-toast')).toBeHidden();
  });
});

test.describe('badges: notifications enabled', () => {
  test.use({ permissions: ['notifications'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
  });

  test('a newly earned badge also fires a real system Notification', async ({ page }) => {
    await page.evaluate(() => {
      window.__notificationTitle = null;
      window.__notificationBody = null;
      const OriginalNotification = window.Notification;
      window.Notification = new Proxy(OriginalNotification, {
        construct(target, args) {
          window.__notificationTitle = args[0];
          window.__notificationBody = args[1]?.body ?? null;
          return new target(...args);
        },
      });
    });

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('12000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect.poll(() => page.evaluate(() => window.__notificationTitle)).toBe('New badge earned!');
    await expect.poll(() => page.evaluate(() => window.__notificationBody)).toContain('10K Day');
  });
});
