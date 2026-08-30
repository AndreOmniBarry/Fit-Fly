import { expect, test } from '@playwright/test';

test('splash screen loads clean, with zero console errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('/');

  await expect(page).toHaveTitle('Fit Fly');
  await expect(page.getByRole('heading', { name: 'Fit Fly' })).toBeVisible();

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  await expect(getStarted).toBeVisible();
  await getStarted.click();

  expect(consoleErrors).toEqual([]);
});

test('respects a dark color scheme via tokens.css', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const bg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor
  );
  // --bg-0 in the dark block resolves to #0f1512 = rgb(15, 21, 18).
  expect(bg).toBe('rgb(15, 21, 18)');
});
