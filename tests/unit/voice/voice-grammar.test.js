import { describe, expect, it } from 'vitest';
import { matchVoiceCommand, VOICE_COMMANDS } from '../../../js/features/voice/voice-grammar.js';

describe('matchVoiceCommand: exact phrases', () => {
  it('matches every listed phrase for every command', () => {
    for (const command of VOICE_COMMANDS) {
      for (const phrase of command.phrases) {
        expect(matchVoiceCommand(phrase)?.commandId).toBe(command.id);
      }
    }
  });

  it('is case-insensitive', () => {
    expect(matchVoiceCommand('START TIMER')?.commandId).toBe('start-rest-timer');
    expect(matchVoiceCommand('Start Timer')?.commandId).toBe('start-rest-timer');
  });

  it('ignores punctuation and extra whitespace', () => {
    expect(matchVoiceCommand('start timer!')?.commandId).toBe('start-rest-timer');
    expect(matchVoiceCommand('  start   timer  ')?.commandId).toBe('start-rest-timer');
  });
});

describe('matchVoiceCommand: lenient in-order matching', () => {
  it('tolerates a leading filler word', () => {
    expect(matchVoiceCommand('hey start timer')?.commandId).toBe('start-rest-timer');
    expect(matchVoiceCommand('ok go home')?.commandId).toBe('go-home');
  });

  it('tolerates a trailing filler word', () => {
    expect(matchVoiceCommand('start timer please')?.commandId).toBe('start-rest-timer');
  });

  it('still requires the command words in the right relative order', () => {
    // "timer start" is backwards — not a real match for "start timer"
    expect(matchVoiceCommand('timer start')).toBeNull();
  });

  it('picks the more specific (longer) phrase when more than one could match', () => {
    // "start the timer" contains the words of "start timer" too, but
    // "start the timer" itself is a listed, more specific phrase.
    const result = matchVoiceCommand('start the timer');
    expect(result.matchedPhrase).toBe('start the timer');
  });
});

describe('matchVoiceCommand: refuses to guess on unrelated speech', () => {
  it('returns null for unrelated text', () => {
    expect(matchVoiceCommand('what is the weather today')).toBeNull();
    expect(matchVoiceCommand('turn off the lights')).toBeNull();
  });

  it('returns null for empty/whitespace-only/missing input', () => {
    expect(matchVoiceCommand('')).toBeNull();
    expect(matchVoiceCommand('   ')).toBeNull();
    expect(matchVoiceCommand(undefined)).toBeNull();
  });

  it('a partial, incomplete phrase does not match', () => {
    expect(matchVoiceCommand('start')).toBeNull();
    expect(matchVoiceCommand('log')).toBeNull();
  });
});

describe('VOICE_COMMANDS: grammar integrity', () => {
  it('every command has at least one phrase, and every phrase is non-empty', () => {
    for (const command of VOICE_COMMANDS) {
      expect(command.phrases.length).toBeGreaterThan(0);
      for (const phrase of command.phrases) {
        expect(phrase.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('no two commands share an identical phrase (that would be ambiguous)', () => {
    const allPhrases = VOICE_COMMANDS.flatMap((c) => c.phrases.map((p) => p.toLowerCase()));
    expect(new Set(allPhrases).size).toBe(allPhrases.length);
  });

  it('command ids are unique', () => {
    const ids = VOICE_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
