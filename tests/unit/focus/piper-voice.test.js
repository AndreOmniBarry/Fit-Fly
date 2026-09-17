import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// piper-voice.ts imports the real vendored library statically — mocked
// here so these tests exercise this module's own init/fallback/token
// logic without ever touching the real ~99MB model or a WASM runtime
// (see js/vendor/piper/piper-tts-web.d.ts for the real shape this mock
// stands in for).
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock('../../../js/vendor/piper/piper-tts-web.js', () => ({
  TtsSession: { create: mockCreate },
}));

// No DOM in this project's unit-test environment (see vitest.config.js)
// — a fake Audio element is enough surface for playBlob()'s own logic
// (play() promise, 'ended'/'error' events) without pulling in jsdom for
// one module. Every instance is tracked so tests can drive its events.
class FakeAudio {
  constructor(url) {
    this.url = url;
    this.paused = true;
    this.currentTime = 0;
    this._listeners = {};
    this._playResult = FakeAudio.nextPlayResult ?? Promise.resolve();
    FakeAudio.nextPlayResult = null;
    FakeAudio.instances.push(this);
  }
  addEventListener(type, cb) {
    this._listeners[type] = cb;
  }
  play() {
    this.paused = false;
    return this._playResult;
  }
  pause() {
    this.paused = true;
  }
  fireEnded() {
    this._listeners.ended?.();
  }
  fireError() {
    this._listeners.error?.();
  }
}
FakeAudio.instances = [];
FakeAudio.nextPlayResult = null;

async function freshModule() {
  vi.resetModules();
  mockCreate.mockReset();
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
  // Patch the real URL constructor in place rather than replacing the
  // global outright — module resolution itself (Vite's runner) relies on
  // the real `new URL(...)`, so swapping it for a plain object breaks
  // dynamic import, not just this module's own createObjectURL() calls.
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  return import('../../../js/features/focus/piper-voice.js');
}

