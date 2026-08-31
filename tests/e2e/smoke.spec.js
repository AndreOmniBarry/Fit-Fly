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

test('respects prefers-reduced-motion — the app still loads and works clean', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Sleep' }).click();
  await expect(page.locator('#sleep-log-form')).toBeVisible();

  // The Sleep dashboard's stars/decorative animations respect the
  // preference via @media (prefers-reduced-motion: reduce) — this
  // confirms the app is still fully functional under it, not just quiet.
  expect(consoleErrors).toEqual([]);
});
