import { describe, expect, it } from 'vitest';
import { aggregateProgress, breathPauseMs } from '../../../js/features/focus/kokoro-voice.js';

describe('aggregateProgress', () => {
  it('reports 0% before any file has reported a total', () => {
    const byFile = new Map();
    const result = aggregateProgress(byFile, { status: 'initiate', file: 'tokenizer.json' });
    expect(result).toEqual({ percent: 0, file: 'tokenizer.json' });
  });

  it('derives one overall percent from a single file mid-download', () => {
    const byFile = new Map();
    const result = aggregateProgress(byFile, {
      status: 'progress',
      file: 'model.onnx',
      loaded: 25,
      total: 100,
    });
    expect(result).toEqual({ percent: 25, file: 'model.onnx' });
  });

  it('sums real loaded/total bytes across every file seen so far, not per-file percentages', () => {
    const byFile = new Map();
    // A small file finishes first...
    aggregateProgress(byFile, { status: 'progress', file: 'tokenizer.json', loaded: 100, total: 100 });
    // ...while a much larger file is still only 10% in — the honest
    // aggregate should be dominated by real byte counts, not a naive
    // average of "100%" and "10%" (which would wrongly read as 55%).
    const result = aggregateProgress(byFile, { status: 'progress', file: 'model.onnx', loaded: 100, total: 900 });
    expect(result.percent).toBe(20); // (100 + 100) / (100 + 900) = 20%
  });

  it('keeps folding in later updates for a file already seen, not double-counting it', () => {
    const byFile = new Map();
    aggregateProgress(byFile, { status: 'progress', file: 'model.onnx', loaded: 100, total: 900 });
    const result = aggregateProgress(byFile, { status: 'progress', file: 'model.onnx', loaded: 900, total: 900 });
    expect(result.percent).toBe(100);
  });

  it('reaches exactly 100% once every known file is fully loaded', () => {
    const byFile = new Map();
    aggregateProgress(byFile, { status: 'progress', file: 'a.bin', loaded: 50, total: 50 });
    const result = aggregateProgress(byFile, { status: 'progress', file: 'b.bin', loaded: 50, total: 50 });
    expect(result.percent).toBe(100);
  });

  it('ignores a "done" event with no loaded/total of its own, keeping the last real numbers', () => {
    const byFile = new Map();
    aggregateProgress(byFile, { status: 'progress', file: 'model.onnx', loaded: 50, total: 100 });
    const result = aggregateProgress(byFile, { status: 'done', file: 'model.onnx' });
    expect(result).toEqual({ percent: 50, file: 'model.onnx' });
  });
});

describe('breathPauseMs', () => {
  it('is a real, positive pause at normal speed', () => {
    expect(breathPauseMs(1)).toBeGreaterThan(0);
  });

  it('lengthens the pause for a slower, more deliberate delivery', () => {
    expect(breathPauseMs(0.8)).toBeGreaterThan(breathPauseMs(1));
  });

  it('shortens the pause for a brisker delivery', () => {
    expect(breathPauseMs(1.3)).toBeLessThan(breathPauseMs(1));
  });

  it('clamps extreme speeds rather than producing an absurd pause', () => {
    // A near-zero or huge speed shouldn't blow the pause up or collapse
    // it to nothing — it's clamped to the same sane [0.5, 1.5] range
    // speak() itself is expected to pass real speeds within.
    expect(breathPauseMs(0.01)).toBe(breathPauseMs(0.5));
    expect(breathPauseMs(50)).toBe(breathPauseMs(1.5));
  });
});
