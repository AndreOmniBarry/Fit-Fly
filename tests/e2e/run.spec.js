import { expect, test } from '@playwright/test';

test.use({
  permissions: ['geolocation'],
  geolocation: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
});

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
  await page.locator('#ob-experience button[data-value="advanced"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="endurance"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
  await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // Hub -> Fitness Toolkit, where these tests operate
}

/** Nudges the mocked GPS position northeast in small steps, giving
 *  watchPosition something to actually report movement on. */
async function moveGps(context, page, steps, stepDegrees = 0.001) {
  let lat = 40.7128;
  let lon = -74.006;
  for (let i = 0; i < steps; i++) {
    lat += stepDegrees;
    lon += stepDegrees;
    await context.setGeolocation({ latitude: lat, longitude: lon, accuracy: 10 });
    await page.waitForTimeout(150); // let watchPosition's callback fire and the UI re-render
  }
}

test.describe('run mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
  });

  test('starting a run tracks distance/duration/pace and draws a route', async ({ page, context }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-home-run').click();
    await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
    await expect(page.locator('#run-distance')).toHaveText('0 m');

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();

    await moveGps(context, page, 5);

    await expect.poll(async () => page.locator('#run-distance').textContent()).not.toBe('0 m');
    await expect(page.locator('#run-geo-error')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('finishing a run shows a summary and saves it to history', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 5);
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('heading', { name: 'Run Complete' })).toBeVisible();
    await expect(page.locator('#run-summary-distance')).not.toHaveText('—');
    // a person's very first run ever is always both PRs
    await expect(page.locator('#run-summary-prs')).toContainText('New longest run');

    await page.getByRole('button', { name: 'View History' }).click();
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
    await expect(page.locator('#run-history-list .card').first()).toBeVisible();
  });

  test('pause freezes distance accrual; resume continues', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 3);

    await page.getByRole('button', { name: 'Pause' }).click();
    const pausedDistance = await page.locator('#run-distance').textContent();

    await moveGps(context, page, 3); // movement while paused must not count
    await expect(page.locator('#run-distance')).toHaveText(pausedDistance);

    await page.getByRole('button', { name: 'Resume' }).click();
    await moveGps(context, page, 3);
    await expect.poll(async () => page.locator('#run-distance').textContent()).not.toBe(pausedDistance);
  });

  test('run history is empty before any run is completed', async ({ page }) => {
    await page.getByRole('button', { name: 'Run History' }).click();
    await expect(page.locator('#run-history-list')).toContainText('No runs logged yet');
  });

  test('leaving mid-run prompts a confirmation', async ({ page, context }) => {
    await page.locator('#btn-home-run').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await moveGps(context, page, 2);

    let dialogSeen = false;
    page.once('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });
    await page.locator('#btn-run-back').click();

    expect(dialogSeen).toBe(true);
    // dismissing the confirm keeps us on the run screen
    await expect(page.getByRole('heading', { name: 'Run' })).toBeVisible();
  });
});
