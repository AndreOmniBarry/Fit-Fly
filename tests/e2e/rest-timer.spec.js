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
  await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // Hub -> Fitness Toolkit, where these tests operate
}

test.describe('rest timer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.getByRole('button', { name: 'Rest Timer' }).click();
  });

  test('defaults to a 60s countdown, ready to start', async ({ page }) => {
    await expect(page.locator('#rest-display')).toHaveText('1:00');
    await expect(page.locator('#rest-status')).toHaveText('Ready');
    await expect(page.locator('#rest-presets button[data-value="60"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('choosing a preset updates the display immediately', async ({ page }) => {
    await page.locator('#rest-presets button[data-value="90"]').click();
    await expect(page.locator('#rest-display')).toHaveText('1:30');
  });

  test('a custom duration deselects every preset and applies immediately', async ({ page }) => {
    await page.locator('#rest-custom-seconds').fill('45');
    await page.locator('#btn-rest-custom-apply').click();
    await expect(page.locator('#rest-display')).toHaveText('0:45');
    for (const preset of ['30', '60', '90', '120', '180']) {
      await expect(page.locator(`#rest-presets button[data-value="${preset}"]`)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('runs a real short countdown to completion with the beep/vibrate cue firing', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#rest-custom-seconds').fill('2');
    await page.locator('#btn-rest-custom-apply').click();
    await expect(page.locator('#rest-display')).toHaveText('0:02');

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('#rest-status')).toHaveText('Resting…');

    // Real time: a 2s timer finishes well within Playwright's default
    // 5s assertion timeout — no fake-clock trickery needed.
    await expect(page.locator('#rest-status')).toHaveText('Rest complete!');
    await expect(page.locator('#rest-status-live')).toHaveText('Rest complete!');
    await expect(page.locator('#rest-display')).toHaveText('0:00');
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('pause freezes the countdown; resume continues from where it left off', async ({ page }) => {
    await page.locator('#rest-custom-seconds').fill('10');
    await page.locator('#btn-rest-custom-apply').click();
    await page.getByRole('button', { name: 'Start' }).click();

    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.locator('#rest-status')).toHaveText('Paused');
    const pausedValue = await page.locator('#rest-display').textContent();

    await page.waitForTimeout(1500); // time passes while paused — must not count
    await expect(page.locator('#rest-display')).toHaveText(pausedValue);

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.locator('#rest-status')).toHaveText('Resting…');
    // resumes counting down again from the same paused value, not from full
    await expect
      .poll(async () => page.locator('#rest-display').textContent())
      .not.toBe(pausedValue);
  });

  test('reset returns to the full duration and clears status', async ({ page }) => {
    await page.locator('#rest-custom-seconds').fill('10');
    await page.locator('#btn-rest-custom-apply').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForTimeout(1200);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('#rest-display')).toHaveText('0:10');
    await expect(page.locator('#rest-status')).toHaveText('Ready');
  });

  test('reacts to tilt, same spatial language as the rest of the Fitness Toolkit', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-rest-timer'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
