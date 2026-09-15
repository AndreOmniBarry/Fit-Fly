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
}

/** Picks one option per question by its point value (1-7, unique within
 *  each question's chip-group) — the six values in CHRONOTYPE_QUESTIONS
 *  order: riseTime, sleepReadyTime, peakSharpnessWindow,
 *  morningGrogginess, eveningWindDown, selfAnchor. */
async function answerChronotype(page, [rise, sleepReady, peak, groggy, windDown, anchor]) {
  await page.locator(`#chronotype-q-riseTime button[data-value="${rise}"]`).click();
  await page.locator(`#chronotype-q-sleepReadyTime button[data-value="${sleepReady}"]`).click();
  await page.locator(`#chronotype-q-peakSharpnessWindow button[data-value="${peak}"]`).click();
  await page.locator(`#chronotype-q-morningGrogginess button[data-value="${groggy}"]`).click();
  await page.locator(`#chronotype-q-eveningWindDown button[data-value="${windDown}"]`).click();
  await page.locator(`#chronotype-q-selfAnchor button[data-value="${anchor}"]`).click();
}

test.describe('chronotype', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#btn-sleep-insights').click();
  });

  test('the Insights "Chronotype" card starts empty and opens the quiz', async ({ page }) => {
    await expect(page.locator('#chronotype-entry-empty')).toBeVisible();
    await expect(page.locator('#chronotype-entry-result')).toBeHidden();

    await page.locator('#btn-chronotype-open').click();
    await expect(page.getByRole('heading', { name: 'Chronotype' })).toBeVisible();
    await expect(page.locator('#chronotype-form')).toBeVisible();
    await expect(page.locator('#chronotype-result-card')).toBeHidden();
    // All 6 questions render generically from CHRONOTYPE_QUESTIONS.
    await expect(page.locator('#chronotype-questions .chip-group')).toHaveCount(6);
  });

  test('submitting without answering every question shows a real validation error', async ({ page }) => {
    await page.locator('#btn-chronotype-open').click();
    await page.locator('#btn-chronotype-submit').click();
    await expect(page.locator('#err-chronotype')).toBeVisible();
    await expect(page.locator('#chronotype-result-card')).toBeHidden();
  });

  test('taking the quiz with a real set of answers reaches a real result with the right category', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-chronotype-open').click();
    // A strong early-bird answer set: total = 7+7+6+7+6+7 = 40 -> Definite morning type.
    await answerChronotype(page, [7, 7, 6, 7, 6, 7]);
    await page.locator('#btn-chronotype-submit').click();

    await expect(page.locator('#chronotype-result-card')).toBeVisible();
    await expect(page.locator('#chronotype-form')).toBeHidden();
    await expect(page.locator('#chronotype-result-category')).toHaveText('Definite morning type');
    await expect(page.locator('#chronotype-result-score')).toHaveText('Score: 40 out of 42');
    await expect(page.locator('#chronotype-result-description')).not.toHaveText('');

    // Back in Insights, the entry card reflects the just-saved result.
    await page.locator('#btn-chronotype-back').click();
    await expect(page.locator('#chronotype-entry-result')).toBeVisible();
    await expect(page.locator('#chronotype-entry-empty')).toBeHidden();
    await expect(page.locator('#chronotype-entry-category')).toHaveText('Definite morning type');

    expect(consoleErrors).toEqual([]);
  });

  test('a saved result survives reload and reopens as the result, not the form', async ({ page }) => {
    await page.locator('#btn-chronotype-open').click();
    await answerChronotype(page, [7, 7, 6, 7, 6, 7]);
    await page.locator('#btn-chronotype-submit').click();
    await expect(page.locator('#chronotype-result-card')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Sleep' }).click();
    await page.locator('#btn-sleep-insights').click();
    await expect(page.locator('#chronotype-entry-category')).toHaveText('Definite morning type');

    await page.locator('#btn-chronotype-open').click();
    await expect(page.locator('#chronotype-result-card')).toBeVisible();
    await expect(page.locator('#chronotype-form')).toBeHidden();
    await expect(page.locator('#chronotype-result-category')).toHaveText('Definite morning type');
  });

  test('a retake updates the shown result', async ({ page }) => {
    await page.locator('#btn-chronotype-open').click();
    // First pass: a strong early-bird set -> Definite morning type.
    await answerChronotype(page, [7, 7, 6, 7, 6, 7]);
    await page.locator('#btn-chronotype-submit').click();
    await expect(page.locator('#chronotype-result-category')).toHaveText('Definite morning type');

    // Retake with a strong night-owl set -> Definite evening type.
    await page.locator('#btn-chronotype-retake').click();
    await expect(page.locator('#chronotype-form')).toBeVisible();
    await expect(page.locator('#chronotype-result-card')).toBeHidden();

    await answerChronotype(page, [2, 1, 2, 3, 1, 1]);
    await page.locator('#btn-chronotype-submit').click();

    await expect(page.locator('#chronotype-result-card')).toBeVisible();
    await expect(page.locator('#chronotype-result-category')).toHaveText('Definite evening type');
    await expect(page.locator('#chronotype-result-score')).toHaveText('Score: 10 out of 42');

    // The Insights entry card picks up the retaken result too, not the
    // stale first one.
    await page.locator('#btn-chronotype-back').click();
    await expect(page.locator('#chronotype-entry-category')).toHaveText('Definite evening type');
  });

  test('the honesty note about provisional cutoffs is real, visible copy', async ({ page }) => {
    await page.locator('#btn-chronotype-open').click();
    await expect(page.locator('#screen-chronotype')).toContainText('provisional statistical starting point');
    await expect(page.locator('#screen-chronotype')).toContainText('not a reproduction of any published instrument');
  });
});
