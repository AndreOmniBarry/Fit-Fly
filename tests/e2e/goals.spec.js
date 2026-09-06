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

  test('shows the honest "how close am I" framing — real distance left, not just a percentage', async ({ page }) => {
    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('5');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    const card = page.locator('#goals-list .card').first();
    await expect(card).toContainText('5km to go');

    await page.locator('[data-progress-input]').fill('2');
    await page.locator('[data-log-progress-id]').click();
    await expect(card).toContainText('3km to go');
  });

  test('a real logging streak shows as a badge once it is genuinely worth protecting', async ({ page }) => {
    await page.locator('#goal-name').fill('Daily walk');
    await page.locator('#goal-target').fill('100');
    await page.locator('#goal-unit').fill('steps');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    const card = page.locator('#goals-list .card').first();
    await expect(card).not.toContainText('day streak'); // a single log isn't a streak yet

    await page.evaluate(async () => {
      const { logGoalProgressAt } = await import('/js/db/repositories/goals.js');
      const { listActiveGoals } = await import('/js/db/repositories/goals.js');
      const [goal] = await listActiveGoals();
      const today = new Date();
      for (let i = 2; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        await logGoalProgressAt(goal.id, 10 * (3 - i), d.toISOString());
      }
    });

    await page.locator('#btn-goals-back').click();
    await page.locator('#btn-home-goals').click();
    await expect(card).toContainText('3-day streak');
  });

  test('a real trend chart renders once a goal has 2+ logged updates, with the target as a reference line', async ({
    page,
  }) => {
    await page.locator('#goal-name').fill('Run a 5K');
    await page.locator('#goal-target').fill('5');
    await page.locator('#goal-unit').fill('km');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    await expect(page.locator('.trend-chart')).toHaveCount(0); // no history yet at all

    await page.locator('[data-progress-input]').fill('1');
    await page.locator('[data-log-progress-id]').click();
    await expect(page.locator('.trend-chart')).toContainText('Log progress twice to see a trend.');

    await page.locator('[data-progress-input]').fill('2');
    await page.locator('[data-log-progress-id]').click();
    await expect(page.locator('.trend-chart-bar')).toHaveCount(2);
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

  test('a milestone on a real walking goal gets real, activity-flavored copy instead of the generic line', async ({
    page,
  }) => {
    await page.locator('#goal-name').fill('Daily walk');
    await page.locator('#goal-target').fill('100');
    await page.locator('#goal-unit').fill('steps');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    await page.locator('[data-progress-input]').fill('30'); // crosses the 25% threshold
    await page.locator('[data-log-progress-id]').click();

    await expect(page.locator('#goals-list')).toContainText('walk goal');
    await expect(page.locator('#goals-list')).not.toContainText('quarter of the way there.');
  });

  test('a real streak about to break fires a catchy, activity-specific reminder — prioritized over the plain nudge', async ({
    page,
  }) => {
    await page.locator('#goal-name').fill('Daily walk');
    await page.locator('#goal-target').fill('10000');
    await page.locator('#goal-unit').fill('steps');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    // A real 3-day streak ending yesterday, not yet logged today — exactly
    // the moment this should fire, seeded through the real repository
    // (not raw IndexedDB) with explicit past dates, the same convention
    // Steps/Hydration's own e2e specs use for backdated data.
    await page.evaluate(async () => {
      const { logGoalProgressAt, listActiveGoals } = await import('/js/db/repositories/goals.js');
      const [goal] = await listActiveGoals();
      const today = new Date();
      for (let i = 3; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        await logGoalProgressAt(goal.id, 1000 * (4 - i), d.toISOString());
      }
    });

    await page.addInitScript(() => {
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
    await page.reload();

    await expect.poll(() => page.evaluate(() => window.__notificationBody)).toContain('3-day streak');
    const title = await page.evaluate(() => window.__notificationTitle);
    expect(title).not.toBe('Time to smash your goals today'); // the plain fallback, outranked here
    expect(title.toLowerCase()).toContain('walk');
  });

  test('real close-to-target progress fires a catchy reminder when no streak is at risk', async ({ page }) => {
    await page.locator('#goal-name').fill('Drink more water');
    await page.locator('#goal-target').fill('10');
    await page.locator('#goal-unit').fill('liters');
    await page.locator('#goal-start').fill('0');
    await page.locator('#btn-goal-create').click();

    // Logged two days ago (not yesterday, not today) — genuinely close to
    // the target, but with no live streak for a nudge to protect.
    await page.evaluate(async () => {
      const { logGoalProgressAt, listActiveGoals } = await import('/js/db/repositories/goals.js');
      const [goal] = await listActiveGoals();
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      await logGoalProgressAt(goal.id, 9, twoDaysAgo.toISOString());
    });

    await page.addInitScript(() => {
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
    await page.reload();

    await expect.poll(() => page.evaluate(() => window.__notificationBody)).toContain('90%');
    const title = await page.evaluate(() => window.__notificationTitle);
    expect(title).not.toBe('Time to smash your goals today');
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
