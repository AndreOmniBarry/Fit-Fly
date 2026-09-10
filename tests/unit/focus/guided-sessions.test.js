import { describe, expect, it } from 'vitest';
import { GUIDED_SESSIONS, getGuidedSession, totalDurationSeconds } from '../../../js/features/focus/guided-sessions.js';

describe('GUIDED_SESSIONS catalog', () => {
  it('has every session asked for, including the sport-specific ones', () => {
    const ids = GUIDED_SESSIONS.map((s) => s.id).sort();
    expect(ids).toEqual(
      [
        'breathing-focus',
        'focus',
        'relax',
        'sleep-focus',
        'swim-breath',
        'marathon-breath',
        'cardio-depth-breath',
      ].sort()
    );
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

describe("Swimmer's Breath: quick-in, long-steady-out rhythm", () => {
  const session = getGuidedSession('swim-breath');

  it('every inhale is quick and every exhale is longer — the real bilateral-breathing ratio', () => {
    const inBeats = session.beats.filter((b) => b.breathPhase === 'in');
    const outBeats = session.beats.filter((b) => b.breathPhase === 'out');
    expect(inBeats.length).toBeGreaterThan(0);
    expect(inBeats).toHaveLength(outBeats.length);
    for (const beat of inBeats) expect(beat.durationSeconds).toBeLessThan(outBeats[0].durationSeconds);
  });

  it('never mentions holding the breath — a real shallow-water-blackout risk, not a dryland drill', () => {
    for (const beat of session.beats) expect(beat.text.toLowerCase()).not.toMatch(/hold your breath|breath.?hold/);
  });
});

describe('Marathon Pacing Breath: 3:2 rhythmic-breathing structure', () => {
  const session = getGuidedSession('marathon-breath');

  it('every inhale is exactly 3 counts and every exhale exactly 2 — the real odd-count ratio', () => {
    const inBeats = session.beats.filter((b) => b.breathPhase === 'in');
    const outBeats = session.beats.filter((b) => b.breathPhase === 'out');
    expect(inBeats.length).toBeGreaterThan(0);
    expect(inBeats).toHaveLength(outBeats.length);
    for (const beat of inBeats) expect(beat.durationSeconds).toBe(3);
    for (const beat of outBeats) expect(beat.durationSeconds).toBe(2);
  });
});

describe('Cardio Depth Training: diaphragmatic breathing with an extended exhale', () => {
  const session = getGuidedSession('cardio-depth-breath');

  it('every exhale is longer than the matching inhale — a real extended-exhale ratio, not equal counts', () => {
    const inBeats = session.beats.filter((b) => b.breathPhase === 'in');
    const outBeats = session.beats.filter((b) => b.breathPhase === 'out');
    expect(inBeats.length).toBeGreaterThan(0);
    expect(inBeats).toHaveLength(outBeats.length);
    for (let i = 0; i < inBeats.length; i++) expect(outBeats[i].durationSeconds).toBeGreaterThan(inBeats[i].durationSeconds);
  });

  it('never claims a measured fitness outcome (VO2 max, performance) this app has no way to measure', () => {
    const bannedClaims = /vo2|performance improve|increase(s)? your (fitness|endurance)/i;
    expect(session.description).not.toMatch(bannedClaims);
    for (const beat of session.beats) expect(beat.text).not.toMatch(bannedClaims);
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
