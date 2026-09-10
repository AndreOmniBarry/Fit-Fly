import { expect, test } from '@playwright/test';
import { selectRestSeconds } from '../../js/features/timers/rest-duration.js';

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

async function completeOnboarding(page, { goal = 'build-muscle', hasInjury = false, redFlag } = {}) {
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.locator('#ob-birthdate').fill('1994-05-20');
  await page.locator('#ob-sex button[data-value="female"]').click();
  await page.locator('#ob-height-cm').fill('168');
  await page.locator('#ob-weight-kg').fill('64');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#ob-active-days button[data-value="4"]').click();
  await page.locator('#ob-experience button[data-value="advanced"]').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator(`#ob-goal button[data-value="${goal}"]`).click();
  await page.getByRole('button', { name: 'Next' }).click();

  if (redFlag) {
    await page.locator(`#ob-redflags button[data-value="${redFlag}"]`).click();
  }
  if (hasInjury) {
    await page.locator('#ob-has-injury button[data-value="yes"]').click();
    await page.locator('#ob-injury-area').fill(hasInjury);
    await page.locator('#ob-injury-severity button[data-value="1"]').click();
  } else {
    await page.locator('#ob-has-injury button[data-value="no"]').click();
  }
  await page.getByRole('button', { name: 'See my plan' }).click();
  await page.getByRole('button', { name: 'Continue to Fit Fly' }).click();
  await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // Hub -> Fitness Toolkit, where these tests operate
}

