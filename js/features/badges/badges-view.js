// Badges: every mini-app's real streaks and lifetime totals, in one
// place, with a permanent earned date — see badge-definitions.ts for why
// each threshold is what it is. Evaluation runs on Hub load (for the tile
// subtitle) and every time this screen opens (for the full grid) — this
// is a client with no background service, so "earned" means "the app has
// now noticed", the same honest limit documented on EarnedBadge itself.
import { onScreenShown, showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { iconMarkup } from '../../lib/icons.js';
import { getNotificationPermission, showNotification } from '../../lib/notifications.js';
import { queueAchievementToasts } from '../../lib/achievement-toast.js';
import { evaluateAllBadges, evaluatePersonalBests } from './badge-engine.js';
import { badgeAchievementCopy } from './badge-definitions.js';
import { setBadgesTileSubtitle } from '../hub/hub-view.js';
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`badges-view: missing #${id}`);
    return el;
}
let activeFilter = 'all';
export function initBadgesFeature() {
    byId('btn-home-badges').addEventListener('click', async () => {
        await renderBadges();
        showScreen('screen-badges');
    });
    byId('btn-badges-back').addEventListener('click', () => showScreen('screen-hub'));
    const tilt = attachTilt(byId('screen-badges'));
    byId('screen-badges').addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
    byId('badges-filter-toggle').addEventListener('click', (e) => {
        const btn = e.target.closest('.chip[data-value]');
        if (!btn)
            return;
        activeFilter = btn.dataset.value;
        for (const chip of byId('badges-filter-toggle').querySelectorAll('.chip')) {
            chip.setAttribute('aria-pressed', String(chip === btn));
        }
        applyFilterVisibility();
    });
    // The Hub tile's own "X earned" subtitle needs real data as soon as the
    // Hub itself loads, and again every time the person returns to it —
    // logging a milestone in Steps, say, and going straight back to the Hub
    // without ever opening this screen should still update the count.
    void refreshHubTile();
    onScreenShown('screen-hub', () => void refreshHubTile());
}
/** Shows/hides the Personal Bests and Achievements sections per the
 *  active filter chip — a display concern only, never re-fetches, so
 *  switching filters back and forth is instant and never re-triggers
 *  the new-badge announcement path. */
function applyFilterVisibility() {
    byId('badges-personalbests-section').hidden = activeFilter === 'achievements';
    byId('badges-achievements-section').hidden = activeFilter === 'personal-bests';
}
// One real, immediate celebration the moment the app actually notices a
// badge crossed — a toast (screen-agnostic, works from the Hub or
// anywhere else this fires) plus a system Notification if that's already
// been granted (see js/lib/notifications.js — never prompts on its own
// here, same "only if already granted" rule Goals' own reminder check
// follows). `isNewlyEarned` is set by evaluateAllBadges itself, so this
// only ever fires on the exact check that first recorded the badge —
// never again on a later Hub visit for an already-earned tier.
function announceNewlyEarnedBadges(badges) {
    const newlyEarned = badges.filter((b) => b.isNewlyEarned);
    if (newlyEarned.length === 0)
        return;
    const copies = newlyEarned.map((b) => badgeAchievementCopy(b));
    queueAchievementToasts(copies);
    if (getNotificationPermission() === 'granted') {
        for (const { title, body } of copies)
            showNotification(title, { body });
    }
}
/** Refreshes the Hub tile's subtitle and, on a genuinely fresh check
 *  (badges omitted), announces any tier this exact call newly recorded.
 *  Accepts an already-evaluated `badges` array (from renderBadges' own
 *  call below) so opening the Badges screen doesn't evaluate — and
 *  potentially re-announce — the same check twice. */
