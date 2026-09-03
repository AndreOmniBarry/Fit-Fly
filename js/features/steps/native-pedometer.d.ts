// Sidecar types for native-pedometer.js (hand-written JS, untouched —
// see tsconfig.json).
export type NativeStepPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export function isNativeStepCounterAvailable(): boolean;
export function getNativeStepPermission(): Promise<NativeStepPermissionState>;
export function requestNativeStepPermission(): Promise<NativeStepPermissionState>;
export function startNativeBackgroundStepCounting(): Promise<void>;
export function stopNativeBackgroundStepCounting(): Promise<void>;
export function getNativeTodayStepCount(): Promise<{ steps: number; hasReading: boolean }>;
export function onNativeStepCountChanged(callback: (steps: number) => void): () => void;
