// Badges: every mini-app's real streaks and lifetime totals, in one
// place, with a permanent earned date — see badge-definitions.ts for why
// each threshold is what it is. Evaluation runs on Hub load (for the tile
// subtitle) and every time this screen opens (for the full grid) — this
// is a client with no background service, so "earned" means "the app has
// now noticed", the same honest limit documented on EarnedBadge itself.
import { onScreenShown, showScreen } from '../../lib/router.js';
import { attachTilt } from '../../lib/tilt.js';
import { iconMarkup } from '../../lib/icons.js';
import { evaluateAllBadges } from './badge-engine.js';
import { setBadgesTileSubtitle } from '../hub/hub-view.js';
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`badges-view: missing #${id}`);
    return el;
}
export function initBadgesFeature() {
    byId('btn-home-badges').addEventListener('click', async () => {
        await renderBadges();
        showScreen('screen-badges');
    });
    byId('btn-badges-back').addEventListener('click', () => showScreen('screen-hub'));
    const tilt = attachTilt(byId('screen-badges'));
    byId('screen-badges').addEventListener('pointerdown', () => void tilt.requestMotionPermission(), { once: true });
    // The Hub tile's own "X earned" subtitle needs real data as soon as the
    // Hub itself loads, and again every time the person returns to it —
    // logging a milestone in Steps, say, and going straight back to the Hub
    // without ever opening this screen should still update the count.
    void refreshHubTile();
    onScreenShown('screen-hub', () => void refreshHubTile());
}
async function refreshHubTile() {
    const badges = await evaluateAllBadges();
    const earnedCount = badges.filter((b) => b.earned).length;
    setBadgesTileSubtitle(earnedCount > 0 ? `${earnedCount} earned` : 'Real milestones, not stickers');
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
async function renderBadges() {
    const badges = await evaluateAllBadges();
    const earned = badges.filter((b) => b.earned);
    const locked = badges.filter((b) => !b.earned);
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
    await refreshHubTile();
}
//# sourceMappingURL=badges-view.js.map