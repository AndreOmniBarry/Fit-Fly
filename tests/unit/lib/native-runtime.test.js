import { describe, expect, it, afterEach } from 'vitest';
import { isNativeRuntime } from '../../../js/lib/native-runtime.js';

describe('isNativeRuntime', () => {
  afterEach(() => {
    delete globalThis.window;
  });

  it('is false with no window at all (this test environment, same as any plain server context)', () => {
    expect(isNativeRuntime()).toBe(false);
  });

  it('is false in a plain browser tab or installed PWA — no Capacitor global present', () => {
    globalThis.window = {};
    expect(isNativeRuntime()).toBe(false);
  });

  it('is false when Capacitor is present but reports itself as not-native (a Capacitor-served web build)', () => {
    globalThis.window = { Capacitor: { isNativePlatform: () => false } };
    expect(isNativeRuntime()).toBe(false);
  });

  it('is true only once actually wrapped and Capacitor confirms a native platform', () => {
    globalThis.window = { Capacitor: { isNativePlatform: () => true } };
    expect(isNativeRuntime()).toBe(true);
  });
});
