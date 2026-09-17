import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// voice-guide.ts's own job is deciding which of two engines actually
// speaks — this is exactly the class of behavior that went unverified
// before Kokoro's removal (see f130aaa), so piper-voice.js is mocked
// here to drive both the "Piper works" and "Piper fails" paths without
// a real model/WASM runtime. speak()/stopSpeaking() are the only two
// exports every real caller (guided-session-view.ts, Settings) touches.
const piperMock = vi.hoisted(() => ({
  ensurePiperLoaded: vi.fn(),
  isPiperReady: vi.fn(() => false),
  speakWithPiper: vi.fn(),
  stopPiperSpeaking: vi.fn(),
}));
vi.mock('../../../js/features/focus/piper-voice.js', () => piperMock);

// getSpeechSynthesis() (voice-guide.ts) reads window.speechSynthesis, not
// a bare global — and this project's unit tests run in plain Node (see
// vitest.config.js), which has no `window` at all, so it has to be
// stubbed too, not just speechSynthesis itself.
function installFakeSpeechSynthesis() {
  const utterances = [];
  const fakeSynth = {
    speaking: false,
    speak: vi.fn((utterance) => {
      utterances.push(utterance);
      fakeSynth.speaking = true;
    }),
    cancel: vi.fn(() => {
      fakeSynth.speaking = false;
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
  };
  vi.stubGlobal('window', { speechSynthesis: fakeSynth });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(text) {
        this.text = text;
      }
    }
  );
  return { fakeSynth, utterances };
}

async function freshModule() {
  vi.resetModules();
  piperMock.ensurePiperLoaded.mockReset().mockResolvedValue(undefined);
  piperMock.isPiperReady.mockReset().mockReturnValue(false);
  piperMock.speakWithPiper.mockReset().mockResolvedValue(undefined);
  piperMock.stopPiperSpeaking.mockReset();
  return import('../../../js/features/focus/voice-guide.js');
}

describe('voice-guide: engine selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('speaks the very first line through Web Speech while Piper warms up in the background', async () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const { speak } = await freshModule();
    piperMock.isPiperReady.mockReturnValue(false); // hasn't finished loading yet

    speak('breathe in');

    expect(fakeSynth.speak).toHaveBeenCalled();
    expect(piperMock.speakWithPiper).not.toHaveBeenCalled();
    expect(piperMock.ensurePiperLoaded).toHaveBeenCalledTimes(1); // warm-up kicked off exactly once
  });

  it('only kicks off the Piper warm-up once across many speak() calls', async () => {
    installFakeSpeechSynthesis();
    const { speak } = await freshModule();

    speak('one');
    speak('two');
    speak('three');

    expect(piperMock.ensurePiperLoaded).toHaveBeenCalledTimes(1);
  });

  it('uses Piper once it reports ready, instead of Web Speech', async () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const { speak } = await freshModule();
    piperMock.isPiperReady.mockReturnValue(true);

    speak('hold');
    await Promise.resolve();

    expect(piperMock.speakWithPiper).toHaveBeenCalledWith('hold');
    expect(fakeSynth.speak).not.toHaveBeenCalled();
  });

  it('falls back to Web Speech, silently, the moment speakWithPiper() rejects mid-session', async () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const { speak } = await freshModule();
    piperMock.isPiperReady.mockReturnValue(true);
    piperMock.speakWithPiper.mockRejectedValue(new Error('inference crashed'));

    expect(() => speak('exhale')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(fakeSynth.speak).toHaveBeenCalled(); // fell back for this line
  });

  it('stops using Piper for the rest of the session after one runtime failure, not just the failing line', async () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const { speak } = await freshModule();
    piperMock.isPiperReady.mockReturnValue(true);
    piperMock.speakWithPiper.mockRejectedValueOnce(new Error('inference crashed'));

    speak('line one'); // Piper fails on this one
    await Promise.resolve();
    await Promise.resolve();
    fakeSynth.speak.mockClear();
    piperMock.speakWithPiper.mockClear();

    speak('line two'); // should go straight to Web Speech, no retry

    expect(piperMock.speakWithPiper).not.toHaveBeenCalled();
    expect(fakeSynth.speak).toHaveBeenCalled();
  });

  it('never throws out of speak() even if everything underneath is unavailable', async () => {
    vi.stubGlobal('window', {}); // no speechSynthesis at all
    const { speak } = await freshModule();
    piperMock.isPiperReady.mockReturnValue(false);

    expect(() => speak('anything')).not.toThrow();
  });

  it('stopSpeaking() stops both engines, not just whichever is guessed active', async () => {
    const { fakeSynth } = installFakeSpeechSynthesis();
    const { stopSpeaking } = await freshModule();

    stopSpeaking();

    expect(piperMock.stopPiperSpeaking).toHaveBeenCalledTimes(1);
    expect(fakeSynth.cancel).toHaveBeenCalledTimes(1);
  });
});
