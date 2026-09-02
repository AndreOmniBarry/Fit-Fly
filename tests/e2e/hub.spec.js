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

test.describe('hub', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
  });

  test('renders the tile grid with its kinetic data layers, zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
    await expect(page.locator('#hub-sleep-ring-fill')).toBeVisible();
    await expect(page.locator('#hub-focus-wave')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('the sleep ring is empty before any night is logged, and fills in once one is', async ({ page }) => {
    const ring = page.locator('#hub-sleep-ring-fill');
    await expect(ring).toHaveAttribute('stroke-dashoffset', '100.53');

    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-log-bedtime').fill('23:00');
    await page.locator('#sleep-log-waketime').fill('07:00');
    await page.getByRole('button', { name: 'Save last night' }).click();
    await page.locator('#btn-sleep-dashboard-back').click();

    // score of 100 -> a fully drawn-in ring, offset 0
    await expect(ring).toHaveAttribute('stroke-dashoffset', '0.00');
  });

  test("the focus waveform reflects real playback state, live, from wherever it was started", async ({ page }) => {
    const wave = page.locator('#hub-focus-wave');
    await expect(wave).not.toHaveClass(/is-live/);

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#focus-sound-rain').click();
    await page.locator('#btn-focus-back').click();

    await expect(wave).toHaveClass(/is-live/);

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.locator('#btn-focus-stop').click();
    await page.locator('#btn-focus-back').click();
    await expect(wave).not.toHaveClass(/is-live/);
  });

  test('the Vitals tile is real and reachable', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Vitals' })).toBeVisible();
    await expect(page.locator('#hub-vitals-sub')).toHaveText('Blood pressure & oxygen');

    await page.getByRole('button', { name: 'Vitals' }).click();
    await page.locator('#vitals-bp-systolic').fill('118');
    await page.locator('#vitals-bp-diastolic').fill('76');
    await page.locator('#btn-vitals-bp-save').click();
    await page.locator('#btn-vitals-back').click();

    await expect(page.locator('#hub-vitals-sub')).toHaveText('1-day streak', { timeout: 3000 });
  });

  test('the Steps tile is real and reachable', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Steps' })).toBeVisible();
    await expect(page.locator('#hub-steps-sub')).toHaveText('Count a real walk');

    await page.getByRole('button', { name: 'Steps' }).click();
    await page.locator('#steps-manual-count').fill('4000');
    await page.locator('#btn-steps-manual-save').click();
    await page.locator('#btn-steps-back').click();

    await expect(page.locator('#hub-steps-sub')).toHaveText('1-day streak', { timeout: 3000 });
  });

  test('tilt reacts to pointer input and eases toward it', async ({ page }) => {
    await page.mouse.move(400, 50);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-hub'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });

  test('respects prefers-reduced-motion — tilt never engages at all', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    // The skip from beforeEach is already remembered — reload lands
    // straight back in the Hub, same as onboarding-skip.spec.js's
    // "the skip is remembered across a reload".
    await expect(page.getByRole('button', { name: 'Sleep' })).toBeVisible();
    await page.mouse.move(400, 50);
    await page.waitForTimeout(300);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-hub'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(tilt.rx).toBe('');
    expect(tilt.ry).toBe('');
  });

  test("tilt stops driving updates once the Hub is navigated away from — regression coverage for " +
    'js/lib/tilt.ts running its rAF loop unconditionally, which once crashed a fake-clock-driven ' +
    "test elsewhere (page.clock's faked requestAnimationFrame cascading the loop through simulated " +
    'time with the Hub off-screen the whole time)', async ({ page }) => {
    await page.mouse.move(400, 50);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Focus' }).click();
    await page.waitForTimeout(200);
    const beforeVal = await page.evaluate(() =>
      getComputedStyle(document.getElementById('screen-hub')).getPropertyValue('--tilt-rx')
    );

    await page.mouse.move(20, 800);
    await page.waitForTimeout(500);
    const afterVal = await page.evaluate(() =>
      getComputedStyle(document.getElementById('screen-hub')).getPropertyValue('--tilt-rx')
    );
    expect(afterVal).toBe(beforeVal);

    // and it resumes cleanly on return, rather than staying stopped forever
    await page.locator('#btn-focus-back').click();
    await page.mouse.move(400, 50);
    await page.waitForTimeout(500);
    const resumedVal = await page.evaluate(() =>
      getComputedStyle(document.getElementById('screen-hub')).getPropertyValue('--tilt-rx')
    );
    expect(resumedVal).not.toBe(afterVal);
  });
});
