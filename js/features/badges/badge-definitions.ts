// The badge catalog: a real, honest milestone system, not a decorative
// sticker sheet — every group below reads a real number this app already
// has stored, most of it via a computation another mini-app's own screen
// already shows (Sleep/Meditate/Vitals/Steps/Hydration's streaks; Run's
// PR badges; Steps'/Hydration's "best day ever"). Badges just gives all
// of it a second, cross-app home and a permanent record of when it was
// first reached — Apple Health's own Activity awards are a handful of
// streak/perfect-month badges scoped to one ring; this covers every
// mini-app that has a real logging habit or a real cumulative total.
//
// Deliberately excluded: anything that would require inventing a number
// (a calorie streak, a "perfect week" score) rather than reading one that
// already exists — see the README's "no fabricated numbers" rule.
import type { BadgeGroup, BadgeStatus } from './types.js';

export const BADGE_GROUPS: BadgeGroup[] = [
  {
    id: 'sleep-streak',
    category: 'Sleep',
    icon: 'moon',
    metricLabel: 'consecutive nights logged',
    basis: 'The same logging streak Sleep\'s own dashboard tracks.',
    tiers: [
      { id: 'sleep-streak-3', threshold: 3, name: 'Sleep Starter' },
      { id: 'sleep-streak-7', threshold: 7, name: 'Week of Rest' },
      { id: 'sleep-streak-30', threshold: 30, name: 'Sleep Habit' },
    ],
  },
  {
    id: 'meditate-streak',
    category: 'Meditate',
    icon: 'meditate',
    metricLabel: 'consecutive days practiced',
    basis: 'The same streak Meditate\'s own screen tracks.',
    tiers: [
      { id: 'meditate-streak-3', threshold: 3, name: 'Finding Calm' },
      { id: 'meditate-streak-7', threshold: 7, name: 'Week of Mindfulness' },
      { id: 'meditate-streak-30', threshold: 30, name: 'Steady Practice' },
    ],
  },
  {
    id: 'meditate-minutes',
    category: 'Meditate',
    icon: 'meditate',
    metricLabel: 'total minutes practiced',
    basis: 'A real cumulative sum of every completed session\'s duration.',
    tiers: [
      { id: 'meditate-minutes-60', threshold: 60, name: 'First Hour' },
      { id: 'meditate-minutes-300', threshold: 300, name: 'Five Hours' },
      { id: 'meditate-minutes-1000', threshold: 1000, name: 'Deep Practice' },
    ],
  },
  {
    id: 'vitals-streak',
    category: 'Vitals',
    icon: 'gauge',
    metricLabel: 'consecutive days logged',
    basis: 'A blood-pressure or SpO2 reading logged — the same combined streak the Vitals screen tracks.',
    tiers: [
      { id: 'vitals-streak-7', threshold: 7, name: 'Vitals Watch' },
      { id: 'vitals-streak-30', threshold: 30, name: 'Vitals Habit' },
    ],
  },
  {
    id: 'steps-streak',
    category: 'Steps',
    icon: 'footprints',
    metricLabel: 'consecutive days logged',
    basis: 'The same streak Steps\' own screen tracks.',
    tiers: [
      { id: 'steps-streak-7', threshold: 7, name: 'On Your Feet' },
      { id: 'steps-streak-30', threshold: 30, name: 'Walking Habit' },
    ],
  },
  {
    id: 'steps-single-day',
    category: 'Steps',
    icon: 'footprints',
    metricLabel: 'steps in one day, best day ever',
    basis: 'The classic 10,000-steps single-day goal — the real best day across the whole logged history.',
    tiers: [{ id: 'steps-single-day-10k', threshold: 10_000, name: '10K Day' }],
  },
  {
    id: 'steps-lifetime',
    category: 'Steps',
    icon: 'footprints',
    metricLabel: 'total steps logged',
    basis: 'A real cumulative sum across every day ever logged.',
    tiers: [
      { id: 'steps-lifetime-100k', threshold: 100_000, name: 'Hundred Thousand' },
      { id: 'steps-lifetime-500k', threshold: 500_000, name: 'Half Million' },
      { id: 'steps-lifetime-1m', threshold: 1_000_000, name: 'Million Steps' },
    ],
  },
  {
    id: 'hydration-streak',
    category: 'Hydration',
    icon: 'glass-water',
    metricLabel: 'consecutive days logged',
    basis: 'The same streak Hydration\'s own screen tracks.',
    tiers: [
      { id: 'hydration-streak-7', threshold: 7, name: 'Staying Topped Up' },
      { id: 'hydration-streak-30', threshold: 30, name: 'Hydration Habit' },
    ],
  },
  {
    id: 'hydration-lifetime',
    category: 'Hydration',
    icon: 'glass-water',
    metricLabel: 'total liters logged',
    basis: 'A real cumulative sum, converted from every logged milliliter.',
    tiers: [
      { id: 'hydration-lifetime-50l', threshold: 50, name: '50 Liters' },
      { id: 'hydration-lifetime-200l', threshold: 200, name: '200 Liters' },
      { id: 'hydration-lifetime-500l', threshold: 500, name: '500 Liters' },
    ],
  },
  {
    id: 'run-count',
    category: 'Run',
    icon: 'wind',
    metricLabel: 'runs completed',
    basis: 'A real count of every saved run.',
    tiers: [
      { id: 'run-count-1', threshold: 1, name: 'First Run' },
      { id: 'run-count-10', threshold: 10, name: 'Regular Runner' },
      { id: 'run-count-50', threshold: 50, name: 'Dedicated Runner' },
    ],
  },
  {
    id: 'run-distance',
    category: 'Run',
    icon: 'wind',
    metricLabel: 'total km run',
    basis: 'A real cumulative sum of every completed run\'s distance — thresholds are real race distances.',
    tiers: [
      { id: 'run-distance-5k', threshold: 5, name: '5K Total' },
      { id: 'run-distance-half', threshold: 21.1, name: 'Half-Marathon Total' },
      { id: 'run-distance-full', threshold: 42.2, name: 'Marathon Total' },
    ],
  },
  {
    id: 'workouts-count',
    category: 'Programs',
    icon: 'dumbbell',
    metricLabel: 'workouts logged',
    basis: 'A real count of every completed session — strength workouts and logged activity alike.',
    tiers: [
      { id: 'workouts-count-1', threshold: 1, name: 'First Workout' },
      { id: 'workouts-count-10', threshold: 10, name: 'Ten Workouts' },
      { id: 'workouts-count-50', threshold: 50, name: 'Fifty Workouts' },
      { id: 'workouts-count-100', threshold: 100, name: 'Century Club' },
    ],
  },
];

/** Evaluates one badge group's tiers against a real, already-computed
 *  current value — pure, no I/O, so it's trivially testable and the
 *  engine stays the only place that touches the database. */
export function evaluateBadgeGroup(group: BadgeGroup, currentValue: number): BadgeStatus[] {
  return group.tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    category: group.category,
    icon: group.icon,
    threshold: tier.threshold,
    metricLabel: group.metricLabel,
    basis: group.basis,
    earned: currentValue >= tier.threshold,
    currentValue,
  }));
}
