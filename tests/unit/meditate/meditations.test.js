import { describe, expect, it } from 'vitest';
import {
  ALL_MEDITATE_SESSIONS,
  BREATHWORK,
  MEDITATIONS,
  MEDITATE_CATEGORIES,
  getMeditateSession,
} from '../../../js/features/meditate/meditations.js';
import { totalDurationSeconds } from '../../../js/lib/guided-session.js';

describe('MEDITATIONS + BREATHWORK catalog', () => {
  it('has a genuinely broad library — 13 meditations, 3 breathwork techniques', () => {
    expect(MEDITATIONS).toHaveLength(13);
    expect(BREATHWORK).toHaveLength(3);
    expect(ALL_MEDITATE_SESSIONS).toHaveLength(16);
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

describe('MEDITATE_CATEGORIES: real, distinct techniques/use-cases, not interchangeable reskins', () => {
  it('covers every session exactly once, across five real categories', () => {
    expect(MEDITATE_CATEGORIES.map((c) => c.id)).toEqual(['stress', 'connection', 'focus', 'sleep', 'breathwork']);
    const seen = MEDITATE_CATEGORIES.flatMap((c) => c.sessions.map((s) => s.id));
    expect(seen.sort()).toEqual(ALL_MEDITATE_SESSIONS.map((s) => s.id).sort());
    // every category actually has at least one session — no empty bucket
    for (const c of MEDITATE_CATEGORIES) expect(c.sessions.length).toBeGreaterThan(0);
  });

  it('every session in a category is tagged with that category', () => {
    for (const c of MEDITATE_CATEGORIES) {
      for (const s of c.sessions) expect(s.category).toBe(c.id);
    }
  });

  it('every category has a real label and description, not a placeholder', () => {
    for (const c of MEDITATE_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(3);
      expect(c.description.length).toBeGreaterThan(10);
    }
  });

  it('sleep prep is a distinct category from breathwork and general focus', () => {
    const sleep = MEDITATE_CATEGORIES.find((c) => c.id === 'sleep');
    expect(sleep.sessions.map((s) => s.id)).toContain('sleep-wind-down');
    expect(sleep.sessions.map((s) => s.id)).not.toContain('box-breathing');
  });
});

describe('Full Body Scan: real MBSR body-scan structure', () => {
  const session = getMeditateSession('body-scan');

  it('exists, cites Kabat-Zinn/MBSR, and is categorized as focus', () => {
    expect(session).toBeDefined();
    expect(session.basis).toMatch(/MBSR|Kabat-Zinn/);
    expect(session.category).toBe('focus');
  });

  it('moves sequentially through real body regions, not a vague "relax" script', () => {
    const text = session.beats.map((b) => b.text).join(' ').toLowerCase();
    for (const region of ['foot', 'knee', 'hips', 'belly', 'hands', 'shoulders', 'neck', 'face']) {
      expect(text).toContain(region);
    }
  });
});

describe('Wind-Down for Sleep: real Progressive Muscle Relaxation structure', () => {
  const session = getMeditateSession('sleep-wind-down');

  it('exists, cites Jacobson/PMR, and is categorized as sleep', () => {
    expect(session).toBeDefined();
    expect(session.basis).toMatch(/Jacobson|Progressive Muscle Relaxation/);
    expect(session.category).toBe('sleep');
  });

  it('has a real tense/release pattern across multiple muscle groups', () => {
    const text = session.beats.map((b) => b.text).join(' ').toLowerCase();
    expect(text).toMatch(/squeeze/);
    expect(text).toMatch(/release/);
    // covers a real spread of muscle groups, not one generic "your body"
    for (const group of ['toes', 'calves', 'fists', 'shoulders', 'face']) {
      expect(text).toContain(group);
    }
  });

  it('stays a plausible pre-sleep length', () => {
    const total = totalDurationSeconds(session);
    expect(total).toBeGreaterThanOrEqual(60);
    expect(total).toBeLessThanOrEqual(420);
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

describe('Loving-Kindness: distinct from self-compassion — directed outward, in stages', () => {
  const session = getMeditateSession('loving-kindness');

  it('exists and cites the metta tradition plus its own evidence base', () => {
    expect(session).toBeDefined();
    expect(session.basis).toMatch(/metta/i);
    expect(session.basis).toMatch(/Fredrickson/);
  });

  it('progresses through all four traditional stages: self, loved one, neutral person, everyone', () => {
    const text = session.beats.map((b) => b.text).join(' ').toLowerCase();
    expect(text).toContain('may i be safe'); // self
    expect(text).toContain('someone you care about'); // loved one
    expect(text).toContain('neutral'); // neutral person
    expect(text).toContain('all beings'); // everyone
  });
});

describe('Box Breathing: real 4-4-4-4 structure', () => {
  const session = getMeditateSession('box-breathing');

  it('has five full cycles of four equal-length phases', () => {
    const breathingBeats = session.beats.filter((b) => b.breathPhase);
    expect(breathingBeats).toHaveLength(20); // 5 cycles x 4 beats
    for (const beat of breathingBeats) {
      expect(beat.durationSeconds).toBe(4);
    }
  });

  it('each cycle runs in / hold / out / holdEmpty, in order', () => {
    const breathingBeats = session.beats.filter((b) => b.breathPhase);
    for (let i = 0; i < breathingBeats.length; i += 4) {
      expect(breathingBeats[i].breathPhase).toBe('in');
      expect(breathingBeats[i + 1].breathPhase).toBe('hold');
      expect(breathingBeats[i + 2].breathPhase).toBe('out');
      expect(breathingBeats[i + 3].breathPhase).toBe('holdEmpty');
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
