// Meditate's own screen: a picker for the guided meditation and breathwork
// libraries (meditations.ts) plus a real streak/minutes card built from
// logged completions — the same "reload on entry, not just at boot"
// pattern as sleep-view.ts, and the same Hub-tile-subtitle handoff as
// sleep-view.ts/focus-view.ts (see hub-view.ts's doc comment). Playback
// itself is entirely the shared guided-session player
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
import { MEDITATIONS, BREATHWORK } from './meditations.js';
const SESSION_ICON = {
    'quiet-mind': 'leaf',
    sadness: 'droplet',
    anger: 'flame',
    grief: 'moon-stars',
    change: 'wind',
    anxiety: 'lungs',
    'self-compassion': 'heart-pulse',
    gratitude: 'sparkle',
    resilience: 'target',
    'quick-reset': 'check',
    'four-seven-eight': 'lungs',
    'physiological-sigh': 'wind',
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
    function buildGrid(gridId, sessions) {
        const grid = byId(gridId);
        grid.innerHTML = '';
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
    buildGrid('meditate-meditations-grid', MEDITATIONS);
    buildGrid('meditate-breathwork-grid', BREATHWORK);
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