describe('piper-voice: loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not ready before ensurePiperLoaded() resolves', async () => {
    const { isPiperReady } = await freshModule();
    expect(isPiperReady()).toBe(false);
  });

  it('becomes ready once TtsSession.create() resolves', async () => {
    const { ensurePiperLoaded, isPiperReady, didPiperLoadFail } = await freshModule();
    mockCreate.mockResolvedValue({ predict: vi.fn() });

    await ensurePiperLoaded();

    expect(isPiperReady()).toBe(true);
    expect(didPiperLoadFail()).toBe(false);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceId: 'en_US-ljspeech-medium',
        wasmPaths: expect.objectContaining({
          onnxWasm: expect.any(String),
          piperData: expect.any(String),
          piperWasm: expect.any(String),
        }),
      })
    );
  });

  it('every caller shares the same in-flight load — TtsSession.create() is called once', async () => {
    const { ensurePiperLoaded } = await freshModule();
    let resolveCreate;
    mockCreate.mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));

    const first = ensurePiperLoaded();
    const second = ensurePiperLoaded();
    resolveCreate({ predict: vi.fn() });
    await Promise.all([first, second]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('reports a real failure honestly instead of resolving half-loaded', async () => {
    const { ensurePiperLoaded, isPiperReady, didPiperLoadFail } = await freshModule();
    mockCreate.mockRejectedValue(new Error('WASM not supported'));

    await expect(ensurePiperLoaded()).rejects.toThrow('WASM not supported');

    expect(isPiperReady()).toBe(false);
    expect(didPiperLoadFail()).toBe(true);
  });

  it('a failed load can be retried from scratch by a later call', async () => {
    const { ensurePiperLoaded, isPiperReady } = await freshModule();
    mockCreate.mockRejectedValueOnce(new Error('first try fails'));
    await expect(ensurePiperLoaded()).rejects.toThrow();

    mockCreate.mockResolvedValueOnce({ predict: vi.fn() });
    await ensurePiperLoaded();

    expect(isPiperReady()).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

describe('piper-voice: speaking', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects if speakWithPiper() is called before the session has loaded', async () => {
    const { speakWithPiper } = await freshModule();
    await expect(speakWithPiper('hello')).rejects.toThrow(/not loaded/i);
  });

  it('plays the predicted audio through a plain <audio> element and resolves once it actually ends', async () => {
    const fakeBlob = { size: 4 };
    const predict = vi.fn().mockResolvedValue(fakeBlob);
    const { ensurePiperLoaded, speakWithPiper } = await freshModule();
    mockCreate.mockResolvedValue({ predict });
    await ensurePiperLoaded();

    const done = speakWithPiper('breathe in');
    // Let playBlob() construct its Audio element before driving it.
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.instances).toHaveLength(1);
    const audio = FakeAudio.instances[0];
    expect(audio.paused).toBe(false); // play() was actually called
    audio.fireEnded();

    await expect(done).resolves.toBeUndefined();
    expect(predict).toHaveBeenCalledWith('breathe in');
  });

  it('rejects if inference itself fails', async () => {
    const predict = vi.fn().mockRejectedValue(new Error('inference blew up'));
    const { ensurePiperLoaded, speakWithPiper } = await freshModule();
    mockCreate.mockResolvedValue({ predict });
    await ensurePiperLoaded();

    await expect(speakWithPiper('hello')).rejects.toThrow('inference blew up');
  });

  it('rejects if the <audio> element itself fires an error, never resolving on a half-played clip', async () => {
    const predict = vi.fn().mockResolvedValue({ size: 1 });
    const { ensurePiperLoaded, speakWithPiper } = await freshModule();
    mockCreate.mockResolvedValue({ predict });
    await ensurePiperLoaded();

    const done = speakWithPiper('hello');
    await Promise.resolve();
    await Promise.resolve();
    FakeAudio.instances[0].fireError();

    await expect(done).rejects.toThrow(/playback failed/i);
  });

  it('rejects if play() itself rejects (autoplay policy, decode failure, ...)', async () => {
    const predict = vi.fn().mockResolvedValue({ size: 1 });
    const { ensurePiperLoaded, speakWithPiper } = await freshModule();
    mockCreate.mockResolvedValue({ predict });
    await ensurePiperLoaded();

    FakeAudio.nextPlayResult = Promise.reject(new Error('NotAllowedError'));
    await expect(speakWithPiper('hello')).rejects.toThrow('NotAllowedError');
  });

  it('a newer speakWithPiper() call supersedes an older one instead of letting both play', async () => {
    const predict = vi.fn().mockResolvedValue({ size: 1 });
    const { ensurePiperLoaded, speakWithPiper } = await freshModule();
    mockCreate.mockResolvedValue({ predict });
    await ensurePiperLoaded();

    const first = speakWithPiper('line one');
    const second = speakWithPiper('line two');
    await Promise.resolve();
    await Promise.resolve();
    // The first call is superseded before it ever gets to play — only
    // the second line's audio should actually exist and play.
    expect(FakeAudio.instances).toHaveLength(1);
    for (const audio of FakeAudio.instances) audio.fireEnded();

    await Promise.all([first, second]);
    expect(FakeAudio.instances.at(-1).paused).toBe(false);
  });

  it('stopPiperSpeaking() pauses whatever is currently playing', async () => {
    const predict = vi.fn().mockResolvedValue({ size: 1 });
    const { ensurePiperLoaded, speakWithPiper, stopPiperSpeaking } = await freshModule();
    mockCreate.mockResolvedValue({ predict });
    await ensurePiperLoaded();

    void speakWithPiper('hello');
    await Promise.resolve();
    await Promise.resolve();
    const audio = FakeAudio.instances[0];
    expect(audio.paused).toBe(false);

    stopPiperSpeaking();

    expect(audio.paused).toBe(true);
  });
});
