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

// A plain synchronous DOM click, bypassing Playwright's own actionability
// machinery (hover, scroll-into-view, stability checks) — those can cost
// real wall-clock ticks that leak into page.clock's faked time once a
// test has installed it, which would make an otherwise-exact elapsed-time
// assertion flaky for no reason related to the stopwatch's own logic.
// Only used in clock-driven tests below; ordinary tests use a normal
// Playwright .click() like everywhere else in this suite.
async function clickId(page, id) {
  await page.evaluate((elId) => document.getElementById(elId).click(), id);
}

// Reads a real "M:SS.cc" (or "...split M:SS.cc") stopwatch readout back
// into total seconds. Real browsers' rendering/compositing work under
// Playwright's simulated clock can inflate exactly how much fake time a
// given runFor() ends up producing (a real quirk of the virtual-time
// budget, not a bug in this app's own wall-clock-based timer — see
// js/lib/timer.js), so these tests compare real magnitude/ordering
// relationships instead of demanding an exact centisecond match.
function parseStopwatchSeconds(text) {
  const match = text.match(/(\d+):(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, mm, ss, cc] = match;
  return Number(mm) * 60 + Number(ss) + Number(cc) / 100;
}

test.describe('stopwatch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.getByRole('button', { name: 'Stopwatch' }).click();
  });

  test('opens ready, zero, with Lap disabled and zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Stopwatch' })).toBeVisible();
    await expect(page.locator('#stopwatch-display')).toHaveText('0:00.00');
    await expect(page.locator('#stopwatch-status')).toHaveText('Ready');
    await expect(page.locator('#btn-stopwatch-primary')).toHaveText('Start');
    await expect(page.locator('#btn-stopwatch-secondary')).toBeDisabled();
    await expect(page.locator('#stopwatch-laps')).toContainText('No laps yet');

    expect(consoleErrors).toEqual([]);
  });

  test('start genuinely advances the real elapsed display and flips the buttons', async ({ page }) => {
    await page.clock.install();
    await clickId(page, 'btn-stopwatch-primary');

    await expect(page.locator('#stopwatch-status')).toHaveText('Running');
    await expect(page.locator('#btn-stopwatch-primary')).toHaveText('Pause');
    await expect(page.locator('#btn-stopwatch-secondary')).toBeEnabled();
    await expect(page.locator('#btn-stopwatch-secondary')).toHaveText('Lap');

    await page.clock.runFor('00:00:05');
    const afterFiveSeconds = parseStopwatchSeconds(await page.locator('#stopwatch-display').textContent());
    expect(afterFiveSeconds).toBeGreaterThanOrEqual(5);
  });

  test('pause freezes the real elapsed time; resume continues it', async ({ page }) => {
    await page.clock.install();
    await clickId(page, 'btn-stopwatch-primary');
    await page.clock.runFor('00:00:03');

    await clickId(page, 'btn-stopwatch-primary'); // pause
    await expect(page.locator('#stopwatch-status')).toHaveText('Paused');
    await expect(page.locator('#btn-stopwatch-primary')).toHaveText('Resume');
    await expect(page.locator('#btn-stopwatch-secondary')).toHaveText('Reset');
    const frozen = await page.locator('#stopwatch-display').textContent();
    const frozenSeconds = parseStopwatchSeconds(frozen);
    expect(frozenSeconds).toBeGreaterThanOrEqual(3);

    // A real freeze: further fake time passing while paused changes
    // nothing about the displayed value, down to the exact string.
    await page.clock.runFor('00:00:04');
    await expect(page.locator('#stopwatch-display')).toHaveText(frozen);

    await clickId(page, 'btn-stopwatch-primary'); // resume
    await expect(page.locator('#stopwatch-status')).toHaveText('Running');
    await page.clock.runFor('00:00:02');
    // Resumed and kept counting — strictly past the frozen value, never
    // reset back toward 0 and never still exactly frozen.
    const afterResume = parseStopwatchSeconds(await page.locator('#stopwatch-display').textContent());
    expect(afterResume).toBeGreaterThan(frozenSeconds);
  });

  test('reset (from paused) clears back to a real, honest zero — laps included', async ({ page }) => {
    await page.clock.install();
    await clickId(page, 'btn-stopwatch-primary');
    await page.clock.runFor('00:00:02');
    await clickId(page, 'btn-stopwatch-secondary'); // lap
    await clickId(page, 'btn-stopwatch-primary'); // pause
    await clickId(page, 'btn-stopwatch-secondary'); // reset

    await expect(page.locator('#stopwatch-display')).toHaveText('0:00.00');
    await expect(page.locator('#stopwatch-status')).toHaveText('Ready');
    await expect(page.locator('#btn-stopwatch-primary')).toHaveText('Start');
    await expect(page.locator('#btn-stopwatch-secondary')).toBeDisabled();
    await expect(page.locator('#stopwatch-laps')).toContainText('No laps yet');
  });

  test('laps record real, distinct lap and split times, newest first', async ({ page }) => {
    await page.clock.install();
    await clickId(page, 'btn-stopwatch-primary');

    await page.clock.runFor('00:00:10');
    await clickId(page, 'btn-stopwatch-secondary'); // lap 1 @ 10s
    await page.clock.runFor('00:00:05');
    await clickId(page, 'btn-stopwatch-secondary'); // lap 2 @ 15s (5s lap)

    const rows = page.locator('.stopwatch-lap-row');
    await expect(rows).toHaveCount(2);
    // Newest (lap 2) first.
    await expect(rows.nth(0)).toContainText('Lap 2');
    await expect(rows.nth(0)).toContainText('split');
    await expect(rows.nth(1)).toContainText('Lap 1');
    await expect(rows.nth(1)).toContainText('split');

    // Real magnitude relationships, not exact centisecond matches (see
    // parseStopwatchSeconds' own comment on why) — lap 1's split is
    // roughly the ~10s mark, lap 2's split is roughly the ~15s mark and
    // strictly bigger than lap 1's, and lap 2's own lap time (~5s) is
    // strictly smaller than its split (cumulative since Start).
    const row0Text = await rows.nth(0).innerText();
    const row1Text = await rows.nth(1).innerText();
    const [lap2Time, lap2Split] = row0Text.split('split').map(parseStopwatchSeconds);
    const [, lap1Split] = row1Text.split('split').map(parseStopwatchSeconds);

    expect(lap1Split).toBeGreaterThanOrEqual(10);
    expect(lap2Split).toBeGreaterThan(lap1Split);
    expect(lap2Time).toBeLessThan(lap2Split);
    expect(lap2Time).toBeGreaterThan(0);
  });

  test('fastest/slowest are only called out with 3+ real laps, and correctly by lap time not split', async ({
    page,
  }) => {
    await page.clock.install();
    await clickId(page, 'btn-stopwatch-primary');

    await page.clock.runFor('00:00:10');
    await clickId(page, 'btn-stopwatch-secondary'); // lap 1: 10s
    await expect(page.locator('.stopwatch-lap-row--fastest')).toHaveCount(0);

    await page.clock.runFor('00:00:04');
    await clickId(page, 'btn-stopwatch-secondary'); // lap 2: 4s — still only 2 laps
    await expect(page.locator('.stopwatch-lap-row--fastest')).toHaveCount(0);

    await page.clock.runFor('00:00:20');
    await clickId(page, 'btn-stopwatch-secondary'); // lap 3: 20s — now 3 real laps

    const fastest = page.locator('.stopwatch-lap-row--fastest');
    const slowest = page.locator('.stopwatch-lap-row--slowest');
    await expect(fastest).toHaveCount(1);
    await expect(slowest).toHaveCount(1);
    await expect(fastest).toContainText('Lap 2'); // the real 4s lap
    await expect(slowest).toContainText('Lap 3'); // the real 20s lap, despite lap 1 having a smaller split
  });

  test('the floating stopwatch button appears only while a real session is active and you\'ve left the screen', async ({
    page,
  }) => {
    const fab = page.locator('#btn-stopwatch-fab');
    await expect(fab).toBeHidden();

    await page.locator('#btn-stopwatch-back').click();
    await expect(fab).toBeHidden(); // never started — nothing real to show

    await page.getByRole('button', { name: 'Stopwatch' }).click();
    await page.clock.install();
    await clickId(page, 'btn-stopwatch-primary');
    await page.clock.runFor('00:00:07');

    await expect(fab).toBeHidden(); // still on the Stopwatch screen itself
    await clickId(page, 'btn-stopwatch-back');
    await expect(fab).toBeVisible();
    const fabSeconds = parseStopwatchSeconds(await fab.textContent());
    expect(fabSeconds).toBeGreaterThanOrEqual(7); // a real, live-ticking elapsed time, not a static placeholder

    await fab.click();
    await expect(page.getByRole('heading', { name: 'Stopwatch' })).toBeVisible();
    await expect(fab).toBeHidden();
  });

  test('the alert interval fires a real beep/vibrate/notification once the elapsed time crosses it', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['notifications']);
    await page.addInitScript(() => {
      window.__notificationTitles = [];
      const OriginalNotification = window.Notification;
      window.Notification = new Proxy(OriginalNotification, {
        construct(target, args) {
          window.__notificationTitles.push(args[0]);
          return new target(...args);
        },
      });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.getByRole('button', { name: 'Stopwatch' }).click();

    await page.locator('#stopwatch-alert-interval button[data-value="1"]').click();
    await page.clock.install();
    await clickId(page, 'btn-stopwatch-primary');
    // Well past the real 1-minute mark — how much further the simulated
    // clock actually lands past it doesn't matter (see
    // parseStopwatchSeconds' own comment); at least one real "N min
    // elapsed" alert must have fired crossing the way there.
    await page.clock.runFor('00:01:01');

    // Filtered, not "every notification matches" — Hydration's own
    // startup reminder check (unrelated to this test, real behavior of
    // its own) can legitimately fire a notification too once permission
    // is granted; this only cares that the stopwatch's own alert is
    // genuinely among whatever fired.
    await expect
      .poll(() => page.evaluate(() => window.__notificationTitles.some((t) => /^\d+ min elapsed$/.test(t))))
      .toBe(true);
  });

  test('back returns to the Fitness Toolkit', async ({ page }) => {
    await page.locator('#btn-stopwatch-back').click();
    await expect(page.getByRole('heading', { name: 'Fitness Toolkit' })).toBeVisible();
  });

  test('reacts to tilt, same spatial language as the rest of the Fitness Toolkit', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-stopwatch'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});
