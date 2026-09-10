import { describe, expect, it } from 'vitest';
import { GOAL_TYPES, getGoalType } from '../../../js/features/goals/goal-types.js';

describe('GOAL_TYPES catalog', () => {
  it('has real, distinct types — not one generic entry', () => {
    expect(GOAL_TYPES.length).toBeGreaterThanOrEqual(4);
  });

  it('every id is unique', () => {
    const ids = GOAL_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every type has a real label, icon, and hint', () => {
    for (const type of GOAL_TYPES) {
      expect(type.label.length).toBeGreaterThan(0);
      expect(type.icon.length).toBeGreaterThan(0);
      expect(type.hint.length).toBeGreaterThan(10);
    }
  });

  it('covers the exact cases named — cardio endurance and skill/technique practice', () => {
    const labels = GOAL_TYPES.map((t) => t.label.toLowerCase());
    expect(labels.some((l) => l.includes('cardio') || l.includes('endurance'))).toBe(true);
    expect(labels.some((l) => l.includes('skill'))).toBe(true);
  });

  it('Custom has no preset units — it stays genuinely freeform', () => {
    const custom = getGoalType('custom');
    expect(custom.units).toEqual([]);
  });

  it('every non-custom type offers real, distinct preset units', () => {
    for (const type of GOAL_TYPES) {
      if (type.id === 'custom') continue;
      expect(type.units.length).toBeGreaterThan(0);
      expect(new Set(type.units).size).toBe(type.units.length);
    }
  });
});

describe('getGoalType', () => {
  it('finds a type by id', () => {
    expect(getGoalType('cardio')?.label).toBe('Cardio Endurance');
  });

  it('returns undefined for an unknown id', () => {
    expect(getGoalType('does-not-exist')).toBeUndefined();
  });
});
