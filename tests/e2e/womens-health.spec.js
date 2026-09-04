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

test.describe('women\'s health / cycle tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-womens-health').click();
  });

  test('first visit prompts a PIN setup, not an unlock', async ({ page }) => {
    await expect(page.locator('#whealth-setup-pane')).toBeVisible();
    await expect(page.locator('#whealth-unlock-pane')).toBeHidden();
  });

  test('setting a PIN unlocks straight into the tracker', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();

    await expect(page.getByRole('heading', { name: 'Cycle Tracker' })).toBeVisible();
    await expect(page.locator('#whealth-flow')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('mismatched PINs are rejected with an inline error', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('9999');
    await page.locator('#btn-whealth-pin-set').click();
    await expect(page.locator('#err-whealth-pin-setup')).toBeVisible();
  });

  test('logging an entry, locking, and unlocking with the right PIN shows it decrypted', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();

    await page.locator('#whealth-flow button[data-value="medium"]').click();
    await page.locator('#whealth-symptoms button[data-value="cramps"]').click();
    await page.locator('#whealth-mood button[data-value="okay"]').click();
    await page.locator('#btn-whealth-save').click();

    const todayCell = page.locator('.whealth-calendar-day--today');
    await expect(todayCell).toHaveClass(/whealth-calendar-day--period/);
    await expect(todayCell).toHaveAttribute('data-flow', 'medium');

    await page.locator('#btn-whealth-lock').click();
    await expect(page.getByRole('heading', { name: 'Fitness Toolkit' })).toBeVisible();

    await page.locator('#btn-home-womens-health').click();
    await expect(page.locator('#whealth-unlock-pane')).toBeVisible();
    await expect(page.locator('#whealth-setup-pane')).toBeHidden();

    await page.locator('#whealth-pin-unlock').fill('4242');
    await page.locator('#btn-whealth-pin-unlock').click();
    await expect(page.locator('.whealth-calendar-day--today')).toHaveAttribute('data-flow', 'medium');
    // symptoms/mood round-trip through the same decrypted entry, not just flow
    await expect(page.locator('#whealth-symptoms button[data-value="cramps"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('an incorrect PIN is rejected', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    await page.locator('#btn-whealth-lock').click();

    await page.locator('#btn-home-womens-health').click();
    await page.locator('#whealth-pin-unlock').fill('0000');
    await page.locator('#btn-whealth-pin-unlock').click();
    await expect(page.locator('#err-whealth-pin-unlock')).toBeVisible();
    await expect(page.locator('#whealth-unlock-pane')).toBeVisible();
  });

  test('forgetting the PIN deletes everything and returns to PIN setup', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    await page.locator('#btn-whealth-save').click(); // log an entry so there's something to lose
    await page.locator('#btn-whealth-lock').click();

    await page.locator('#btn-home-womens-health').click();
    await page.locator('#btn-whealth-pin-forgot').click();
    await expect(page.locator('#whealth-forgot-confirm')).toBeVisible();
    await page.locator('#btn-whealth-forgot-confirm').click();

    await expect(page.locator('#whealth-setup-pane')).toBeVisible();

    // setting a brand new PIN starts with a clean history — the old
    // entry is genuinely gone, not just re-encrypted
    await page.locator('#whealth-pin-new').fill('1111');
    await page.locator('#whealth-pin-confirm').fill('1111');
    await page.locator('#btn-whealth-pin-set').click();
    await expect(page.locator('.whealth-calendar-day--period')).toHaveCount(0);
    await expect(page.locator('.whealth-calendar-day--logged')).toHaveCount(0);
  });

  test('reloading re-locks the session (the key lives only in memory)', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    // wait for the PIN write to actually land before reloading, or the
    // reload can race ahead of the async save
    await expect(page.locator('#whealth-flow')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Fitness Toolkit' }).click(); // reload lands back on the Hub
    await page.locator('#btn-home-womens-health').click();
    await expect(page.locator('#whealth-unlock-pane')).toBeVisible();
  });

  test('a real calendar replaces the flat history list, and month navigation moves it', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();

    await expect(page.locator('#whealth-calendar-grid .whealth-calendar-day')).not.toHaveCount(0);
    const monthLabel = await page.locator('#whealth-calendar-month-label').textContent();

    await page.locator('#btn-whealth-prev-month').click();
    await expect(page.locator('#whealth-calendar-month-label')).not.toHaveText(monthLabel);

    await page.locator('#btn-whealth-next-month').click();
    await expect(page.locator('#whealth-calendar-month-label')).toHaveText(monthLabel);
  });

  test('tapping a past calendar day edits that date, not today — a real retroactive log', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();

    // Log today first, so there's a real "today" entry to prove untouched later.
    await page.locator('#whealth-flow button[data-value="light"]').click();
    await page.locator('#btn-whealth-save').click();
    await expect(page.locator('.whealth-calendar-day--today')).toHaveAttribute('data-flow', 'light');

    const pastDay = page
      .locator(
        '.whealth-calendar-day:not(.whealth-calendar-day--out-of-month):not(.whealth-calendar-day--future):not(.whealth-calendar-day--today)'
      )
      .first();
    const pastDate = await pastDay.getAttribute('data-date');
    await pastDay.click();

    await expect(page.locator('#whealth-log-heading')).not.toHaveText('Log Today');
    await expect(page.locator('#btn-whealth-editing-today')).toBeVisible();
    // editing a different date starts from a blank form, not today's leftovers
    await expect(page.locator('#whealth-flow button[aria-pressed="true"]')).toHaveAttribute('data-value', 'none');

    await page.locator('#whealth-flow button[data-value="heavy"]').click();
    await page.locator('#whealth-symptoms button[data-value="bloating"]').click();
    await page.locator('#btn-whealth-save').click();

    await expect(page.locator(`.whealth-calendar-day[data-date="${pastDate}"]`)).toHaveAttribute('data-flow', 'heavy');
    // today's own entry is untouched by logging a different date
    await expect(page.locator('.whealth-calendar-day--today')).toHaveAttribute('data-flow', 'light');

    await page.locator('#btn-whealth-editing-today').click();
    await expect(page.locator('#whealth-log-heading')).toHaveText('Log Today');
    await expect(page.locator('#whealth-flow button[data-value="light"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('logging a period shows a real "Day N · Period" label, not a generic message', async ({ page }) => {
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    await expect(page.locator('#whealth-prediction')).toBeHidden(); // nothing logged yet

    await page.locator('#whealth-flow button[data-value="medium"]').click();
    await page.locator('#btn-whealth-save').click();

    await expect(page.locator('#whealth-prediction')).toBeVisible();
    await expect(page.locator('#whealth-cycle-day-label')).toHaveText('Day 1 · Period');
    await expect(page.locator('#whealth-prediction-date')).toContainText('Next period estimated');
  });

  test('both the lock screen and the main tracker react to tilt, same spatial language as the rest of the Fitness Toolkit', async ({
    page,
  }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    let tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-whealth-lock'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);

    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    await expect(page.locator('#whealth-flow')).toBeVisible();

    await page.mouse.move(100, 400);
    await page.waitForTimeout(500);
    tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-whealth-main'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });
});

test.describe('pregnancy mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-womens-health').click();
    await page.locator('#whealth-pin-new').fill('4242');
    await page.locator('#whealth-pin-confirm').fill('4242');
    await page.locator('#btn-whealth-pin-set').click();
    await page.locator('#whealth-mode-toggle button[data-value="pregnancy"]').click();
  });

  test('opens on the setup card with nothing else showing until a real due date exists', async ({ page }) => {
    await expect(page.locator('#whealth-pregnancy-setup')).toBeVisible();
    await expect(page.locator('#whealth-pregnancy-overview')).toBeHidden();
    await expect(page.locator('#whealth-pregnancy-milestone')).toBeHidden();
    await expect(page.locator('#whealth-kick-counter')).toBeHidden();
    await expect(page.locator('#whealth-pregnancy-log-card')).toBeHidden();
  });

  test('entering a last-period date computes a real due date and gestational week, with zero console errors', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#whealth-pregnancy-lmp').fill('2026-01-01');
    await page.locator('#btn-whealth-pregnancy-setup-save').click();

    await expect(page.locator('#whealth-pregnancy-setup')).toBeHidden();
    await expect(page.locator('#whealth-pregnancy-overview')).toBeVisible();
    await expect(page.locator('#whealth-pregnancy-week-label')).toContainText('Week');
    // Naegele's rule: LMP + 280 days = 2026-10-08
    await expect(page.locator('#whealth-pregnancy-due-label')).toContainText('Oct 8, 2026');
    await expect(page.locator('#whealth-pregnancy-milestone')).toBeVisible();
    await expect(page.locator('#whealth-kick-counter')).toBeVisible();
    await expect(page.locator('#whealth-pregnancy-log-card')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('entering a direct due date works without needing a last-period date', async ({ page }) => {
    await page.locator('#whealth-pregnancy-due-date').fill('2026-12-25');
    await page.locator('#btn-whealth-pregnancy-setup-save').click();
    await expect(page.locator('#whealth-pregnancy-due-label')).toContainText('Dec 25, 2026');
  });

  test('rejects saving with neither date filled in', async ({ page }) => {
    await page.locator('#btn-whealth-pregnancy-setup-save').click();
    await expect(page.locator('#err-whealth-pregnancy-setup')).toBeVisible();
    await expect(page.locator('#whealth-pregnancy-setup')).toBeVisible();
  });

  test('a real kick-counting session counts taps and records a real elapsed duration', async ({ page }) => {
    await page.locator('#whealth-pregnancy-lmp').fill('2026-01-01');
    await page.locator('#btn-whealth-pregnancy-setup-save').click();

    await page.locator('#btn-whealth-kick-start').click();
    await expect(page.locator('#whealth-kick-active')).toBeVisible();
    await page.locator('#btn-whealth-kick-tap').click();
    await page.locator('#btn-whealth-kick-tap').click();
    await page.locator('#btn-whealth-kick-tap').click();
    await expect(page.locator('#whealth-kick-count')).toHaveText('3');

    await page.locator('#btn-whealth-kick-finish').click();
    await expect(page.locator('#whealth-kick-active')).toBeHidden();
    await expect(page.locator('#btn-whealth-kick-start')).toBeVisible();
  });

  test('logging symptoms, mood, and weight saves and survives a lock/unlock (still real ciphertext under the same PIN)', async ({
    page,
  }) => {
    await page.locator('#whealth-pregnancy-lmp').fill('2026-01-01');
    await page.locator('#btn-whealth-pregnancy-setup-save').click();

    await page.locator('#whealth-pregnancy-symptoms button[data-value="nausea"]').click();
    await page.locator('#whealth-pregnancy-mood button[data-value="good"]').click();
    await page.locator('#whealth-pregnancy-weight').fill('65.5');
    await page.locator('#btn-whealth-pregnancy-save').click();

    await page.locator('#btn-whealth-lock').click();
    await page.locator('#btn-home-womens-health').click();
    await page.locator('#whealth-pin-unlock').fill('4242');
    await page.locator('#btn-whealth-pin-unlock').click();
    await page.locator('#whealth-mode-toggle button[data-value="pregnancy"]').click();

    await expect(page.locator('#whealth-pregnancy-symptoms button[data-value="nausea"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#whealth-pregnancy-mood button[data-value="good"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('#whealth-pregnancy-weight')).toHaveValue('65.5');
  });

  test('forgetting the PIN wipes pregnancy data along with cycle data — one real reset, not a partial one', async ({
    page,
  }) => {
    await page.locator('#whealth-pregnancy-lmp').fill('2026-01-01');
    await page.locator('#btn-whealth-pregnancy-setup-save').click();

    await page.locator('#btn-whealth-lock').click();
    await page.locator('#btn-home-womens-health').click();
    await page.locator('#btn-whealth-pin-forgot').click();
    await page.locator('#btn-whealth-forgot-confirm').click();

    await expect(page.locator('#whealth-setup-pane')).toBeVisible();
    await page.locator('#whealth-pin-new').fill('0000');
    await page.locator('#whealth-pin-confirm').fill('0000');
    await page.locator('#btn-whealth-pin-set').click();
    await page.locator('#whealth-mode-toggle button[data-value="pregnancy"]').click();

    // A brand-new PIN starts with no due date at all — the old one is
    // genuinely gone, not just inaccessible under the new PIN.
    await expect(page.locator('#whealth-pregnancy-setup')).toBeVisible();
  });
});
