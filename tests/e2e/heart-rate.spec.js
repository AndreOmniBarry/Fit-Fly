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

test.describe('heart rate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-heart-rate').click();
  });

  test('a manual entry is saved as MEASURED and shows up in recent readings', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await expect(page.getByRole('heading', { name: 'Heart Rate' })).toBeVisible();
    await page.locator('#hr-manual-bpm').fill('68');
    await page.locator('#btn-hr-manual-save').click();

    const entry = page.locator('#hr-history-list .card').first();
    await expect(entry).toContainText('68 bpm');
    await expect(entry).toContainText('Manual');
    await expect(entry.locator('.data-badge.measured')).toHaveText('measured');
    await expect(entry.locator('.fitness-row-icon .icon')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('logging readings surfaces a real trend — latest, average, range, and a delta from the one before it', async ({
    page,
  }) => {
    await expect(page.locator('#hr-trend-card')).toBeHidden(); // nothing logged yet

    await page.locator('#hr-manual-bpm').fill('60');
    await page.locator('#btn-hr-manual-save').click();
    await expect(page.locator('#hr-trend-card')).toBeVisible();
    await expect(page.locator('#hr-trend-latest')).toHaveText('60 bpm');
    await expect(page.locator('#hr-trend-avg')).toHaveText('60 bpm');
    await expect(page.locator('#hr-trend-delta')).toHaveText(''); // nothing prior to compare against
    // the hero number itself says measured, not just the history row below it
    await expect(page.locator('#hr-trend-latest-badge')).toHaveText('measured');

    await page.locator('#hr-manual-bpm').fill('80');
    await page.locator('#btn-hr-manual-save').click();
    await expect(page.locator('#hr-trend-latest')).toHaveText('80 bpm');
    await expect(page.locator('#hr-trend-avg')).toHaveText('70 bpm');
    await expect(page.locator('#hr-trend-range')).toHaveText('60–80 bpm');
    await expect(page.locator('#hr-trend-delta')).toHaveText('+20 bpm since last');
  });

  test('the trend range defaults to a real 7-day week, with no "D" chip (same-day readings average into one point)', async ({
    page,
  }) => {
    await expect(page.locator('#hr-range button[data-value="W"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hr-range-copy')).toHaveText('Last 7 days.');
    await expect(page.locator('#hr-range button[data-value="D"]')).toHaveCount(0);
  });

  test('two readings logged today (the same real day) average into one chart point, not two', async ({ page }) => {
    await page.locator('#hr-manual-bpm').fill('60');
    await page.locator('#btn-hr-manual-save').click();
    await page.locator('#hr-manual-bpm').fill('80');
    await page.locator('#btn-hr-manual-save').click();

    await expect(page.locator('#hr-range-chart')).toContainText('Log a reading on a second day');
  });

  test('readings on two real days each get a real chart bar, tap shows the exact daily average', async ({ page }) => {
    // heart-rate.js's own recordHeartRateSample always stamps "now" —
    // inserting straight into the table (same shape it writes) is the
    // only way to plant a genuinely backdated reading for this test.
    await page.evaluate(async () => {
      const { getDb } = await import('/js/db/client.js');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await getDb().heartRateSamples.add({ bpm: 60, source: 'manual', confidence: null, sessionId: null, recordedAt: yesterday.toISOString() });
    });
    await page.locator('#hr-manual-bpm').fill('80');
    await page.locator('#btn-hr-manual-save').click();

    const bars = page.locator('#hr-range-chart .trend-chart-bar');
    await expect(bars).toHaveCount(2);
    await bars.nth(1).click();
    await expect(bars.nth(1).locator('.trend-chart-tooltip')).toContainText('80 bpm');
  });

  test('switching the trend range updates the explanatory copy for every real range', async ({ page }) => {
    const ranges = [
      ['M', 'Last 30 days.'],
      ['6M', 'Last 6 months, grouped by week.'],
      ['Y', 'Last 12 months, grouped by month.'],
      ['W', 'Last 7 days.'],
    ];
    for (const [value, copy] of ranges) {
      await page.locator(`#hr-range button[data-value="${value}"]`).click();
      await expect(page.locator('#hr-range-copy')).toHaveText(copy);
      await expect(page.locator(`#hr-range button[data-value="${value}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('shows which sensing method produced the latest reading, and a resting/elevated/high zone', async ({
    page,
  }) => {
    // A calm 60bpm reads as "resting" for any real adult age, so this
    // doesn't depend on onboarding's exact fixture birthdate.
    await page.locator('#hr-manual-bpm').fill('60');
    await page.locator('#btn-hr-manual-save').click();
    await expect(page.locator('#hr-trend-source-badge')).toHaveText('Manual');
    await expect(page.locator('#hr-trend-zone-badge')).toBeVisible();
    await expect(page.locator('#hr-trend-zone-badge')).toHaveText('Resting zone');
    await expect(page.locator('#hr-trend-zone-badge')).not.toHaveClass(/is-concerning/);

    // A very high reading (still inside manual entry's valid 30-250
    // range) reads as "high" regardless of age, and gets flagged.
    await page.locator('#hr-manual-bpm').fill('220');
    await page.locator('#btn-hr-manual-save').click();
    await expect(page.locator('#hr-trend-zone-badge')).toHaveText('High zone');
    await expect(page.locator('#hr-trend-zone-badge')).toHaveClass(/is-concerning/);
  });

  test('the "Latest reading" hero number switches from measured to estimated as a camera reading becomes the newest one', async ({
    page,
  }) => {
    await page.locator('#hr-manual-bpm').fill('65');
    await page.locator('#btn-hr-manual-save').click();
    await expect(page.locator('#hr-trend-latest-badge')).toHaveClass(/measured/);
    await expect(page.locator('#hr-trend-latest-badge')).toHaveText('measured');

    await page.locator('#btn-hr-camera-start').click();
    await expect(page.locator('#btn-hr-camera-start')).toBeEnabled({ timeout: 25000 });

    const resultVisible = await page.locator('#hr-camera-result').isVisible();
    if (resultVisible) {
      // a successful camera reading is now the newest sample — the hero
      // card's own badge has to switch with it, not keep saying measured
      await expect(page.locator('#hr-trend-latest-badge')).toHaveClass(/estimated/);
      await expect(page.locator('#hr-trend-latest-badge')).toContainText('estimated');
      await expect(page.locator('#hr-trend-source-badge')).toHaveText('Camera');
    } else {
      // the fake device's synthetic pattern didn't produce a usable
      // reading — the manual entry is still honestly the latest one
      await expect(page.locator('#hr-trend-latest-badge')).toHaveText('measured');
    }
  });

  test('reacts to tilt, same spatial language as the rest of the Fitness Toolkit', async ({ page }) => {
    await page.mouse.move(400, 60);
    await page.waitForTimeout(500);
    const tilt = await page.evaluate(() => {
      const style = getComputedStyle(document.getElementById('screen-heart-rate'));
      return { rx: style.getPropertyValue('--tilt-rx'), ry: style.getPropertyValue('--tilt-ry') };
    });
    expect(parseFloat(tilt.rx)).not.toBe(0);
    expect(parseFloat(tilt.ry)).not.toBe(0);
  });

  test('manual entry rejects an out-of-range value', async ({ page }) => {
    await page.locator('#hr-manual-bpm').fill('999');
    await page.locator('#btn-hr-manual-save').click();
    await expect(page.locator('#err-hr-manual')).toBeVisible();
  });

  test('recent readings is empty before anything is recorded', async ({ page }) => {
    await expect(page.locator('#hr-history-list')).toContainText('No readings yet');
  });

  test('Bluetooth section degrades gracefully when unsupported', async ({ page }) => {
    const bluetoothSupported = await page.evaluate(() => 'bluetooth' in navigator);
    if (bluetoothSupported) {
      await expect(page.locator('#btn-hr-ble-connect')).toBeEnabled();
    } else {
      await expect(page.locator('#hr-ble-status')).toContainText('use the camera or a manual entry instead');
      await expect(page.locator('#btn-hr-ble-connect')).toBeDisabled();
    }
  });

  test('shows live signal-quality feedback during capture, not just a pass/fail after 15 seconds', async ({ page }) => {
    test.setTimeout(30000);
    await page.locator('#btn-hr-camera-start').click();
    await expect(page.locator('#hr-camera-progress')).toBeVisible();
    await expect(page.locator('#hr-camera-quality-text')).toHaveText('Getting a baseline reading…');

    // The fake video device's synthetic pattern is enough real per-frame
    // variation for the live quality assessor to move off its initial
    // placeholder well before the 15s capture finishes.
    await expect(page.locator('#hr-camera-quality-text')).not.toHaveText('Getting a baseline reading…', {
      timeout: 10000,
    });

    await expect(page.locator('#btn-hr-camera-start')).toBeEnabled({ timeout: 20000 });
  });

  test('a camera reading runs the full capture pipeline against the fake device', async ({ page }) => {
    test.setTimeout(30000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.locator('#btn-hr-camera-start').click();
    await expect(page.locator('#hr-camera-progress')).toBeVisible();
    await expect(page.locator('#btn-hr-camera-start')).toBeDisabled();

    // The fake video device is a synthetic test pattern, not a real pulse,
    // so this can legitimately end in either a result or a "couldn't get a
    // clear reading" message — the point of this test is that the whole
    // getUserMedia -> canvas-sampling -> signal-processing pipeline runs
    // to completion without throwing, either way.
    await expect(page.locator('#btn-hr-camera-start')).toBeEnabled({ timeout: 25000 });
    await expect(page.locator('#hr-camera-progress')).toBeHidden();

    const resultVisible = await page.locator('#hr-camera-result').isVisible();
    const errorVisible = await page.locator('#hr-camera-error').isVisible();
    expect(resultVisible || errorVisible).toBe(true);

    expect(consoleErrors).toEqual([]);
  });
});

// A fake Web Bluetooth adapter — real Chromium here has no actual
// Bluetooth hardware/peer to connect to, and this repo's own Playwright
// config carries no fake-Bluetooth-adapter flags (only the fake
// getUserMedia device flags the camera-PPG tests above rely on) — so the
// full connect -> GATT service -> characteristic -> notification chain
// ble-heart-rate.js's connectHeartRateMonitor drives is otherwise
// untestable end-to-end. This mocks just enough of the real Web
// Bluetooth surface (device/gatt/service/characteristic, each a real
// EventTarget-shaped object) to drive that exact chain for real, and
// encodes/dispatches real Bluetooth SIG Heart Rate Measurement bytes
// (see ble-heart-rate.js's own parseHeartRateMeasurement) rather than
// calling any app internals directly.
async function installFakeBluetoothHrStrap(page) {
  await page.addInitScript(() => {
    class FakeEventTarget {
      constructor() {
        this._listeners = new Map();
      }
      addEventListener(type, fn) {
        if (!this._listeners.has(type)) this._listeners.set(type, []);
        this._listeners.get(type).push(fn);
      }
      dispatch(type, event) {
        for (const fn of this._listeners.get(type) ?? []) fn(event);
      }
    }

    // Real Bluetooth SIG Heart Rate Measurement characteristic encoding
    // — flag bit 4 (RR-interval present), each RR-interval in real
    // 1/1024-second units, exactly what parseHeartRateMeasurement decodes.
    function buildHrmDataView(bpm, rrIntervalsMs) {
      const flags = rrIntervalsMs.length > 0 ? 0x10 : 0x00;
      const bytes = [flags, bpm];
      for (const rr of rrIntervalsMs) {
        const raw = Math.round((rr / 1000) * 1024);
        bytes.push(raw & 0xff, (raw >> 8) & 0xff);
      }
      return new DataView(new Uint8Array(bytes).buffer);
    }

    class FakeCharacteristic extends FakeEventTarget {
      async startNotifications() {
        return this;
      }
      notify(bpm, rrIntervalsMs = []) {
        this.dispatch('characteristicvaluechanged', { target: { value: buildHrmDataView(bpm, rrIntervalsMs) } });
      }
    }

    class FakeDevice extends FakeEventTarget {
      constructor() {
        super();
        const characteristic = new FakeCharacteristic();
        const service = { getCharacteristic: async () => characteristic };
        const server = { getPrimaryService: async () => service };
        this.characteristic = characteristic;
        this.gatt = {
          connect: async () => server,
          disconnect: () => this.dispatch('gattserverdisconnected', {}),
        };
      }
    }

    const fakeDevice = new FakeDevice();
    window.__fakeHrDevice = fakeDevice;
    // Real navigator.bluetooth shape is just requestDevice() resolving to
    // a real BluetoothDevice — isBluetoothAvailable() only checks
    // `'bluetooth' in navigator`, so this alone is enough for the app's
    // own feature-detect to treat BLE as available.
    navigator.bluetooth = { requestDevice: async () => fakeDevice };
  });
}

test.describe('heart rate: BLE HRV persistence', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBluetoothHrStrap(page);
    await page.goto('/');
    await clearAppDb(page);
    await page.reload();
    await completeOnboarding(page);
    await page.locator('#btn-home-heart-rate').click();
  });

  test('a live BLE HRV reading is computed on-screen and persisted once the session disconnects', async ({ page }) => {
    await expect(page.locator('#btn-hr-ble-connect')).toBeEnabled();
    await page.locator('#btn-hr-ble-connect').click();
    await expect(page.locator('#hr-ble-status')).toContainText('Connecting');

    // Wait for connectHeartRateMonitor's own real async GATT chain (fake,
    // but still a real await chain) to finish registering its
    // notification listener before sending any — same real ordering a
    // genuine strap connection would have.
    await page.waitForFunction(
      () => (window.__fakeHrDevice.characteristic._listeners.get('characteristicvaluechanged') ?? []).length > 0
    );

    // 12 successive real RR-intervals, alternating 800/850ms — the exact
    // known case hrv.test.js's own unit test already hand-verifies
    // RMSSD=50 for (encoding/decoding through the real 1/1024s BLE
    // format rounds to the same 50ms here too).
    await page.evaluate(async () => {
      for (let i = 0; i < 12; i++) {
        window.__fakeHrDevice.characteristic.notify(70, [i % 2 === 0 ? 800 : 850]);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    });

    await expect(page.locator('#hr-ble-hrv')).toBeVisible();
    await expect(page.locator('#hr-ble-hrv-value')).toHaveText('50 ms');

    // Every per-tick bpm reading was already persisted with no rmssdMs —
    // confirms the live number isn't written per-tick, only the one real
    // summary reading below, on disconnect.
    const beforeDisconnect = await page.evaluate(async () => {
      const { getDb } = await import('/js/db/client.js');
      const samples = await getDb().heartRateSamples.toArray();
      return { total: samples.length, withRmssd: samples.filter((s) => s.rmssdMs != null).length };
    });
    expect(beforeDisconnect.total).toBe(12);
    expect(beforeDisconnect.withRmssd).toBe(0);

    await page.evaluate(() => window.__fakeHrDevice.gatt.disconnect());
    await expect(page.locator('#hr-ble-status')).toHaveText('Disconnected.');
    await expect(page.locator('#hr-ble-hrv')).toBeHidden();

    const afterDisconnect = await page.evaluate(async () => {
      const { getDb } = await import('/js/db/client.js');
      const samples = await getDb().heartRateSamples.toArray();
      return samples.filter((s) => s.rmssdMs != null);
    });
    expect(afterDisconnect).toHaveLength(1); // exactly one real summary reading for the whole session, not one per tick
    expect(afterDisconnect[0].rmssdMs).toBe(50);
    expect(afterDisconnect[0].source).toBe('ble');
    expect(afterDisconnect[0].bpm).toBe(70);
  });

  test('a session that never accumulates enough real RR-intervals persists no rmssdMs at all — never fabricated', async ({
    page,
  }) => {
    await page.locator('#btn-hr-ble-connect').click();
    await page.waitForFunction(
      () => (window.__fakeHrDevice.characteristic._listeners.get('characteristicvaluechanged') ?? []).length > 0
    );

    // Plain bpm-only notifications — no RR-intervals at all, same as most
    // real optical wrist straps (see ble-heart-rate.js's own doc comment).
    await page.evaluate(async () => {
      window.__fakeHrDevice.characteristic.notify(65, []);
      await new Promise((resolve) => setTimeout(resolve, 10));
      window.__fakeHrDevice.characteristic.notify(66, []);
    });
    await expect(page.locator('#hr-ble-status')).toContainText('66 bpm');
    await expect(page.locator('#hr-ble-hrv')).toBeHidden();

    await page.evaluate(() => window.__fakeHrDevice.gatt.disconnect());
    await expect(page.locator('#hr-ble-status')).toHaveText('Disconnected.');

    const withRmssd = await page.evaluate(async () => {
      const { getDb } = await import('/js/db/client.js');
      const samples = await getDb().heartRateSamples.toArray();
      return samples.filter((s) => s.rmssdMs != null);
    });
    expect(withRmssd).toHaveLength(0);
  });
});
