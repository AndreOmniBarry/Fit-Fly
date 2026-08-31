import { describe, expect, it } from 'vitest';
import { GUIDED_SESSIONS, getGuidedSession, totalDurationSeconds } from '../../../js/features/focus/guided-sessions.js';

describe('GUIDED_SESSIONS catalog', () => {
  it('has all four sessions asked for', () => {
    const ids = GUIDED_SESSIONS.map((s) => s.id).sort();
    expect(ids).toEqual(['breathing-focus', 'focus', 'relax', 'sleep-focus'].sort());
  });

  it('every id is unique', () => {
    const ids = GUIDED_SESSIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every session has at least one beat and real name/description', () => {
    for (const s of GUIDED_SESSIONS) {
      expect(s.beats.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.basis.length).toBeGreaterThan(0);
    }
  });

  it('every beat has non-empty text and a positive duration', () => {
    for (const s of GUIDED_SESSIONS) {
      for (const beat of s.beats) {
        expect(beat.text.trim().length).toBeGreaterThan(0);
        expect(beat.durationSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('stays within the promised 1-3 minute range (with reasonable slack)', () => {
    for (const s of GUIDED_SESSIONS) {
      const total = totalDurationSeconds(s);
      expect(total).toBeGreaterThanOrEqual(45);
      expect(total).toBeLessThanOrEqual(210);
    }
  });

  it('descriptions and basis notes avoid diagnostic/clinical language', () => {
    const bannedWords = /anxiety|overthink|depress|disorder|therapy|patient|diagnos|treat(ment)?/i;
    for (const s of GUIDED_SESSIONS) {
      expect(s.description).not.toMatch(bannedWords);
      for (const beat of s.beats) {
        expect(beat.text).not.toMatch(bannedWords);
      }
    }
  });
});

describe('Breathing Focus: box breathing structure', () => {
  const session = getGuidedSession('breathing-focus');

  it('has six full 4-4-4-4 cycles', () => {
    const inBeats = session.beats.filter((b) => b.breathPhase === 'in');
    const holdBeats = session.beats.filter((b) => b.breathPhase === 'hold');
    const outBeats = session.beats.filter((b) => b.breathPhase === 'out');
    const holdEmptyBeats = session.beats.filter((b) => b.breathPhase === 'holdEmpty');
    expect(inBeats).toHaveLength(6);
    expect(holdBeats).toHaveLength(6);
    expect(outBeats).toHaveLength(6);
    expect(holdEmptyBeats).toHaveLength(6);
  });

  it('every breathing phase is exactly 4 seconds — box breathing is equal-count', () => {
    for (const beat of session.beats) {
      if (beat.breathPhase) expect(beat.durationSeconds).toBe(4);
    }
  });
});

describe('getGuidedSession', () => {
  it('finds a session by id', () => {
    expect(getGuidedSession('relax')?.name).toBe('Relax');
  });

  it('returns undefined for an unknown id', () => {
    expect(getGuidedSession('does-not-exist')).toBeUndefined();
  });
});

describe('totalDurationSeconds', () => {
  it('sums every beat', () => {
    const session = { beats: [{ durationSeconds: 3 }, { durationSeconds: 4.5 }] };
    expect(totalDurationSeconds(session)).toBe(7.5);
  });
});
