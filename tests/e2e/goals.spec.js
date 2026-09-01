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
  await page.locator('#ob-experience button[data-value="advanced"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-goal button[data-value="endurance"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-has-injury button[data-value="no"]').click();
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
  await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // Hub -> Fitness Toolkit, where these tests operate
}

test.describe('goals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-goals').click();
  });

  test('empty state before any goal is created', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
    await expect(page.locator('#goals-list')).toContainText('No active goals yet');
  });

  test('creating a goal shows it with 0% progress', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('5');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    const card = page.locator('#goals-list .card').first();
    await expect(card).toContainText('Run a 5K');
    await expect(card).toContainText('0%');
    await expect(card).toContainText('0km of 5km');

    expect(consoleErrors).toEqual([]);
  });

  test('validation blocks creating an incomplete goal', async ({ page }) => {
    await page.locator('#goal-name').fill('Missing target and start');
    await page.locator('#btn-goal-create').click();
    await expect(page.locator('#err-goal')).toBeVisible();
    await expect(page.locator('#goals-list')).toContainText('No active goals yet');
  });

  test('logging progress updates the percentage and value shown', async ({ page }) => {
    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('10');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    await page.locator('[data-progress-input]').fill('5');
    await page.locator('[data-log-progress-id]').click();

    const card = page.locator('#goals-list .card').first();
    await expect(card).toContainText('50%');
  });

  test('reaching the target moves the goal out of the active list', async ({ page }) => {
    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('5');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    await page.locator('[data-progress-input]').fill('5');
    await page.locator('[data-log-progress-id]').click();

    await expect(page.locator('#goals-list')).toContainText('No active goals yet');
  });

  test('a decreasing goal (e.g. weight target) computes progress correctly', async ({ page }) => {
    await page.locator('#goal-name').fill('Reach target weight');
    await page.locator('#goal-target').fill('60');
    await page.locator('#goal-unit').fill('kg');
    await page.locator('#goal-direction button[data-value="decrease"]').click();
    await page.locator('#goal-start').fill('70');
    await page.locator('#btn-goal-create').click();

    await page.locator('[data-progress-input]').fill('65');
    await page.locator('[data-log-progress-id]').click();

    await expect(page.locator('#goals-list .card').first()).toContainText('50%');
  });

  test('a goal survives reload', async ({ page }) => {
    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('5');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    await page.reload();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // reload lands back on the Hub
    await page.locator('#btn-home-goals').click();
    await expect(page.locator('#goals-list .card').first()).toContainText('Run a 5K');
  });

  test('reacts to tilt, same spatial language as the rest of the Fitness Toolkit', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-goals'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});

test.describe('goals: notifications enabled', () => {
  test.use({ permissions: ['notifications'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-goals').click();
  });

  test('shows notifications as already enabled and hides the enable button', async ({ page }) => {
    await expect(page.locator('#goals-notify-status')).toContainText('Enabled');
    await expect(page.locator('#btn-goals-enable-notify')).toBeHidden();
  });

  test('achieving a goal fires a real Notification', async ({ page }) => {
    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('5');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    await page.evaluate(() => {
      window.__notificationTitle = null;
      const OriginalNotification = window.Notification;
      window.Notification = new Proxy(OriginalNotification, {
        construct(target, args) {
          window.__notificationTitle = args[0];
          return new target(...args);
        },
      });
    });

    await page.locator('[data-progress-input]').fill('5');
    await page.locator('[data-log-progress-id]').click();

    await expect
      .poll(() => page.evaluate(() => window.__notificationTitle))
      .toContain('Goal achieved');
  });

  test('crossing a progress milestone shows a real celebration and fires a notification', async ({ page }) => {
    await page.locator('#goal-name').fill('Save $1000');
    await page.locator('#goal-target').fill('100');
    await page.locator('#goal-unit').fill('%');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

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

    await page.locator('[data-progress-input]').fill('30'); // crosses the 25% threshold
    await page.locator('[data-log-progress-id]').click();

    await expect(page.locator('#goals-list')).toContainText('quarter of the way');
    await expect.poll(() => page.evaluate(() => window.__notificationTitle)).toContain('Nice progress');
    await expect.poll(() => page.evaluate(() => window.__notificationBody)).toContain('quarter of the way');
  });

  test('a real "time to smash your goals today" reminder fires on load once a goal needs attention', async ({
    page,
  }) => {
    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('5');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    // The very first load (just now) already ran this check before the
    // goal existed, so nothing fired yet — reloading re-runs it with the
    // goal now in place and un-logged today, which is what should
    // trigger it. The proxy has to go in via addInitScript, before any
    // page script runs on the reload, same reason the voice-control and
    // camera-fake-device tests do the same.
    await page.addInitScript(() => {
      window.__notificationTitle = null;
      const OriginalNotification = window.Notification;
      window.Notification = new Proxy(OriginalNotification, {
        construct(target, args) {
          window.__notificationTitle = args[0];
          return new target(...args);
        },
      });
    });
    await page.reload();

    await expect.poll(() => page.evaluate(() => window.__notificationTitle)).toContain('smash your goals');
  });
});
