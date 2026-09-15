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

test.describe('bottom nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click(); // lands on the Hub
  });

  test('shows on the Hub with Home active, zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    const nav = page.locator('#bottom-nav');
    await expect(nav).toBeVisible();
    await expect(page.locator('#btn-nav-home')).toHaveClass(/is-active/);
    await expect(page.locator('#btn-nav-home')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#btn-nav-toolkit')).not.toHaveClass(/is-active/);
    await expect(page.locator('#btn-nav-toolkit')).not.toHaveAttribute('aria-current', 'page');

    expect(consoleErrors).toEqual([]);
  });

  test('navigates to each real top-level destination and highlights the matching tab', async ({ page }) => {
    await page.locator('#btn-nav-toolkit').click();
    await expect(page.getByRole('heading', { name: 'Fitness Toolkit' })).toBeVisible();
    await expect(page.locator('#btn-nav-toolkit')).toHaveClass(/is-active/);
    await expect(page.locator('#btn-nav-toolkit')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#btn-nav-home')).not.toHaveClass(/is-active/);

    await page.locator('#btn-nav-badges').click();
    await expect(page.getByRole('heading', { name: 'Real milestones' })).toBeVisible();
    await expect(page.locator('#btn-nav-badges')).toHaveClass(/is-active/);
    await expect(page.locator('#btn-nav-badges')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#btn-nav-toolkit')).not.toHaveClass(/is-active/);

    await page.locator('#btn-nav-settings').click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('#btn-nav-settings')).toHaveClass(/is-active/);
    await expect(page.locator('#btn-nav-settings')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#btn-nav-badges')).not.toHaveClass(/is-active/);

    await page.locator('#btn-nav-home').click();
    await expect(page.locator('#hub-greeting-name')).toBeVisible();
    await expect(page.locator('#btn-nav-home')).toHaveClass(/is-active/);
    await expect(page.locator('#btn-nav-settings')).not.toHaveClass(/is-active/);
  });

  test('hides on a deep mini-app screen that already has its own back button', async ({ page }) => {
    const nav = page.locator('#bottom-nav');
    await expect(nav).toBeVisible();

    await page.getByRole('button', { name: 'Sleep' }).click();
    await expect(nav).toBeHidden();

    await page.locator('#btn-sleep-dashboard-back').click();
    await expect(nav).toBeVisible();
    await expect(page.locator('#btn-nav-home')).toHaveClass(/is-active/);
  });

  test('the floating stopwatch button never overlaps the bottom nav when both are real and visible', async ({ page }) => {
    // screen-home (Fitness Toolkit) is a real top-level screen (nav
    // visible) that also shows the floating stopwatch FAB once a real
    // session is running and its own screen has been left — the one
    // place a collision would actually show if --bottom-nav-h weren't
    // real coordination between the two (see bottom-nav.ts's own doc
    // comment on it).
    await page.locator('#btn-nav-toolkit').click();
    await page.getByRole('button', { name: 'Stopwatch' }).click();
    await page.locator('#btn-stopwatch-primary').click();
    await page.locator('#btn-stopwatch-back').click();

    const nav = page.locator('#bottom-nav');
    const fab = page.locator('#btn-stopwatch-fab');
    await expect(nav).toBeVisible();
    await expect(fab).toBeVisible();

    const navHeight = await nav.evaluate((el) => el.getBoundingClientRect().height);
    const fabBottomGap = await fab.evaluate((el) => window.innerHeight - el.getBoundingClientRect().bottom);
    expect(fabBottomGap).toBeGreaterThanOrEqual(navHeight);
  });
});
