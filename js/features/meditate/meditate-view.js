// Meditate's own screen: a picker for the guided meditation and breathwork
// library (meditations.ts), rendered as one section per real category
// (stress/difficult emotion, self-compassion & connection, focus &
// grounding, sleep prep, breathwork — see MEDITATE_CATEGORIES) rather than
// one flat grid, plus a real streak/minutes card built from logged
// completions — the same "reload on entry, not just at boot" pattern as
// sleep-view.ts, and the same Hub-tile-subtitle handoff as sleep-view.ts/
// focus-view.ts (see hub-view.ts's doc comment). Playback itself is
// entirely the shared guided-session player
// (js/features/focus/guided-session-view.ts) — this module never touches
// a countdown, the pacer, or voice guidance directly.
import { showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { animateCountUp } from '../../lib/count-up.js';
import { iconMarkup } from '../../lib/icons.js';
import { totalDurationSeconds } from '../../lib/guided-session.js';
import { setMeditateTileSubtitle } from '../hub/hub-view.js';
import { recordMeditationSession, listRecentMeditationSessions } from '../../db/repositories/meditation.js';
import { calculateMeditationStreak, sessionsInLastNDays, totalMinutes } from './meditate-trends.js';
import { MEDITATE_CATEGORIES } from './meditations.js';
const SESSION_ICON = {
    'quiet-mind': 'leaf',
    'body-scan': 'meditate',
    sadness: 'droplet',
    anger: 'flame',
    grief: 'moon-stars',
    change: 'wind',
    anxiety: 'lungs',
    'self-compassion': 'heart-pulse',
    'loving-kindness': 'waves',
    gratitude: 'sparkle',
    resilience: 'target',
    'quick-reset': 'check',
    'sleep-wind-down': 'moon',
    'four-seven-eight': 'lungs',
    'physiological-sigh': 'wind',
    'box-breathing': 'grid',
};
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`meditate-view: missing #${id}`);
    return el;
}
/** Rounds a session's total to whole minutes for display, but never down
 *  to "0 min" for something that genuinely takes under a minute (Quick
 *  Reset) — those read as "under 1 min" instead. */
function formatSessionLength(session) {
    const minutes = totalDurationSeconds(session) / 60;
    return minutes < 1 ? 'under 1 min' : `${Math.round(minutes)} min`;
}
export function initMeditateFeature(player) {
    function playSession(session) {
        player.playGuidedSession(session, 'screen-meditate', {
            themeClass: 'theme-meditate',
            onComplete: (finished) => {
                void recordMeditationSession({
                    sessionId: finished.id,
                    sessionName: finished.name,
                    durationSeconds: totalDurationSeconds(finished),
                }).then(refreshStats);
            },
        });
    }
    function buildGrid(grid, sessions) {
        sessions.forEach((session, index) => {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'meditate-session-tile tilt-card tilt-enter';
            tile.id = `btn-meditate-${session.id}`;
            tile.style.animationDelay = `${index * 0.05}s`;
            tile.innerHTML = `<span class="meditate-session-tile-face tilt-press"><span class="meditate-session-tile-icon" data-tilt-depth="1">${iconMarkup(SESSION_ICON[session.id] ?? 'leaf', { size: 18 })}</span><span class="name">${session.name}</span><span class="duration">${formatSessionLength(session)}</span></span>`;
            tile.title = session.description;
            tile.addEventListener('click', () => playSession(session));
            grid.append(tile);
        });
    }
    /** Renders one section per real category (see MEDITATE_CATEGORIES in
     *  meditations.ts) — stress, self-compassion/connection, focus, sleep
     *  prep, breathwork — instead of one undifferentiated grid, so the
     *  picker itself reflects that these are distinct techniques for
     *  distinct use-cases, not interchangeable reskins of the same content.
     *  Content-driven: adding or recategorizing a session in the data module
     *  is all it takes for this to pick it up, no view-code change needed. */
    function buildCategorySections() {
        const container = byId('meditate-categories');
        container.innerHTML = '';
        for (const category of MEDITATE_CATEGORIES) {
            if (category.sessions.length === 0)
                continue;
            const section = document.createElement('div');
            section.className = 'meditate-category';
            section.id = `meditate-category-${category.id}`;
            const heading = document.createElement('span');
            heading.className = 'meditate-category-label';
            heading.textContent = category.label.toUpperCase();
            heading.title = category.description;
            const grid = document.createElement('div');
            grid.className = 'focus-sound-grid';
            grid.id = `meditate-grid-${category.id}`;
            section.append(heading, grid);
            container.append(section);
            buildGrid(grid, category.sessions);
        }
    }
    /** Real numbers, not a guess — recomputed from what's actually logged
     *  every time this screen is reached, same discipline as Sleep's
     *  dashboard reload. Both the on-screen stat tiles and the Hub tile's
     *  subtitle come from this one pass over the data. */
    async function refreshStats() {
        const recent = await listRecentMeditationSessions(200);
        const records = recent.map((s) => ({ date: s.date, durationSeconds: s.durationSeconds }));
        const streak = calculateMeditationStreak(records);
        const minutesThisWeek = totalMinutes(sessionsInLastNDays(records, 7));
        animateCountUp(byId('meditate-stat-streak'), streak);
        animateCountUp(byId('meditate-stat-minutes'), minutesThisWeek);
        setMeditateTileSubtitle(streak > 0 ? `${streak}-day streak` : 'Guided meditation & breathwork');
    }
    buildCategorySections();
    byId('btn-meditate-back').addEventListener('click', () => showScreen('screen-hub'));
    // Same pattern as Sleep: the Hub's own tile click both navigates
    // (hub-view.ts) and, here, reloads real numbers for whatever's been
    // logged since this screen was last open.
    byId('btn-home-meditate').addEventListener('click', () => {
        void refreshStats();
    });
    const tilt = attachTilt(byId('screen-meditate'));
    byId('screen-meditate').addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
    void refreshStats();
}
//# sourceMappingURL=meditate-view.js.map