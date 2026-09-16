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
import { evaluateAllBadges, type EvaluatedBadge } from './badge-engine.js';
import { badgeAchievementCopy } from './badge-definitions.js';
import { closestLockedBadge } from './badge-progress.js';
import { setBadgesTileSubtitle } from '../hub/hub-view.js';
import type { BadgeStatus } from './types.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`badges-view: missing #${id}`);
  return el as T;
}

function bySvgId<T extends SVGElement = SVGElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`badges-view: missing #${id}`);
  return el as unknown as T;
}

// Matches the hero ring's own r=48 in index.html/mini-apps.css.
const BADGES_RING_CIRCUMFERENCE = 2 * Math.PI * 48;

export function initBadgesFeature(): void {
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

// One real, immediate celebration the moment the app actually notices a
// badge crossed — a toast (screen-agnostic, works from the Hub or
// anywhere else this fires) plus a system Notification if that's already
// been granted (see js/lib/notifications.js — never prompts on its own
// here, same "only if already granted" rule Goals' own reminder check
// follows). `isNewlyEarned` is set by evaluateAllBadges itself, so this
// only ever fires on the exact check that first recorded the badge —
// never again on a later Hub visit for an already-earned tier.
function announceNewlyEarnedBadges(badges: EvaluatedBadge[]): void {
  const newlyEarned = badges.filter((b) => b.isNewlyEarned);
  if (newlyEarned.length === 0) return;

  const copies = newlyEarned.map((b) => badgeAchievementCopy(b));
  queueAchievementToasts(copies);

  if (getNotificationPermission() === 'granted') {
    for (const { title, body } of copies) showNotification(title, { body });
  }
}

/** Refreshes the Hub tile's subtitle and, on a genuinely fresh check
 *  (badges omitted), announces any tier this exact call newly recorded.
 *  Accepts an already-evaluated `badges` array (from renderBadges' own
 *  call below) so opening the Badges screen doesn't evaluate — and
 *  potentially re-announce — the same check twice. */
async function refreshHubTile(badges?: EvaluatedBadge[]): Promise<void> {
  const resolved = badges ?? (await evaluateAllBadges());
  const earnedCount = resolved.filter((b) => b.earned).length;
  setBadgesTileSubtitle(earnedCount > 0 ? `${earnedCount} earned` : 'Real milestones, not stickers');
  announceNewlyEarnedBadges(resolved);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A deterministic 0.85-1.15 multiplier from a badge's own tier id —
 *  real per-card variance for the medal-grid tilt (see .badge-card--
 *  earned.tilt-card in mini-apps.css) so a grid of earned medals
 *  doesn't all rotate in perfect lockstep with the shared screen-tilt
 *  reading. Deterministic, not random-per-render, so the same badge
 *  always tilts the same way — a random reshuffle on every re-render
 *  would read as glitchy, not alive. */
function cardSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 0.85 + (hash % 1000) / 1000 * 0.3; // 0.85–1.15
}

/** e.g. "4 of 7 consecutive nights logged" for a locked tier — the same
 *  honest-progress-number rule Goals' own milestone copy holds to,
 *  never a vague "almost there" with no real count behind it. */
function progressLabel(badge: BadgeStatus): string {
  const shown = Math.min(badge.currentValue, badge.threshold);
  const value = Number.isInteger(shown) ? shown : shown.toFixed(1);
  const threshold = Number.isInteger(badge.threshold) ? badge.threshold : badge.threshold.toFixed(1);
  return `${value} of ${threshold} ${badge.metricLabel}`;
}

/** Every earned medal is a real, focusable, tappable control — tapping
 *  (or Enter/Space) replays its .badge-card-icon--reveal turn on demand,
 *  the same one-shot animation a freshly-earned badge already plays
 *  automatically (see .badge-card-icon--reveal in mini-apps.css). A
 *  genuine user-triggered interaction, not a decorative loop — the medal
 *  otherwise sits still, same as Apple's own award grid, until either a
 *  real "just earned" moment or a real tap asks it to turn again. */
function wireEarnedBadgeIcons(): void {
  for (const icon of byId('badges-earned-grid').querySelectorAll<HTMLElement>('.badge-card-icon')) {
    icon.addEventListener('animationend', () => {
      icon.classList.remove('badge-card-icon--reveal', 'badge-card-icon--spin');
    });

    const replay = (): void => {
      if (icon.classList.contains('badge-card-icon--reveal') || icon.classList.contains('badge-card-icon--spin')) return;
      icon.classList.add('badge-card-icon--spin');
    };
    icon.addEventListener('click', replay);
    icon.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        replay();
      }
    });
  }
}

/** Draws the hero ring in to a real earned/total fraction — the same
 *  honest, zero-until-real-data draw-in as Steps' own goal ring, never a
 *  fabricated starting fraction. */
function setBadgesProgressRing(earnedCount: number, totalCount: number): void {
  const fraction = totalCount > 0 ? earnedCount / totalCount : 0;
  const offset = BADGES_RING_CIRCUMFERENCE * (1 - fraction);
  bySvgId('badges-progress-ring-fill').setAttribute('stroke-dashoffset', offset.toFixed(2));
}

/** The hero card's "closest to earning" line — a real, honest nudge
 *  (closestLockedBadge, badge-progress.ts) reusing the exact same
 *  progress copy each locked tier card already shows. Hidden entirely
 *  once every real badge is earned, never a fabricated "keep going". */
function setBadgesNextMilestone(badges: EvaluatedBadge[]): void {
  const el = byId('badges-next-milestone');
  const next = closestLockedBadge(badges);
  el.hidden = next == null;
  el.textContent = next ? `Closest to earning: ${progressLabel(next)} — ${next.name}` : '';
}

async function renderBadges(): Promise<void> {
  const badges = await evaluateAllBadges();
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  byId('badges-earned-count').textContent = String(earned.length);
  byId('badges-total-count').textContent = String(badges.length);
  setBadgesProgressRing(earned.length, badges.length);
  setBadgesNextMilestone(badges);

  byId('badges-earned-grid').innerHTML = earned.length
    ? earned
        .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''))
        .map(
          (b) => `
        <div class="card badge-card badge-card--earned tilt-card tilt-enter" style="--card-seed:${cardSeed(b.id).toFixed(3)};">
          <span class="badge-card-icon${b.isNewlyEarned ? ' badge-card-icon--reveal' : ''}" data-tilt-depth="1" role="button" tabindex="0" aria-label="Replay the ${b.name} badge shine">${iconMarkup(b.icon, { size: 22 })}</span>
          <strong>${b.name}</strong>
          <p class="muted" style="font-size:var(--fs-sm);">${b.category}</p>
          <p class="muted" style="font-size:var(--fs-xs);">Earned ${formatDate(b.earnedAt as string)}</p>
        </div>
      `
        )
        .join('')
    : '<p class="muted center-text">No badges yet — every real streak and milestone in this app can earn one.</p>';
  wireEarnedBadgeIcons();

  byId('badges-locked-grid').innerHTML = locked
    .map(
      (b) => `
        <div class="card badge-card tilt-card tilt-enter">
          <span class="badge-card-icon badge-card-icon--locked" aria-hidden="true">${iconMarkup(b.icon, { size: 22 })}</span>
          <strong>${b.name}</strong>
          <p class="muted" style="font-size:var(--fs-sm);">${b.category}</p>
          <p class="muted" style="font-size:var(--fs-xs);">${progressLabel(b)}</p>
        </div>
      `
    )
    .join('');

  await refreshHubTile(badges);
}
