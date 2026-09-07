import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { renderTrendChart } from '../../lib/trend-chart.js';
import { bucketDailyPoints, formatBucketAxisLabel, formatBucketDetailLabel, timeRangeBounds, timeRangeDescription, } from '../../lib/time-range.js';
import { setVitalsTileSubtitle } from '../hub/hub-view.js';
import { connectBloodPressureMonitor, isBluetoothAvailable as isBleAvailableForBp } from './ble-blood-pressure.js';
import { connectPulseOximeterMonitor, isBluetoothAvailable as isBleAvailableForSpo2 } from './ble-pulse-oximeter.js';
import { connectBodyTemperatureMonitor, isBluetoothAvailable as isBleAvailableForTemp } from './ble-body-temperature.js';
import { BP_SOURCE, listRecentBloodPressureSamples, recordBloodPressureSample, } from '../../db/repositories/blood-pressure.js';
import { SPO2_SOURCE, listRecentSpo2Samples, recordSpo2Sample } from '../../db/repositories/spo2.js';
import { BODY_TEMPERATURE_SOURCE, listRecentBodyTemperatureSamples, recordBodyTemperatureSample, } from '../../db/repositories/body-temperature.js';
import { categorizeBloodPressure, describeBloodPressureCategory, isConcerningBloodPressure } from './blood-pressure-category.js';
import { categorizeSpo2, describeSpo2Category, isConcerningSpo2 } from './spo2-category.js';
import { categorizeBodyTemperature, describeBodyTemperatureCategory, isConcerningBodyTemperature, } from './body-temperature-category.js';
import { groupBloodPressureByDate, summarizeBloodPressureTrend } from './blood-pressure-trend.js';
import { groupSpo2ByDate, summarizeSpo2Trend } from './spo2-trend.js';
import { summarizeBodyTemperatureTrend } from './body-temperature-trend.js';
import { calculateVitalsStreak } from './vitals-streak.js';
import { celsiusToFahrenheit, fahrenheitToCelsius } from '../../lib/units.js';
// Manual entry is in °F (the everyday unit for a home/oral thermometer in
// the US) but every reading is stored in Celsius — the same unit the BLE
// thermometer path normalizes to (see ble-body-temperature.js) and the
// same unit categorizeBodyTemperature's real reference table is written
// against — so there's exactly one unit conversion in this whole feature,
// at manual-entry time, not one hiding in every later read.
// Bounds: below the lowest recorded/plausible home-thermometer reading a
// person could genuinely have (real severe hypothermia can read into the
// 80s°F) up to a very high fever most home thermometers still display —
// wide enough not to reject a real emergency reading, narrow enough to
// catch a fat-fingered entry.
const MIN_TEMP_F = 85;
const MAX_TEMP_F = 110;
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`vitals-view: missing #${id}`);
    return el;
}
// The range charts' own state — see steps-view.ts's identical comment;
// same reasoning, same default range. Two independent ranges since blood
// pressure and SpO2 are two unrelated metrics with their own history.
let bpRange = 'W';
let spo2Range = 'W';
let cachedBpSamples = [];
let cachedSpo2Samples = [];
const SOURCE_LABEL = { manual: 'Manual', ble: 'BLE Device' };
function formatDateLabel(recordedAt) {
    return new Date(recordedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
function toDateOnly(recordedAt) {
    return recordedAt.slice(0, 10);
}
function isWithinLastNDays(recordedAt, days, today) {
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const startDate = start.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);
    const date = toDateOnly(recordedAt);
    return date >= startDate && date <= endDate;
}
export function initVitalsFeature() {
    const vitalsScreen = byId('screen-vitals');
    const tilt = attachTilt(vitalsScreen);
    vitalsScreen.addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
    // ---------- blood pressure: manual entry ----------
    byId('btn-vitals-bp-save').addEventListener('click', async () => {
        const systolic = Number(byId('vitals-bp-systolic').value);
        const diastolic = Number(byId('vitals-bp-diastolic').value);
        const valid = systolic >= 60 && systolic <= 260 && diastolic >= 30 && diastolic <= 150 && systolic > diastolic;
        byId('err-vitals-bp').hidden = valid;
        if (!valid)
            return;
        await recordBloodPressureSample({ systolic, diastolic, source: BP_SOURCE.MANUAL });
        byId('vitals-bp-systolic').value = '';
        byId('vitals-bp-diastolic').value = '';
        await refreshAll();
    });
    // ---------- blood pressure: BLE ----------
    if (isBleAvailableForBp()) {
        byId('vitals-bp-ble-status').textContent = 'A compatible cuff can connect over Bluetooth.';
    }
    else {
        byId('vitals-bp-ble-status').textContent =
            "Bluetooth isn't supported in this browser — use a manual entry instead.";
        byId('btn-vitals-bp-ble-connect').disabled = true;
    }
    byId('btn-vitals-bp-ble-connect').addEventListener('click', async () => {
        byId('vitals-bp-ble-status').textContent = 'Connecting…';
        await connectBloodPressureMonitor({
            onReading: async (reading) => {
                if (reading.systolic == null || reading.diastolic == null) {
                    byId('vitals-bp-ble-status').textContent = "Connected, but that reading wasn't valid — try again.";
                    return;
                }
                byId('vitals-bp-ble-status').textContent =
                    `Connected — last reading ${reading.systolic}/${reading.diastolic} ${reading.unit}`;
                await recordBloodPressureSample({
                    systolic: reading.systolic,
                    diastolic: reading.diastolic,
                    pulseRate: reading.pulseRate,
                    source: BP_SOURCE.BLE,
                });
                await refreshAll();
            },
            onDisconnect: () => {
                byId('vitals-bp-ble-status').textContent = 'Disconnected.';
            },
            onError: (error) => {
                byId('vitals-bp-ble-status').textContent = error.message;
            },
        });
    });
    // ---------- SpO2: manual entry ----------
    byId('btn-vitals-spo2-save').addEventListener('click', async () => {
        const spo2 = Number(byId('vitals-spo2-percent').value);
        const valid = spo2 >= 50 && spo2 <= 100;
        byId('err-vitals-spo2').hidden = valid;
        if (!valid)
            return;
        await recordSpo2Sample({ spo2, source: SPO2_SOURCE.MANUAL });
        byId('vitals-spo2-percent').value = '';
        await refreshAll();
    });
    // ---------- SpO2: BLE ----------
    if (isBleAvailableForSpo2()) {
        byId('vitals-spo2-ble-status').textContent = 'A compatible pulse oximeter can connect over Bluetooth.';
    }
    else {
        byId('vitals-spo2-ble-status').textContent =
            "Bluetooth isn't supported in this browser — use a manual entry instead.";
        byId('btn-vitals-spo2-ble-connect').disabled = true;
    }
    byId('btn-vitals-spo2-ble-connect').addEventListener('click', async () => {
        byId('vitals-spo2-ble-status').textContent = 'Connecting…';
        await connectPulseOximeterMonitor({
            onReading: async (reading) => {
                if (reading.spo2 == null) {
                    byId('vitals-spo2-ble-status').textContent = "Connected, but that reading wasn't valid — try again.";
                    return;
                }
                byId('vitals-spo2-ble-status').textContent = `Connected — last reading ${reading.spo2}%`;
                await recordSpo2Sample({ spo2: reading.spo2, pulseRate: reading.pulseRate, source: SPO2_SOURCE.BLE });
                await refreshAll();
            },
            onDisconnect: () => {
                byId('vitals-spo2-ble-status').textContent = 'Disconnected.';
            },
            onError: (error) => {
                byId('vitals-spo2-ble-status').textContent = error.message;
            },
        });
    });
    // ---------- body temperature: manual entry ----------
    byId('btn-vitals-temp-save').addEventListener('click', async () => {
        const fahrenheit = Number(byId('vitals-temp-fahrenheit').value);
        const valid = fahrenheit >= MIN_TEMP_F && fahrenheit <= MAX_TEMP_F;
        byId('err-vitals-temp').hidden = valid;
        if (!valid)
            return;
        await recordBodyTemperatureSample({
            temperatureCelsius: fahrenheitToCelsius(fahrenheit),
            source: BODY_TEMPERATURE_SOURCE.MANUAL,
        });
        byId('vitals-temp-fahrenheit').value = '';
        await refreshAll();
    });
    // ---------- body temperature: BLE ----------
    if (isBleAvailableForTemp()) {
        byId('vitals-temp-ble-status').textContent = 'A compatible thermometer can connect over Bluetooth.';
    }
    else {
        byId('vitals-temp-ble-status').textContent =
            "Bluetooth isn't supported in this browser — use a manual entry instead.";
        byId('btn-vitals-temp-ble-connect').disabled = true;
    }
    byId('btn-vitals-temp-ble-connect').addEventListener('click', async () => {
        byId('vitals-temp-ble-status').textContent = 'Connecting…';
        await connectBodyTemperatureMonitor({
            onReading: async (reading) => {
                if (reading.temperatureCelsius == null) {
                    byId('vitals-temp-ble-status').textContent = "Connected, but that reading wasn't valid — try again.";
                    return;
                }
                byId('vitals-temp-ble-status').textContent =
                    `Connected — last reading ${celsiusToFahrenheit(reading.temperatureCelsius).toFixed(1)}°F`;
                await recordBodyTemperatureSample({
                    temperatureCelsius: reading.temperatureCelsius,
                    source: BODY_TEMPERATURE_SOURCE.BLE,
                });
                await refreshAll();
            },
            onDisconnect: () => {
                byId('vitals-temp-ble-status').textContent = 'Disconnected.';
            },
            onError: (error) => {
                byId('vitals-temp-ble-status').textContent = error.message;
            },
        });
    });
    byId('btn-home-vitals').addEventListener('click', () => {
        void refreshAll();
    });
    // ---------- trend ranges ----------
    initChipGroup(byId('vitals-bp-range'), {
        initial: bpRange,
        onChange: (value) => {
            bpRange = value;
            renderBpRangeChart(cachedBpSamples);
        },
    });
    initChipGroup(byId('vitals-spo2-range'), {
        initial: spo2Range,
        onChange: (value) => {
            spo2Range = value;
            renderSpo2RangeChart(cachedSpo2Samples);
        },
    });
    void refreshAll();
}
async function refreshAll() {
    // A wide fetch — the same "everything, filtered client-side" shape
    // Steps'/Hydration's own listAll*Entries() take — so the range charts
    // below can genuinely cover a full year, not just whatever a small
    // fixed limit happened to include.
    const [bpSamples, spo2Samples, tempSamples] = await Promise.all([
        listRecentBloodPressureSamples(500),
        listRecentSpo2Samples(500),
        listRecentBodyTemperatureSamples(500),
    ]);
    cachedBpSamples = bpSamples;
    cachedSpo2Samples = spo2Samples;
    renderBpTrend(bpSamples);
    renderBpRangeChart(bpSamples);
    renderBpHistory(bpSamples.slice(0, 20));
    renderSpo2Trend(spo2Samples);
    renderSpo2RangeChart(spo2Samples);
    renderSpo2History(spo2Samples.slice(0, 20));
    renderTempTrend(tempSamples);
    renderTempHistory(tempSamples.slice(0, 20));
    renderStats(bpSamples, spo2Samples, tempSamples);
}
function renderStats(bpSamples, spo2Samples, tempSamples) {
    const today = new Date();
    const allDates = [...bpSamples, ...spo2Samples, ...tempSamples].map((s) => toDateOnly(s.recordedAt));
    const streak = calculateVitalsStreak(allDates);
    const weekCount = bpSamples.filter((s) => isWithinLastNDays(s.recordedAt, 7, today)).length +
        spo2Samples.filter((s) => isWithinLastNDays(s.recordedAt, 7, today)).length +
        tempSamples.filter((s) => isWithinLastNDays(s.recordedAt, 7, today)).length;
    animateCountUp(byId('vitals-stat-streak'), streak);
    animateCountUp(byId('vitals-stat-week-count'), weekCount);
    setVitalsTileSubtitle(streak > 0 ? `${streak}-day streak` : 'Blood pressure & oxygen');
}
function renderBpTrend(samplesNewestFirst) {
    const trend = summarizeBloodPressureTrend(samplesNewestFirst);
    const card = byId('vitals-bp-trend-card');
    card.hidden = !trend;
    if (!trend)
        return;
    byId('vitals-bp-trend-latest').textContent = `${trend.latestSystolic} / ${trend.latestDiastolic} mmHg`;
    const category = categorizeBloodPressure(trend.latestSystolic, trend.latestDiastolic);
    const badge = byId('vitals-bp-trend-category');
    badge.textContent = describeBloodPressureCategory(category);
    badge.classList.toggle('is-concerning', isConcerningBloodPressure(category));
    byId('vitals-bp-trend-count').textContent = String(trend.sampleCount);
    byId('vitals-bp-trend-avg').textContent = `${trend.avgSystolic}/${trend.avgDiastolic} mmHg`;
    byId('vitals-bp-trend-range').textContent =
        trend.minSystolic === trend.maxSystolic ? `${trend.minSystolic} mmHg` : `${trend.minSystolic}–${trend.maxSystolic} mmHg`;
    const deltaEl = byId('vitals-bp-trend-delta');
    if (trend.deltaSystolicFromPrevious == null) {
        deltaEl.textContent = '';
    }
    else if (trend.deltaSystolicFromPrevious === 0) {
        deltaEl.textContent = 'same as last';
    }
    else {
        const sign = trend.deltaSystolicFromPrevious > 0 ? '+' : '';
        deltaEl.textContent = `${sign}${trend.deltaSystolicFromPrevious} systolic since last`;
    }
}
/** A real D/W/M/6M/Y systolic trend (see js/lib/time-range.js), replacing
 *  what used to be a fixed "last 10 raw readings" sparkline — several
 *  readings on the same day now average into one real daily point
 *  (groupBloodPressureByDate) instead of every reading getting its own
 *  bar regardless of how long ago it was. Only systolic gets its own bar
 *  height — the same "one hue, one series" rule every other trend-chart.js
 *  screen already follows — but each tooltip still names the real
 *  diastolic average alongside it. */
function renderBpRangeChart(samplesNewestFirst) {
    const bounds = timeRangeBounds(bpRange, new Date().toISOString().slice(0, 10));
    byId('vitals-bp-range-copy').textContent = timeRangeDescription(bpRange);
    const inRange = samplesNewestFirst.filter((s) => {
        const date = s.recordedAt.slice(0, 10);
        return date >= bounds.start && date <= bounds.end;
    });
    const dailyAverages = groupBloodPressureByDate(inRange);
    const systolicDaily = [...dailyAverages.entries()].map(([date, v]) => ({ date, value: v.avgSystolic }));
    const diastolicDaily = [...dailyAverages.entries()].map(([date, v]) => ({ date, value: v.avgDiastolic }));
    const systolicBuckets = bucketDailyPoints(systolicDaily, bounds.bucket);
    const diastolicByKey = new Map(bucketDailyPoints(diastolicDaily, bounds.bucket).map((b) => [b.key, b.value]));
    const isBucketed = bounds.bucket !== 'day';
    renderTrendChart(byId('vitals-bp-range-chart'), {
        points: systolicBuckets.map((bucket) => {
            const diastolic = diastolicByKey.get(bucket.key) ?? bucket.value;
            return {
                key: bucket.key,
                value: bucket.value,
                axisLabel: formatBucketAxisLabel(bucket.key, bounds.bucket),
                tooltipValue: `${Math.round(bucket.value)}/${Math.round(diastolic)} mmHg${isBucketed ? '/day avg' : ''}`,
                tooltipDetail: formatBucketDetailLabel(bucket.key, bounds.bucket),
            };
        }),
        accentVar: '--vitals-accent',
        emptyMessage: 'Log a reading on a second day to start a trend.',
    });
}
function renderSpo2Trend(samplesNewestFirst) {
    const trend = summarizeSpo2Trend(samplesNewestFirst);
    const card = byId('vitals-spo2-trend-card');
    card.hidden = !trend;
    if (!trend)
        return;
    animateCountUp(byId('vitals-spo2-trend-latest'), trend.latest, { formatter: (n) => `${Math.round(n)}%` });
    const category = categorizeSpo2(trend.latest);
    const badge = byId('vitals-spo2-trend-category');
    badge.textContent = describeSpo2Category(category);
    badge.classList.toggle('is-concerning', isConcerningSpo2(category));
    byId('vitals-spo2-trend-count').textContent = String(trend.sampleCount);
    byId('vitals-spo2-trend-avg').textContent = `${trend.average}%`;
    byId('vitals-spo2-trend-range').textContent = trend.min === trend.max ? `${trend.min}%` : `${trend.min}–${trend.max}%`;
    const deltaEl = byId('vitals-spo2-trend-delta');
    if (trend.deltaFromPrevious == null) {
        deltaEl.textContent = '';
    }
    else if (trend.deltaFromPrevious === 0) {
        deltaEl.textContent = 'same as last';
    }
    else {
        const sign = trend.deltaFromPrevious > 0 ? '+' : '';
        deltaEl.textContent = `${sign}${trend.deltaFromPrevious}% since last`;
    }
}
/** A real D/W/M/6M/Y SpO2 trend (see js/lib/time-range.js), replacing
 *  what used to be a fixed "last 10 raw readings" sparkline — same
 *  reasoning as renderBpRangeChart. */
function renderSpo2RangeChart(samplesNewestFirst) {
    const bounds = timeRangeBounds(spo2Range, new Date().toISOString().slice(0, 10));
    byId('vitals-spo2-range-copy').textContent = timeRangeDescription(spo2Range);
    const inRange = samplesNewestFirst.filter((s) => {
        const date = s.recordedAt.slice(0, 10);
        return date >= bounds.start && date <= bounds.end;
    });
    const dailyAverages = groupSpo2ByDate(inRange);
    const daily = [...dailyAverages.entries()].map(([date, spo2]) => ({ date, value: spo2 }));
    const buckets = bucketDailyPoints(daily, bounds.bucket);
    const isBucketed = bounds.bucket !== 'day';
    renderTrendChart(byId('vitals-spo2-range-chart'), {
        points: buckets.map((bucket) => ({
            key: bucket.key,
            value: bucket.value,
            axisLabel: formatBucketAxisLabel(bucket.key, bounds.bucket),
            tooltipValue: `${Math.round(bucket.value)}%${isBucketed ? '/day avg' : ''}`,
            tooltipDetail: formatBucketDetailLabel(bucket.key, bounds.bucket),
        })),
        accentVar: '--vitals-accent',
        emptyMessage: 'Log a reading on a second day to start a trend.',
    });
}
function renderBpHistory(samples) {
    const list = byId('vitals-bp-history-list');
    if (samples.length === 0) {
        list.innerHTML = '<p class="muted center-text">No readings yet.</p>';
        return;
    }
    list.innerHTML = samples
        .map((sample) => {
        const category = categorizeBloodPressure(sample.systolic, sample.diastolic);
        return `
        <div class="vitals-card row-between tilt-card tilt-enter">
          <span>
            <strong>${sample.systolic}/${sample.diastolic} mmHg</strong>
            <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${SOURCE_LABEL[sample.source]} · ${formatDateLabel(sample.recordedAt)}</p>
          </span>
          <span class="vitals-category-badge${isConcerningBloodPressure(category) ? ' is-concerning' : ''}">${describeBloodPressureCategory(category)}</span>
        </div>
      `;
    })
        .join('');
}
function renderSpo2History(samples) {
    const list = byId('vitals-spo2-history-list');
    if (samples.length === 0) {
        list.innerHTML = '<p class="muted center-text">No readings yet.</p>';
        return;
    }
    list.innerHTML = samples
        .map((sample) => {
        const category = categorizeSpo2(sample.spo2);
        return `
        <div class="vitals-card row-between tilt-card tilt-enter">
          <span>
            <strong>${sample.spo2}%</strong>
            <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${SOURCE_LABEL[sample.source]} · ${formatDateLabel(sample.recordedAt)}</p>
          </span>
          <span class="vitals-category-badge${isConcerningSpo2(category) ? ' is-concerning' : ''}">${describeSpo2Category(category)}</span>
        </div>
      `;
    })
        .join('');
}
function formatTempF(celsius) {
    return `${celsiusToFahrenheit(celsius).toFixed(1)}°F`;
}
function renderTempTrend(samplesNewestFirst) {
    const trend = summarizeBodyTemperatureTrend(samplesNewestFirst);
    const card = byId('vitals-temp-trend-card');
    card.hidden = !trend;
    if (!trend)
        return;
    animateCountUp(byId('vitals-temp-trend-latest'), celsiusToFahrenheit(trend.latest), {
        formatter: (n) => `${n.toFixed(1)}°F`,
    });
    const category = categorizeBodyTemperature(trend.latest);
    const badge = byId('vitals-temp-trend-category');
    badge.textContent = describeBodyTemperatureCategory(category);
    badge.classList.toggle('is-concerning', isConcerningBodyTemperature(category));
    byId('vitals-temp-trend-count').textContent = String(trend.sampleCount);
    byId('vitals-temp-trend-avg').textContent = formatTempF(trend.average);
    byId('vitals-temp-trend-range').textContent =
        trend.min === trend.max ? formatTempF(trend.min) : `${formatTempF(trend.min)}–${formatTempF(trend.max)}`;
    const deltaEl = byId('vitals-temp-trend-delta');
    if (trend.deltaFromPrevious == null) {
        deltaEl.textContent = '';
    }
    else if (trend.deltaFromPrevious === 0) {
        deltaEl.textContent = 'same as last';
    }
    else {
        // Convert the delta itself (a Celsius *difference*, not an absolute
        // temperature) with the same linear factor as celsiusToFahrenheit's
        // slope — a straight delta * 9/5 is correct here, only the +32 offset
        // (which only applies to absolute temperatures) is intentionally
        // skipped so a delta of 0 stays 0 either way.
        const deltaF = (trend.deltaFromPrevious * 9) / 5;
        const sign = deltaF > 0 ? '+' : '';
        deltaEl.textContent = `${sign}${deltaF.toFixed(1)}°F since last`;
    }
    const maxValue = Math.max(...trend.sparklineOldestFirst);
    byId('vitals-temp-trend-bars').innerHTML = trend.sparklineOldestFirst
        .map((value, i) => {
        const isLatest = i === trend.sparklineOldestFirst.length - 1;
        const heightPct = Math.max(8, Math.round((value / maxValue) * 100));
        return `<div class="vitals-trend-bar-col"><div class="vitals-trend-bar${isLatest ? ' is-latest' : ''}" style="height:${heightPct}%" title="${formatTempF(value)}"></div></div>`;
    })
        .join('');
}
function renderTempHistory(samples) {
    const list = byId('vitals-temp-history-list');
    if (samples.length === 0) {
        list.innerHTML = '<p class="muted center-text">No readings yet.</p>';
        return;
    }
    list.innerHTML = samples
        .map((sample) => {
        const category = categorizeBodyTemperature(sample.temperatureCelsius);
        return `
        <div class="vitals-card row-between tilt-card tilt-enter">
          <span>
            <strong>${formatTempF(sample.temperatureCelsius)}</strong>
            <p class="muted" style="font-size:var(--fs-sm); margin-top:2px;">${SOURCE_LABEL[sample.source]} · ${formatDateLabel(sample.recordedAt)}</p>
          </span>
          <span class="vitals-category-badge${isConcerningBodyTemperature(category) ? ' is-concerning' : ''}">${describeBodyTemperatureCategory(category)}</span>
        </div>
      `;
    })
        .join('');
}
//# sourceMappingURL=vitals-view.js.map