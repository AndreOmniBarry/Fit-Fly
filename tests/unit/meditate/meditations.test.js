import { describe, expect, it } from 'vitest';
import {
  ALL_MEDITATE_SESSIONS,
  BREATHWORK,
  MEDITATIONS,
  getMeditateSession,
} from '../../../js/features/meditate/meditations.js';
import { totalDurationSeconds } from '../../../js/lib/guided-session.js';

describe('MEDITATIONS + BREATHWORK catalog', () => {
  it('has a genuinely broad library — 10 meditations, 2 breathwork techniques', () => {
    expect(MEDITATIONS).toHaveLength(10);
    expect(BREATHWORK).toHaveLength(2);
    expect(ALL_MEDITATE_SESSIONS).toHaveLength(12);
  });

  it('every id is unique across the whole library', () => {
    const ids = ALL_MEDITATE_SESSIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every session has at least one beat and real name/description/basis', () => {
    for (const s of ALL_MEDITATE_SESSIONS) {
      expect(s.beats.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.basis.length).toBeGreaterThan(0);
    }
  });

  it('every beat has non-empty text and a positive duration', () => {
    for (const s of ALL_MEDITATE_SESSIONS) {
      for (const beat of s.beats) {
        expect(beat.text.trim().length).toBeGreaterThan(0);
        expect(beat.durationSeconds).toBeGreaterThan(0);
      }
    }
  });

  it('every session stays in a real, sittable range — at least 45s, no more than 6 minutes', () => {
    // Quick Reset is the deliberate exception — it has its own speed
    // assertion below — every other session should hold a real sit.
    for (const s of ALL_MEDITATE_SESSIONS) {
      if (s.id === 'quick-reset') continue;
      const total = totalDurationSeconds(s);
      expect(total).toBeGreaterThanOrEqual(45);
      expect(total).toBeLessThanOrEqual(360);
    }
  });

  it("the Quick Reset genuinely is quick — under 30 seconds", () => {
    const session = getMeditateSession('quick-reset');
    expect(totalDurationSeconds(session)).toBeLessThan(30);
  });

  it('descriptions and beat text avoid diagnostic/clinical framing — these offer a technique, never suggest a diagnosis', () => {
    // Emotion words themselves (sadness, anger, grief, anxiety as a
    // feeling) are deliberately fine — the ban is on clinical/diagnostic
    // vocabulary, not on naming what someone might be feeling.
    const bannedWords = /overthink|depress|disorder|\btherapy\b|\bpatient\b|diagnos|treatment/i;
    for (const s of ALL_MEDITATE_SESSIONS) {
      expect(s.description).not.toMatch(bannedWords);
      for (const beat of s.beats) {
        expect(beat.text).not.toMatch(bannedWords);
      }
    }
  });

  it('each basis cites a real, specific technique, not a vague label', () => {
    for (const s of ALL_MEDITATE_SESSIONS) {
      expect(s.basis.length).toBeGreaterThan(20); // a real citation, not a one-word stub
    }
  });
});

describe('4-7-8 Breathing: real 4-7-8 structure', () => {
  const session = getMeditateSession('four-seven-eight');

  it('has four full cycles', () => {
    const inBeats = session.beats.filter((b) => b.breathPhase === 'in');
    const holdBeats = session.beats.filter((b) => b.breathPhase === 'hold');
    const outBeats = session.beats.filter((b) => b.breathPhase === 'out');
    expect(inBeats).toHaveLength(4);
    expect(holdBeats).toHaveLength(4);
    expect(outBeats).toHaveLength(4);
  });

  it('every cycle is exactly 4 in / 7 hold / 8 out', () => {
    const breathingBeats = session.beats.filter((b) => b.breathPhase);
    for (let i = 0; i < breathingBeats.length; i += 3) {
      expect(breathingBeats[i].breathPhase).toBe('in');
      expect(breathingBeats[i].durationSeconds).toBe(4);
      expect(breathingBeats[i + 1].breathPhase).toBe('hold');
      expect(breathingBeats[i + 1].durationSeconds).toBe(7);
      expect(breathingBeats[i + 2].breathPhase).toBe('out');
      expect(breathingBeats[i + 2].durationSeconds).toBe(8);
    }
  });
});

describe('Physiological Sigh: real double-inhale structure', () => {
  const session = getMeditateSession('physiological-sigh');

  it('has six cycles, each two "in" beats followed by one long "out"', () => {
    const breathingBeats = session.beats.filter((b) => b.breathPhase);
    expect(breathingBeats).toHaveLength(18); // 6 cycles x 3 beats
    for (let i = 0; i < breathingBeats.length; i += 3) {
      expect(breathingBeats[i].breathPhase).toBe('in');
      expect(breathingBeats[i + 1].breathPhase).toBe('in'); // the second, shorter top-up inhale
      expect(breathingBeats[i + 2].breathPhase).toBe('out');
      expect(breathingBeats[i + 2].durationSeconds).toBeGreaterThan(breathingBeats[i].durationSeconds); // exhale is the long part
    }
  });
});

describe('getMeditateSession', () => {
  it('finds a session by id', () => {
    expect(getMeditateSession('gratitude')?.name).toBe('A Gratitude Practice');
  });

  it('returns undefined for an unknown id', () => {
    expect(getMeditateSession('does-not-exist')).toBeUndefined();
  });
});