async function refreshHubTile(badges) {
    const resolved = badges ?? (await evaluateAllBadges());
    const earnedCount = resolved.filter((b) => b.earned).length;
    setBadgesTileSubtitle(earnedCount > 0 ? `${earnedCount} earned` : 'Real milestones, not stickers');
    announceNewlyEarnedBadges(resolved);
}
function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
/** A deterministic 0.85-1.15 multiplier from a badge's own tier id —
 *  real per-card variance for the medal-grid tilt (see .badge-card--
 *  earned.tilt-card in mini-apps.css) so a grid of earned medals
 *  doesn't all rotate in perfect lockstep with the shared screen-tilt
 *  reading. Deterministic, not random-per-render, so the same badge
 *  always tilts the same way — a random reshuffle on every re-render
 *  would read as glitchy, not alive. */
function cardSeed(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++)
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return 0.85 + (hash % 1000) / 1000 * 0.3; // 0.85–1.15
}
/** e.g. "4 of 7 consecutive nights logged" for a locked tier — the same
 *  honest-progress-number rule Goals' own milestone copy holds to,
 *  never a vague "almost there" with no real count behind it. */
function progressLabel(badge) {
    const shown = Math.min(badge.currentValue, badge.threshold);
    const value = Number.isInteger(shown) ? shown : shown.toFixed(1);
    const threshold = Number.isInteger(badge.threshold) ? badge.threshold : badge.threshold.toFixed(1);
    return `${value} of ${threshold} ${badge.metricLabel}`;
}
/** Personal-best cards reuse the earned-medal look (they're always a real,
 *  currently-standing record, never a locked/in-progress state) but show
 *  the real value in place of an earned date. */
function personalBestCardMarkup(pb) {
    return `
    <div class="card badge-card badge-card--earned tilt-card tilt-enter" style="--card-seed:${cardSeed(pb.id).toFixed(3)};">
      <span class="badge-card-icon" data-tilt-depth="1" aria-hidden="true">${iconMarkup(pb.icon, { size: 22 })}</span>
      <strong>${pb.label}</strong>
      <p class="muted" style="font-size:var(--fs-sm);">${pb.category}</p>
      <p class="muted" style="font-size:var(--fs-xs);">${pb.value}</p>
    </div>
  `;
}
async function renderBadges() {
    const [badges, personalBests] = await Promise.all([evaluateAllBadges(), evaluatePersonalBests()]);
    const earned = badges.filter((b) => b.earned);
    const locked = badges.filter((b) => !b.earned);
    byId('badges-personalbests-grid').innerHTML = personalBests.length
        ? personalBests.map(personalBestCardMarkup).join('')
        : '<p class="muted center-text">No personal bests yet — log a run, some steps, or water to set your first real record.</p>';
    byId('badges-earned-count').textContent = String(earned.length);
    byId('badges-total-count').textContent = String(badges.length);
    byId('badges-earned-grid').innerHTML = earned.length
        ? earned
            .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''))
            .map((b) => `
        <div class="card badge-card badge-card--earned tilt-card tilt-enter" style="--card-seed:${cardSeed(b.id).toFixed(3)};">
          <span class="badge-card-icon" data-tilt-depth="1" aria-hidden="true">${iconMarkup(b.icon, { size: 22 })}</span>
          <strong>${b.name}</strong>
          <p class="muted" style="font-size:var(--fs-sm);">${b.category}</p>
          <p class="muted" style="font-size:var(--fs-xs);">Earned ${formatDate(b.earnedAt)}</p>
        </div>
      `)
            .join('')
        : '<p class="muted center-text">No badges yet — every real streak and milestone in this app can earn one.</p>';
    byId('badges-locked-grid').innerHTML = locked
        .map((b) => `
        <div class="card badge-card tilt-card tilt-enter">
          <span class="badge-card-icon badge-card-icon--locked" aria-hidden="true">${iconMarkup(b.icon, { size: 22 })}</span>
          <strong>${b.name}</strong>
          <p class="muted" style="font-size:var(--fs-sm);">${b.category}</p>
          <p class="muted" style="font-size:var(--fs-xs);">${progressLabel(b)}</p>
        </div>
      `)
        .join('');
    applyFilterVisibility();
    await refreshHubTile(badges);
}
//# sourceMappingURL=badges-view.js.map