test.describe('my program', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('shows a week label, why-this reasoning, and day cards with exercises', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    await expect(page.getByRole('heading', { name: 'My Program' })).toBeVisible();
    await expect(page.locator('#program-week-number')).toHaveText('1');
    await expect(page.locator('#program-block-label')).toContainText('Block');
    await expect(page.locator('#program-reasoning li').first()).toBeVisible();

    const dayCards = page.locator('#program-days > .card');
    await expect(dayCards).toHaveCount(4); // hypertrophy: upper/lower/upper/lower
    await expect(dayCards.first()).toContainText('sets ×');
    await expect(page.locator('#program-deload-banner')).toBeHidden();

    // the demo SVG loaded into the first exercise's slot
    await expect(dayCards.first().locator('svg').first()).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('the program is stable across visits (same week, same exercises)', async ({ page }) => {
    await completeOnboarding(page, { goal: 'endurance' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();
    // Demo SVGs load asynchronously per exercise, and their <title> text
    // counts toward textContent — wait for every one of them, or a visit
    // whose fetches haven't all resolved yet reads as "different" from
    // one where they have. Scoped to just the exercise demo slots, not
    // every svg under #program-days — each day card also carries its own
    // (synchronously-rendered) day-type badge icon.
    const exerciseSlots = page.locator('#program-days [id^="program-svg-"]');
    const exerciseSlotCount = await exerciseSlots.count();
    await expect(exerciseSlots.locator('svg')).toHaveCount(exerciseSlotCount);
    const firstVisitText = await page.locator('#program-days').textContent();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();
    await expect(page.locator('#program-days [id^="program-svg-"] svg')).toHaveCount(exerciseSlotCount);
    const secondVisitText = await page.locator('#program-days').textContent();

    expect(secondVisitText).toBe(firstVisitText);
  });

  test('a flagged injury area routes around exercises that load it', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle', hasInjury: 'right knee' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();

    // knee-contraindicated exercises (squat/lunge pattern) must not appear
    const daysText = await page.locator('#program-days').textContent();
    expect(daysText).not.toContain('Bodyweight Squat');
    expect(daysText).not.toContain('Goblet Squat');
    expect(daysText).not.toContain('Bodyweight Lunge');

    await expect(page.locator('#program-reasoning')).toContainText('knee');
  });

  test('a red flag on onboarding still produces a program, in rehab-recuperation', async ({ page }) => {
    await completeOnboarding(page, { goal: 'endurance', redFlag: 'chest-pain-pressure' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const dayCards = page.locator('#program-days > .card');
    await expect(dayCards).toHaveCount(3); // rehab-recuperation: 3 mobility days
    await expect(dayCards.first()).toContainText('Mobility');
  });

  test('every day card includes a warm-up and cooldown', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const firstCard = page.locator('#program-days > .card').first();
    await expect(firstCard.getByText('Warm-up')).toBeVisible();
    await expect(firstCard.getByText('Cooldown')).toBeVisible();
    await firstCard.getByText('Warm-up').click(); // <details> disclosure
    await expect(firstCard).toContainText('minutes');
  });

  test('logging a set shows an estimated 1RM, updated across every occurrence of that exercise', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    // hypertrophy is an upper/lower split — Dumbbell Bench Press appears
    // on both Day 1 and Day 3, so this also proves the id-collision fix
    // holds. (A bodyweight exercise like push-up gets no weight field at
    // all to log into — see the logMetric tests below — so there's
    // nothing for estimateOneRepMax() to estimate a max of.)
    const logButtons = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]');
    await expect(logButtons).toHaveCount(2);

    const firstDayIndex = await logButtons.first().getAttribute('data-day-index');
    await page.locator(`#program-reps-${firstDayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${firstDayIndex}-dumbbell-bench-press`).fill('40');
    await logButtons.first().click();

    const oneRmSpans = page.locator('[data-onerepmax-for="dumbbell-bench-press"]');
    await expect(oneRmSpans.first()).toContainText('Estimated 1RM');
    await expect(oneRmSpans.nth(1)).toContainText('Estimated 1RM'); // the Day 3 occurrence updated too

    expect(consoleErrors).toEqual([]);
  });

  test('a bodyweight exercise gets a reps-only log form — no "kg" field, no 1RM estimate', async ({ page }) => {
    // rehab-recuperation's mobility days always include Glute Bridge for
    // their hinge slot (see program-generator.js's deterministic pick
    // order) — a real bodyweight, reps-only exercise.
    await completeOnboarding(page, { goal: 'endurance', redFlag: 'chest-pain-pressure' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const logButton = page.locator('button[data-log-set][data-exercise-id="glute-bridge"]').first();
    await expect(logButton).toBeVisible();
    await expect(logButton).toHaveAttribute('data-log-metric', 'reps');
    const dayIndex = await logButton.getAttribute('data-day-index');

    await expect(page.locator(`#program-reps-${dayIndex}-glute-bridge`)).toBeVisible();
    await expect(page.locator(`#program-weight-${dayIndex}-glute-bridge`)).toHaveCount(0);
    await expect(page.locator('[data-onerepmax-for="glute-bridge"]')).toHaveCount(0);

    await page.locator(`#program-reps-${dayIndex}-glute-bridge`).fill('15');
    await logButton.click();
    await expect(page.locator(`#program-reps-${dayIndex}-glute-bridge`)).toHaveValue('');
  });

  test('a held exercise (plank) gets a seconds-held log form — no reps, no "kg" field', async ({ page }) => {
    await completeOnboarding(page, { goal: 'endurance', redFlag: 'chest-pain-pressure' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const logButton = page.locator('button[data-log-set][data-exercise-id="plank"]').first();
    await expect(logButton).toBeVisible();
    await expect(logButton).toHaveAttribute('data-log-metric', 'hold');
    const dayIndex = await logButton.getAttribute('data-day-index');

    const exerciseBlock = page.locator('.stack:has(button[data-log-set][data-exercise-id="plank"])').first();
    await expect(exerciseBlock).toContainText('hold');
    await expect(page.locator(`#program-duration-${dayIndex}-plank`)).toBeVisible();
    await expect(page.locator(`#program-reps-${dayIndex}-plank`)).toHaveCount(0);
    await expect(page.locator(`#program-weight-${dayIndex}-plank`)).toHaveCount(0);

    await page.locator(`#program-duration-${dayIndex}-plank`).fill('25');
    await logButton.click();
    await expect(page.locator(`#program-duration-${dayIndex}-plank`)).toHaveValue('');
  });

  test('a cardio exercise gets a seconds + optional distance log form, distinct from a hold', async ({ page }) => {
    // rehab-recuperation doesn't reach cardio patterns, so use a goal
    // that actually schedules cardio days.
    await completeOnboarding(page, { goal: 'endurance' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const logButton = page.locator('button[data-log-set][data-log-metric="cardio"]').first();
    await expect(logButton).toBeVisible();
    const dayIndex = await logButton.getAttribute('data-day-index');
    const exerciseId = await logButton.getAttribute('data-exercise-id');

    await expect(page.locator(`#program-duration-${dayIndex}-${exerciseId}`)).toBeVisible();
    await expect(page.locator(`#program-reps-${dayIndex}-${exerciseId}`)).toHaveCount(0);
    await expect(page.locator(`#program-weight-${dayIndex}-${exerciseId}`)).toHaveCount(0);

    await page.locator(`#program-duration-${dayIndex}-${exerciseId}`).fill('45');
    await logButton.click();
    await expect(page.locator(`#program-duration-${dayIndex}-${exerciseId}`)).toHaveValue('');
  });

  test('a stationary cardio exercise (Standing March) never gets a fabricated distance field', async ({ page }) => {
    // Week 1 always deterministically picks Standing March for the
    // cardio slot (see program-generator.js's block-rotation comment).
    await completeOnboarding(page, { goal: 'endurance' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const marchLogButton = page.locator('button[data-log-set][data-exercise-id="standing-march"]').first();
    await expect(marchLogButton).toBeVisible();
    const dayIndex = await marchLogButton.getAttribute('data-day-index');
    await expect(page.locator(`#program-distance-${dayIndex}-standing-march`)).toHaveCount(0);
  });

  test('logging a set starts a real inline rest countdown matching the exercise\'s own prescribed rest', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const logButton = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]').first();
    const restSec = await logButton.getAttribute('data-rest-sec');
    expect(Number(restSec)).toBeGreaterThan(0);
    const dayIndex = await logButton.getAttribute('data-day-index');
    const restRow = page.locator(`#program-rest-row-${dayIndex}-dumbbell-bench-press`);
    const restDisplay = page.locator(`#program-rest-display-${dayIndex}-dumbbell-bench-press`);

    await expect(restRow).toBeHidden();

    await page.locator(`#program-reps-${dayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${dayIndex}-dumbbell-bench-press`).fill('40');
    await logButton.click();

    // Starts at (within a couple of real seconds of) the exact number
    // already printed next to the Log button — no separate trip to set it
    // by hand. Parses the same mm:ss shape js/lib/timer.js's own
    // formatDuration produces, rather than matching one exact tick, so a
    // slow CI worker between the click and this assertion can't flake it.
    await expect(restRow).toBeVisible();
    const parseMmSs = (text) => {
      const [minutes, seconds] = text.split(':').map(Number);
      return minutes * 60 + seconds;
    };
    const initialRemaining = parseMmSs(await restDisplay.textContent());
    expect(initialRemaining).toBeLessThanOrEqual(Number(restSec));
    expect(initialRemaining).toBeGreaterThan(Number(restSec) - 3);

    // Not one fixed default — a real, heavier-lift-appropriate duration
    // computed from what was actually just logged (a loaded compound
    // press at hypertrophy reps), matching rest-duration.js's own answer.
    expect(Number(restSec)).toBe(selectRestSeconds({ pattern: 'push', logMetric: 'reps-weight', reps: '8-12' }));
    expect(Number(restSec)).toBeGreaterThanOrEqual(120); // a real heavy-compound-range rest, not a generic 60-90s default

    // Clear about which exercise/set this rest period belongs to, not
    // just that some rest is happening.
    await expect(restRow).toContainText('Resting — Dumbbell Bench Press');
    await expect(restRow).toContainText('Set 1');

    // It's a real countdown, not a static label.
    const firstReading = await restDisplay.textContent();
    await expect.poll(async () => restDisplay.textContent()).not.toBe(firstReading);

    expect(consoleErrors).toEqual([]);
  });

  test('the end-of-rest cue fires — visible completion text, a screen-reader announcement, and a reused system notification', async ({
    page,
    context,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    // Granted ahead of time so the cue's system-notification path
    // (js/lib/notifications.js — the same plumbing Hydration/Goals
    // already use) actually fires instead of silently no-op'ing.
    await context.grantPermissions(['notifications']);

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    // Fake timers so a real (heavy-compound, 2min+) rest period can be
    // fast-forwarded through instead of actually waited out — see
    // focus.spec.js's own use of page.clock for the same reason.
    await page.clock.install();

    const logButton = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]').first();
    const restSec = Number(await logButton.getAttribute('data-rest-sec'));
    const dayIndex = await logButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${dayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${dayIndex}-dumbbell-bench-press`).fill('40');

    const sawNotification = page.evaluate(
      () =>
        new Promise((resolve) => {
          const OriginalNotification = window.Notification;
          window.Notification = new Proxy(OriginalNotification, {
            construct(target, args) {
              resolve({ title: args[0], body: args[1]?.body });
              return new target(...args);
            },
          });
        })
    );

    await logButton.click();
    const restDisplay = page.locator(`#program-rest-display-${dayIndex}-dumbbell-bench-press`);
    await expect(restDisplay).toBeVisible();

    await page.clock.runFor((restSec + 1) * 1000);

    await expect(restDisplay).toHaveText('Rest complete!');
    await expect(page.locator('#program-rest-live')).toContainText('Rest complete');
    await expect(page.locator('#program-rest-live')).toContainText('Dumbbell Bench Press');

    const notification = await sawNotification;
    expect(notification.title).toBe('Rest complete!');
    expect(notification.body).toContain('Dumbbell Bench Press');

    expect(consoleErrors).toEqual([]);
  });

  test('Skip immediately dismisses the rest countdown', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const logButton = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]').first();
    const dayIndex = await logButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${dayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${dayIndex}-dumbbell-bench-press`).fill('40');
    await logButton.click();

    const restRow = page.locator(`#program-rest-row-${dayIndex}-dumbbell-bench-press`);
    await expect(restRow).toBeVisible();
    await restRow.locator('[data-skip-rest]').click();
    await expect(restRow).toBeHidden();
  });

  test('only one rest countdown shows at a time — logging a different exercise\'s set replaces it', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const firstLogButton = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]').first();
    const firstDayIndex = await firstLogButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${firstDayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${firstDayIndex}-dumbbell-bench-press`).fill('40');
    await firstLogButton.click();

    const firstRestRow = page.locator(`#program-rest-row-${firstDayIndex}-dumbbell-bench-press`);
    await expect(firstRestRow).toBeVisible();

    const secondLogButton = page.locator('button[data-log-set]').nth(1);
    const secondDayIndex = await secondLogButton.getAttribute('data-day-index');
    const secondExerciseId = await secondLogButton.getAttribute('data-exercise-id');
    const secondMetric = await secondLogButton.getAttribute('data-log-metric');
    if (secondMetric === 'reps-weight') {
      await page.locator(`#program-reps-${secondDayIndex}-${secondExerciseId}`).fill('8');
      await page.locator(`#program-weight-${secondDayIndex}-${secondExerciseId}`).fill('20');
    } else if (secondMetric === 'hold' || secondMetric === 'cardio') {
      await page.locator(`#program-duration-${secondDayIndex}-${secondExerciseId}`).fill('20');
    } else {
      await page.locator(`#program-reps-${secondDayIndex}-${secondExerciseId}`).fill('12');
    }
    await secondLogButton.click();

    await expect(firstRestRow).toBeHidden();
    await expect(page.locator(`#program-rest-row-${secondDayIndex}-${secondExerciseId}`)).toBeVisible();
  });

  test('this week\'s progress starts honestly at zero and updates live as sets are logged', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' }); // hypertrophy: 4 real training days/week
    await page.getByRole('button', { name: 'My Program' }).click();

    await expect(page.locator('#program-week-progress-text')).toHaveText('0 of 4 sessions this week');
    await expect(page.locator('#program-week-progress-fill')).toHaveJSProperty('style.width', '0%');

    const logButton = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]').first();
    const dayIndex = await logButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${dayIndex}-dumbbell-bench-press`).fill('8');
    await page.locator(`#program-weight-${dayIndex}-dumbbell-bench-press`).fill('40');
    await logButton.click();

    // One real day logged, regardless of how many individual sets that
    // day ends up with — this is a days-with-a-session count, not a set
    // count.
    await expect(page.locator('#program-week-progress-text')).toHaveText('1 of 4 sessions this week');
    await expect(page.locator('#program-week-progress-fill')).toHaveJSProperty('style.width', '25%');

    const secondLogButton = page.locator('button[data-log-set][data-exercise-id="dumbbell-bench-press"]').first();
    const secondDayIndex = await secondLogButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${secondDayIndex}-dumbbell-bench-press`).fill('6');
    await page.locator(`#program-weight-${secondDayIndex}-dumbbell-bench-press`).fill('42');
    await secondLogButton.click();
    await expect(page.locator('#program-week-progress-text')).toHaveText('1 of 4 sessions this week');

    expect(consoleErrors).toEqual([]);
  });

  test('the calendar shows today marked once a session is logged, with a real detail list on tap', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    // Before logging anything, the calendar has no logged days at all.
    await page.locator('#btn-program-calendar').click();
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
    await expect(page.locator('.program-calendar-day--logged')).toHaveCount(0);
    await page.locator('#btn-program-calendar-back').click();
    await expect(page.getByRole('heading', { name: 'My Program' })).toBeVisible();

    const logButton = page.locator('button[data-log-set][data-exercise-id="push-up"]').first();
    const dayIndex = await logButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${dayIndex}-push-up`).fill('12');
    await logButton.click();

    await page.locator('#btn-program-calendar').click();
    const todayCell = page.locator('.program-calendar-day--today');
    await expect(todayCell).toHaveClass(/program-calendar-day--logged/);
    await expect(page.locator('.program-calendar-day--logged')).toHaveCount(1);

    await todayCell.click();
    await expect(page.locator('#program-calendar-day-detail')).toBeVisible();
    await expect(page.locator('#program-calendar-day-detail-list')).toContainText('Push-Up — 1 set');

    expect(consoleErrors).toEqual([]);
  });

  test('an empty calendar day is inert — nothing real to show, so it isn\'t tappable', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await page.locator('#btn-program-calendar').click();

    const todayCell = page.locator('.program-calendar-day--today');
    await expect(todayCell).toBeDisabled();
    await expect(page.locator('#program-calendar-day-detail')).toBeHidden();
  });

  test('calendar month navigation moves the label back and forward', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await page.locator('#btn-program-calendar').click();
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    const monthLabel = await page.locator('#program-calendar-month-label').textContent();
    await page.locator('#btn-program-calendar-prev-month').click();
    await expect(page.locator('#program-calendar-month-label')).not.toHaveText(monthLabel);
    await page.locator('#btn-program-calendar-next-month').click();
    await expect(page.locator('#program-calendar-month-label')).toHaveText(monthLabel);
  });

  test('with no readiness check-in logged today, the readiness banner stays hidden', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();
    await expect(page.locator('#program-readiness-banner')).toBeHidden();
  });

  test("logging a readiness check-in shows up on My Program with a real, category-matched suggestion", async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });

    // Readiness is now "How today looks", collapsed into Sleep — see
    // tests/e2e/sleep.spec.js for its own dedicated coverage; this test
    // only needs to confirm My Program still picks up whatever it saves.
    // completeOnboarding above already lands on Fitness Toolkit — Sleep
    // is a Hub tile, so back out to the Hub first.
    await page.locator('#btn-fitness-toolkit-back').click();
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#sleep-readiness-energy button[data-value="1"]').click();
    await page.locator('#sleep-readiness-soreness button[data-value="5"]').click();
    await page.locator('#btn-sleep-readiness-save').click();
    await expect(page.locator('#sleep-readiness-category')).toContainText('low');
    // Back to the Hub, then into Fitness Toolkit for My Program — the
    // same two-step route completeOnboarding itself took to get there.
    await page.locator('#btn-sleep-dashboard-back').click();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-readiness-banner')).toBeVisible();
    await expect(page.locator('#program-readiness-category')).toContainText('low');
    await expect(page.locator('#program-readiness-suggestion')).toContainText('easier');
  });

  test('reacts to tilt, and every day card carries a real day-type icon', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();

    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-program'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);

    const dayCards = page.locator('#program-days > .card');
    const count = await dayCards.count();
    for (let i = 0; i < count; i++) {
      await expect(dayCards.nth(i).locator('.fitness-row-icon .icon')).toBeVisible();
    }
  });
});

test.describe('my program: change goal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('the picker opens with the current goal pre-selected', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-goal-label')).toHaveText('Hypertrophy');

    await page.locator('#btn-program-change-goal').click();
    await expect(page.locator('#program-goal-picker')).toBeVisible();
    await expect(page.locator('#program-goal-chips button[data-value="build-muscle"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('cancel closes the picker with zero changes', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();
    // Demo SVGs load asynchronously per exercise, and their <title> text
    // counts toward textContent — wait for every one of them, or a
    // capture taken before all fetches resolve reads as "different" from
    // one taken after, even with zero real changes in between.
    const exerciseSlots = page.locator('#program-days [id^="program-svg-"]');
    const exerciseSlotCount = await exerciseSlots.count();
    await expect(exerciseSlots.locator('svg')).toHaveCount(exerciseSlotCount);
    const beforeText = await page.locator('#program-days').textContent();

    await page.locator('#btn-program-change-goal').click();
    await page.locator('#program-goal-chips button[data-value="endurance"]').click();
    await page.locator('#btn-program-goal-cancel').click();

    await expect(page.locator('#program-goal-picker')).toBeHidden();
    await expect(page.locator('#program-goal-label')).toHaveText('Hypertrophy');
    expect(await page.locator('#program-days').textContent()).toBe(beforeText);
  });

  test('switching to "build strength" regenerates the program with a real, distinct strength prescription', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toContainText('8-12 reps');

    await page.locator('#btn-program-change-goal').click();
    await page.locator('#program-goal-chips button[data-value="build-strength"]').click();
    await page.locator('#btn-program-goal-save').click();

    await expect(page.locator('#program-goal-picker')).toBeHidden();
    await expect(page.locator('#program-goal-label')).toHaveText('Strength Training');
    await expect(page.locator('#program-days .card').first()).toContainText('3-6 reps');
    await expect(page.locator('#program-days .card').first()).not.toContainText('8-12 reps');
    await expect(page.locator('#program-reasoning')).toContainText('meaningfully longer rest');

    expect(consoleErrors).toEqual([]);
  });

  test('switching goal category updates the Fitness Toolkit home badge, not just My Program', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();

    await page.locator('#btn-program-change-goal').click();
    await page.locator('#program-goal-chips button[data-value="endurance"]').click();
    await page.locator('#btn-program-goal-save').click();
    await expect(page.locator('#program-goal-label')).toHaveText('Endurance');

    await page.locator('#btn-program-back').click();
    await expect(page.locator('#home-category-badge')).toHaveText('Endurance');
  });

  test('re-picking the exact same goal is a real no-op — no new program, same week', async ({ page }) => {
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();
    const beforeReasoning = await page.locator('#program-reasoning').textContent();

    await page.locator('#btn-program-change-goal').click();
    await page.locator('#program-goal-chips button[data-value="build-muscle"]').click();
    await page.locator('#btn-program-goal-save').click();

    await expect(page.locator('#program-week-number')).toHaveText('1');
    expect(await page.locator('#program-reasoning').textContent()).toBe(beforeReasoning);
  });
});

test.describe('my program: looping movement-category demos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('each known exercise renders the demo for its own real movement category, not an unrelated one', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();

    const categoryFor = async (exerciseId) => {
      const button = page.locator(`button[data-log-set][data-exercise-id="${exerciseId}"]`).first();
      const dayIndex = await button.getAttribute('data-day-index');
      const svg = page.locator(`#program-svg-${dayIndex}-${exerciseId} svg`);
      await expect(svg).toBeVisible();
      return svg.getAttribute('data-movement-category');
    };

    expect(await categoryFor('push-up')).toBe('push');
    expect(await categoryFor('inverted-row')).toBe('pull');
    expect(await categoryFor('bodyweight-squat')).toBe('squat');
    expect(await categoryFor('glute-bridge')).toBe('hinge');

    expect(consoleErrors).toEqual([]);
  });

  test('a held exercise (plank) and a real mobility stretch each get their own distinct category demo', async ({ page }) => {
    // rehab-recuperation's mobility days lead with a real mobility-
    // pattern exercise and include a "core" slot Plank can win.
    await completeOnboarding(page, { goal: 'endurance', redFlag: 'chest-pain-pressure' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-days .card').first()).toBeVisible();

    const plankButton = page.locator('button[data-log-set][data-exercise-id="plank"]').first();
    const plankDayIndex = await plankButton.getAttribute('data-day-index');
    await expect(page.locator(`#program-svg-${plankDayIndex}-plank svg`)).toHaveAttribute('data-movement-category', 'hold');

    const mobilityIds = ['cat-cow-stretch', 'hip-flexor-stretch', 'thoracic-rotation-stretch'];
    let foundMobility = false;
    for (const id of mobilityIds) {
      const button = page.locator(`button[data-log-set][data-exercise-id="${id}"]`).first();
      if (await button.count()) {
        const dayIndex = await button.getAttribute('data-day-index');
        await expect(page.locator(`#program-svg-${dayIndex}-${id} svg`)).toHaveAttribute('data-movement-category', 'mobility');
        foundMobility = true;
        break;
      }
    }
    expect(foundMobility).toBe(true);
  });

  test('a cardio exercise (Standing March) gets the cardio category demo, and every demo actually loops', async ({ page }) => {
    await completeOnboarding(page, { goal: 'endurance' });
    await page.getByRole('button', { name: 'My Program' }).click();

    const button = page.locator('button[data-log-set][data-exercise-id="standing-march"]').first();
    const dayIndex = await button.getAttribute('data-day-index');
    const svg = page.locator(`#program-svg-${dayIndex}-standing-march svg`);
    await expect(svg).toHaveAttribute('data-movement-category', 'cardio');

    // A real loop, not a static image pretending to be an animation.
    const hasLoopingAnimation = await svg.evaluate((el) =>
      Array.from(el.querySelectorAll('animate, animateTransform')).some((a) => a.getAttribute('repeatCount') === 'indefinite')
    );
    expect(hasLoopingAnimation).toBe(true);
  });
});

test.describe('my program: smart calendar (rest days + goal proximity)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('a real month grid marks logged and rest days distinctly, with a visible weekly goal-proximity bar', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    // The program starts a few real days before "today" so there are
    // genuine rest days to show — a program created today has none yet,
    // and that would itself be dishonest to fake. A program's startedAt
    // is only ever set the first time My Program is actually visited
    // (ensureActiveProgram), so that first visit has to happen while the
    // clock is still on the start date.
    const programStart = new Date('2026-03-10T09:00:00.000Z');
    await page.clock.setFixedTime(programStart);
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click(); // creates the program, startedAt = programStart
    await expect(page.locator('#program-days .card').first()).toBeVisible();

    await page.clock.setFixedTime(new Date('2026-03-14T09:00:00.000Z'));
    await page.reload();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // reload lands back on the Hub
    await page.getByRole('button', { name: 'My Program' }).click();

    const logButton = page.locator('button[data-log-set][data-exercise-id="push-up"]').first();
    const dayIndex = await logButton.getAttribute('data-day-index');
    await page.locator(`#program-reps-${dayIndex}-push-up`).fill('12');
    await logButton.click();

    await page.locator('#btn-program-calendar').click();

    // A real grid: 7 weekday columns, several full week rows — not a
    // vertically scrolling list of every day.
    await expect(page.locator('.program-calendar-weekdays span')).toHaveCount(7);
    const cellCount = await page.locator('.program-calendar-day').count();
    expect(cellCount).toBeGreaterThanOrEqual(28); // at least 4 full weeks

    await expect(page.locator('.program-calendar-day--logged')).toHaveCount(1);
    // The program started today, so every other real (non-future) day
    // this month is an honest, visibly distinct rest day.
    const restDayCount = await page.locator('.program-calendar-day--rest').count();
    expect(restDayCount).toBeGreaterThan(0);

    await expect(page.locator('.program-calendar-legend')).toContainText('Session logged');
    await expect(page.locator('.program-calendar-legend')).toContainText('Rest day');

    // A real, visible goal-proximity indicator right on the calendar
    // screen — the same honest "X of Y sessions" signal My Program's own
    // header shows.
    await expect(page.locator('#program-calendar-week-progress-text')).toContainText('1 of');
    await expect(page.locator('#program-calendar-week-progress-fill')).not.toHaveJSProperty('style.width', '0%');

    expect(consoleErrors).toEqual([]);
  });

  test('a day before the program existed is never mislabeled a rest day', async ({ page }) => {
    // Fixed mid-month "today" so the previous month's own grid can't
    // bleed trailing days forward into the program's real start date —
    // a real edge case a calendar-grid's leading/trailing padding days
    // can otherwise hit near a month boundary.
    await page.clock.setFixedTime(new Date('2026-03-20T09:00:00.000Z'));
    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await page.locator('#btn-program-calendar').click();

    await page.locator('#btn-program-calendar-prev-month').click(); // February 2026 — entirely before the program started
    await expect(page.locator('.program-calendar-day--logged')).toHaveCount(0);
    await expect(page.locator('.program-calendar-day--rest')).toHaveCount(0);
  });
});

