// Sleep's screen controller: dashboard (quick-log form or today's score),
// Wind Down (breathing pacer + ambient sound, driven by the same shared
// engine Focus's own screen uses), and Insights.
import { showScreen } from '../../lib/router.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { getSleepLogForDate, listRecentSleepLogs, saveSleepLog } from '../../db/repositories/sleep-logs.js';
import { calculateSleepScore } from './sleep-score.js';
import { calculateSleepDebt, describeSleepDebt, DEFAULT_SLEEP_GOAL_MINUTES } from './sleep-debt.js';
import { buildWeeklyTrend, calculateLoggingStreak } from './sleep-trends.js';
import { calculateSleepFactorInsights } from './sleep-insights.js';
import { computeSleepLogTimes } from './sleep-duration.js';
import { formatClockTime, formatDurationHM, formatTimeInputValue } from './format.js';
import { setSleepTileScore, setSleepTileSubtitle } from '../hub/hub-view.js';
import { getFocusAudioEngine } from '../focus/audio-engine.js';
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`sleep-view: missing #${id}`);
    return el;
}
/** Same lookup, for the SVG elements this view touches — SVGElement
 *  doesn't extend HTMLElement, so it needs its own narrow helper. */
function bySvgId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`sleep-view: missing #${id}`);
    return el;
}
/** Local calendar date, YYYY-MM-DD — sleep is logged and displayed on the
 *  device's own clock, same convention as every other date-keyed store
 *  (readinessCheckins, cycleLogs, ...). */
function todayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function greetingForNow() {
    const hour = new Date().getHours();
    if (hour < 12)
        return 'Good morning';
    if (hour < 18)
        return 'Good afternoon';
    return 'Good evening';
}
function formatHeaderDate(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
const CATEGORY_LABEL = {
    poor: 'Poor sleep',
    fair: 'Fair sleep',
    good: 'Good sleep',
    great: 'Great sleep',
};
const RING_RADIUS = 86;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const WEEK_DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export function initSleepFeature() {
    let recentLogs = [];
    let todayLog = null;
    const qualityChips = initChipGroup(byId('sleep-log-quality'), { initial: null });
    function renderForm() {
        byId('sleep-log-form').hidden = false;
        byId('sleep-dashboard-result').hidden = true;
    }
    function renderWeekStrip() {
        const container = byId('sleep-week-bars');
        container.innerHTML = '';
        const trend = buildWeeklyTrend(recentLogs.slice(0, 7));
        if (trend.length === 0) {
            byId('sleep-week-avg').textContent = '';
            return;
        }
        const avgMinutes = Math.round(trend.reduce((sum, n) => sum + n.durationMinutes, 0) / trend.length);
        byId('sleep-week-avg').textContent = `avg ${formatDurationHM(avgMinutes)}`;
        const maxMinutes = Math.max(...trend.map((n) => n.durationMinutes), DEFAULT_SLEEP_GOAL_MINUTES);
        for (const night of trend) {
            const col = document.createElement('div');
            col.className = `sleep-week-bar-col${night.isBest ? ' is-best' : ''}`;
            const bar = document.createElement('div');
            bar.className = `sleep-week-bar${night.isBest ? ' is-best' : ''}`;
            bar.style.height = `${Math.max(8, Math.round((night.durationMinutes / maxMinutes) * 100))}%`;
            const label = document.createElement('span');
            label.className = 'day-label';
            const dayOfWeek = new Date(`${night.date}T00:00:00Z`).getUTCDay();
            label.textContent = WEEK_DAY_LETTERS[dayOfWeek] ?? '';
            col.append(bar, label);
            container.append(col);
        }
    }
    function renderResult(log) {
        byId('sleep-log-form').hidden = true;
        byId('sleep-dashboard-result').hidden = false;
        const score = calculateSleepScore({ durationMinutes: log.durationMinutes, quality: log.quality }, recentLogs);
        byId('sleep-score-value').textContent = String(score.score);
        byId('sleep-score-label').textContent = CATEGORY_LABEL[score.category];
        bySvgId('sleep-score-ring-fill').setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE * (1 - score.score / 100)));
        byId('sleep-score-description').textContent = score.reasoning[0] ?? '';
        byId('sleep-stat-bedtime').textContent = log.bedTime ? formatClockTime(log.bedTime) : '—';
        byId('sleep-stat-wake').textContent = log.wakeTime ? formatClockTime(log.wakeTime) : '—';
        byId('sleep-stat-duration').textContent = formatDurationHM(log.durationMinutes);
        renderWeekStrip();
        setSleepTileSubtitle(`${score.score} · ${CATEGORY_LABEL[score.category]} last night`);
        setSleepTileScore(score.score);
    }
    async function loadDashboard() {
        const date = todayDateString();
        byId('sleep-dashboard-date').textContent = formatHeaderDate(date);
        byId('sleep-dashboard-greeting').textContent = greetingForNow();
        const [today, recent] = await Promise.all([getSleepLogForDate(date), listRecentSleepLogs(14)]);
        todayLog = today ?? null;
        recentLogs = recent;
        if (todayLog)
            renderResult(todayLog);
        else
            renderForm();
    }
    function renderInsights() {
        const streak = calculateLoggingStreak(recentLogs);
        byId('sleep-insight-streak').textContent = String(streak);
        const debt = calculateSleepDebt(recentLogs.slice(0, 7));
        byId('sleep-insight-debt').textContent = debt.nightsConsidered === 0 ? '—' : formatDurationHM(debt.debtMinutes);
        byId('sleep-insight-debt').title = describeSleepDebt(debt);
        renderInsightChart();
        renderInsightFactors();
        byId('sleep-insight-empty').hidden = recentLogs.length > 0;
    }
    function renderInsightChart() {
        const svg = bySvgId('sleep-insight-chart');
        const labelsRow = byId('sleep-insight-chart-labels');
        svg.innerHTML = '';
        labelsRow.innerHTML = '';
        const nights = [...recentLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
        byId('sleep-insight-chart-empty').hidden = nights.length >= 2;
        if (nights.length < 2)
            return;
        const scores = nights.map((log) => {
            const window = recentLogs.filter((l) => l.date <= log.date).slice(0, 14);
            return calculateSleepScore({ durationMinutes: log.durationMinutes, quality: log.quality }, window).score;
        });
        const w = 320;
        const h = 120;
        const stepX = w / (nights.length - 1);
        const points = scores.map((score, i) => `${i * stepX},${h - (score / 100) * h}`).join(' ');
        const areaPoints = `${points} ${w},${h} 0,${h}`;
        const ns = 'http://www.w3.org/2000/svg';
        const defs = document.createElementNS(ns, 'defs');
        defs.innerHTML =
            '<linearGradient id="sleepInsightLineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--sleep-accent)"/><stop offset="100%" stop-color="var(--sleep-accent-2)"/></linearGradient>' +
                '<linearGradient id="sleepInsightAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--sleep-accent)" stop-opacity="0.35"/><stop offset="100%" stop-color="var(--sleep-accent)" stop-opacity="0"/></linearGradient>';
        svg.append(defs);
        const area = document.createElementNS(ns, 'polyline');
        area.setAttribute('points', areaPoints);
        area.setAttribute('fill', 'url(#sleepInsightAreaGrad)');
        area.setAttribute('stroke', 'none');
        area.setAttribute('opacity', '0.5');
        svg.append(area);
        const line = document.createElementNS(ns, 'polyline');
        line.setAttribute('points', points);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', 'url(#sleepInsightLineGrad)');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-linejoin', 'round');
        svg.append(line);
        const first = document.createElement('span');
        first.textContent = nights[0]?.date ?? '';
        const last = document.createElement('span');
        last.textContent = nights[nights.length - 1]?.date ?? '';
        labelsRow.append(first, last);
    }
    function renderInsightFactors() {
        const container = byId('sleep-insight-factors');
        container.innerHTML = '';
        const factors = calculateSleepFactorInsights(recentLogs);
        if (factors.length === 0)
            return;
        const heading = document.createElement('div');
        heading.className = 'muted';
        heading.style.cssText = 'font-size:13px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase;';
        heading.textContent = "What's helping";
        container.append(heading);
        for (const factor of factors) {
            const card = document.createElement('div');
            card.className = 'sleep-factor-card';
            const sign = factor.deltaPoints >= 0 ? '+' : '';
            card.innerHTML = `<span>${factor.label}</span><span class="delta ${factor.favorable ? 'favorable' : 'unfavorable'}">${sign}${factor.deltaPoints} pts avg</span>`;
            container.append(card);
        }
    }
    /** Wind Down's ambient-sound picker + Begin button drive the exact same
     *  shared engine Focus's own screen uses (see audio-engine.ts's
     *  getFocusAudioEngine()) — picking a quick sound here and opening the
     *  full Focus screen later shows the same playing/stopped state,
     *  not two disconnected players. */
    function wireWindDown() {
        const engine = getFocusAudioEngine();
        const picker = byId('wind-down-sound-picker');
        const beginButton = byId('btn-wind-down-begin');
        let selectedSoundId = 'rain';
        function selectPill(soundId) {
            selectedSoundId = soundId;
            for (const pill of picker.querySelectorAll('.sound-pill')) {
                pill.setAttribute('aria-pressed', String((pill.dataset.value ?? '') === soundId));
            }
        }
        picker.addEventListener('click', (event) => {
            const pill = event.target.closest('.sound-pill');
            if (!pill || !picker.contains(pill))
                return;
            selectPill(pill.dataset.value ?? '');
        });
        function renderBeginButton(state) {
            const isThisSound = state.playing && state.soundscapeId === selectedSoundId && selectedSoundId !== '';
            beginButton.textContent = isThisSound ? 'Playing — tap to stop' : 'Begin';
        }
        engine.onStateChange(renderBeginButton);
        renderBeginButton(engine.getState());
        beginButton.addEventListener('click', () => {
            const state = engine.getState();
            if (state.playing && state.soundscapeId === selectedSoundId) {
                engine.stop();
            }
            else if (selectedSoundId === '') {
                engine.stop(); // "Quiet" — just the breathing pacer, no sound
            }
            else {
                void engine.start(selectedSoundId);
            }
        });
        byId('btn-wind-down-more-sounds').addEventListener('click', () => showScreen('screen-focus'));
    }
    // --- wiring ---
    byId('sleep-log-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const errEl = byId('err-sleep-log');
        const bedTimeClock = byId('sleep-log-bedtime').value;
        const wakeTimeClock = byId('sleep-log-waketime').value;
        if (!bedTimeClock || !wakeTimeClock) {
            errEl.hidden = false;
            return;
        }
        const date = todayDateString();
        let times;
        try {
            times = computeSleepLogTimes(date, bedTimeClock, wakeTimeClock);
        }
        catch {
            errEl.hidden = false;
            return;
        }
        if (times.durationMinutes <= 0) {
            errEl.hidden = false;
            return;
        }
        errEl.hidden = true;
        const qualityValue = qualityChips.getValue();
        const saved = await saveSleepLog({
            date,
            bedTime: times.bedTime,
            wakeTime: times.wakeTime,
            durationMinutes: times.durationMinutes,
            quality: qualityValue == null ? null : Number(qualityValue),
            notes: byId('sleep-log-notes').value.trim(),
        });
        todayLog = saved;
        recentLogs = [saved, ...recentLogs.filter((l) => l.date !== date)];
        renderResult(saved);
    });
    byId('btn-sleep-edit-log').addEventListener('click', () => {
        if (!todayLog)
            return;
        byId('sleep-log-bedtime').value = todayLog.bedTime ? formatTimeInputValue(todayLog.bedTime) : '';
        byId('sleep-log-waketime').value = todayLog.wakeTime ? formatTimeInputValue(todayLog.wakeTime) : '';
        qualityChips.setValue(todayLog.quality == null ? null : String(todayLog.quality));
        byId('sleep-log-notes').value = todayLog.notes ?? '';
        renderForm();
    });
    byId('btn-sleep-start-wind-down').addEventListener('click', () => showScreen('screen-sleep-wind-down'));
    byId('btn-wind-down-back').addEventListener('click', () => showScreen('screen-sleep-dashboard'));
    wireWindDown();
    byId('btn-sleep-insights').addEventListener('click', () => {
        renderInsights();
        showScreen('screen-sleep-insights');
    });
    byId('btn-sleep-insights-back').addEventListener('click', () => showScreen('screen-sleep-dashboard'));
    byId('btn-sleep-dashboard-back').addEventListener('click', () => showScreen('screen-hub'));
    // The Hub's Sleep tile jumps straight here — reload the day's state
    // every time this screen becomes current, not just once at boot, so
    // last night's freshly-saved log always shows.
    byId('btn-home-sleep').addEventListener('click', () => {
        void loadDashboard();
    });
    void loadDashboard();
}
//# sourceMappingURL=sleep-view.js.map