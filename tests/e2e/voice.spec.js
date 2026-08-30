import { expect, test } from '@playwright/test';

// Headless Chromium's real SpeechRecognition needs a live mic + network
// round-trip and doesn't work in CI at all, so this installs a fake
// implementation before the page loads — the same spirit as the
// heart-rate suite's --use-fake-device-for-media-stream, just for
// speech instead of camera. Tests drive it via window.__voiceTestHooks.
async function installFakeSpeechRecognition(page) {
  await page.addInitScript(() => {
    class FakeSpeechRecognition extends EventTarget {
      constructor() {
        super();
        this.continuous = false;
        this.interimResults = false;
        this.lang = 'en-US';
        window.__fakeRecognitionInstances = window.__fakeRecognitionInstances || [];
        window.__fakeRecognitionInstances.push(this);
      }
      start() {
        this.dispatchEvent(new Event('start'));
      }
      stop() {
        this.dispatchEvent(new Event('end'));
      }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    window.__voiceTestHooks = {
      fireResult(transcript) {
        const instances = window.__fakeRecognitionInstances || [];
        const instance = instances[instances.length - 1];
        if (!instance) return;
        const event = new Event('result');
        event.results = [[{ transcript }]];
        instance.dispatchEvent(event);
      },
      fireError() {
        const instances = window.__fakeRecognitionInstances || [];
        instances[instances.length - 1]?.dispatchEvent(new Event('error'));
      },
    };
  });
}

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
}

test.describe('voice control (fake SpeechRecognition)', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeSpeechRecognition(page);
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
  });

  test('the mic button appears when SpeechRecognition is available', async ({ page }) => {
    await expect(page.locator('#btn-voice-toggle')).toBeVisible();
  });

  test('a recognized command navigates and shows feedback', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-voice-toggle').click();
    await expect(page.locator('#btn-voice-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#voice-feedback-wrap')).toContainText('Listening');

    await page.evaluate(() => window.__voiceTestHooks.fireResult('start timer'));

    await expect(page.getByRole('heading', { name: 'Rest Timer' })).toBeVisible();
    await expect(page.locator('#voice-feedback-wrap')).toContainText('rest timer');

    expect(consoleErrors).toEqual([]);
  });

  test('works from a screen other than home', async ({ page }) => {
    await page.locator('#btn-home-nutrition').click();
    await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();

    await page.locator('#btn-voice-toggle').click();
    await page.evaluate(() => window.__voiceTestHooks.fireResult('go home'));

    await expect(page.getByRole('heading', { name: 'Fit Fly' })).toBeVisible();
  });

  test('an unrecognized phrase shows feedback but does not navigate', async ({ page }) => {
    await page.locator('#btn-voice-toggle').click();
    await page.evaluate(() => window.__voiceTestHooks.fireResult('what is the weather today'));

    await expect(page.locator('#voice-feedback-wrap')).toContainText('no matching command');
    await expect(page.getByRole('heading', { name: 'Fit Fly' })).toBeVisible(); // stayed on home
  });

  test('a recognition error resets the listening state with feedback', async ({ page }) => {
    await page.locator('#btn-voice-toggle').click();
    await page.evaluate(() => window.__voiceTestHooks.fireError());

    await expect(page.locator('#btn-voice-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#voice-feedback-wrap')).toContainText("Didn't catch that");
  });

  test('a lenient phrase with filler words still matches', async ({ page }) => {
    await page.locator('#btn-voice-toggle').click();
    await page.evaluate(() => window.__voiceTestHooks.fireResult('hey log an activity please'));
    await expect(page.getByRole('heading', { name: 'Log Activity' })).toBeVisible();
  });
});

test.describe('voice control: unsupported browser', () => {
  test('the mic button stays hidden when SpeechRecognition is unavailable', async ({ page }) => {
    // Real Chromium exposes the webkitSpeechRecognition constructor even
    // headless (it just can't actually recognize anything without a mic
    // + network), so the unsupported path needs an explicit stub rather
    // than relying on this sandbox happening to lack it.
    await page.addInitScript(() => {
      // Assignment rather than `delete` — some browsers expose these as
      // non-configurable, where a strict-mode delete would throw.
      window.SpeechRecognition = undefined;
      window.webkitSpeechRecognition = undefined;
    });
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await expect(page.locator('#btn-voice-toggle')).toBeHidden();
  });
});