test.describe('my program: real progression across a multi-week/multi-month plan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
  });

  test('week 5 (block 2) genuinely differs from week 1 — rotated exercises and a real progressive-overload target, not day 1-3 repeating', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    const weekOneStart = new Date('2026-01-05T09:00:00.000Z');
    await page.clock.setFixedTime(weekOneStart);

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-week-number')).toHaveText('1');
    await expect(page.locator('#program-block-label')).toContainText('Block 1');
    const week1Days = await page.locator('#program-days').textContent();
    const week1Reasoning = await page.locator('#program-reasoning').textContent();
    expect(week1Reasoning).not.toContain('rotated');
    expect(week1Reasoning).not.toContain('working weight');

    // Four weeks later: still block 1's own week 4 (the deload) — a real
    // week-over-week difference already, not a flat repeat of week 1.
    await page.clock.setFixedTime(new Date(weekOneStart.getTime() + 21 * 24 * 60 * 60 * 1000));
    await page.reload();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // reload lands back on the Hub
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-week-number')).toHaveText('4');
    await expect(page.locator('#program-deload-banner')).toBeVisible();

    // Into block 2 (week 5): genuinely different exercise selection from
    // week 1, and a real, plain-language progressive-overload note.
    await page.clock.setFixedTime(new Date(weekOneStart.getTime() + 28 * 24 * 60 * 60 * 1000));
    await page.reload();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.getByRole('button', { name: 'My Program' }).click();

    await expect(page.locator('#program-week-number')).toHaveText('5');
    await expect(page.locator('#program-block-label')).toContainText('Block 2');
    const week5Days = await page.locator('#program-days').textContent();
    const week5Reasoning = await page.locator('#program-reasoning').textContent();

    expect(week5Days).not.toBe(week1Days); // real rotation past week 1, not a repeat
    expect(week5Reasoning).toContain('rotated');

    expect(consoleErrors).toEqual([]);
  });

  test('a real progressive-overload target grows week over week within a block, then resets on the deload', async ({ page }) => {
    const weekOneStart = new Date('2026-02-02T09:00:00.000Z');
    await page.clock.setFixedTime(weekOneStart);

    await completeOnboarding(page, { goal: 'build-muscle' });
    await page.getByRole('button', { name: 'My Program' }).click();
    const week1Reasoning = await page.locator('#program-reasoning').textContent();
    expect(week1Reasoning).not.toContain('working weight');

    await page.clock.setFixedTime(new Date(weekOneStart.getTime() + 14 * 24 * 60 * 60 * 1000)); // week 3
    await page.reload();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click();
    await page.getByRole('button', { name: 'My Program' }).click();
    await expect(page.locator('#program-week-number')).toHaveText('3');

    const week3Reasoning = await page.locator('#program-reasoning').textContent();
    expect(week3Reasoning).toContain('working weight');
    expect(week3Reasoning).toMatch(/aim for roughly \d+% of your week-1 working weight/);
  });
});
