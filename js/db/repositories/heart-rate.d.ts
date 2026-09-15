// Sidecar types for heart-rate.js (hand-written JS, untouched — see
// tsconfig.json).
export interface HeartRateSample {
  id: number;
  bpm: number;
  source: 'camera-ppg' | 'manual' | 'ble';
  confidence: string | null;
  sessionId: string | null;
  /** Real RMSSD (ms) from a connected BLE strap's own RR-intervals (see
   *  js/features/heart-rate/hrv.js) — null for every non-BLE source, and
   *  null for most individual BLE samples too (see heart-rate-view.js:
   *  only set once per live session, on disconnect, never fabricated or
   *  backfilled from a bare bpm). */
  rmssdMs: number | null;
  recordedAt: string;
}

export const HR_SOURCE: {
  CAMERA_PPG: 'camera-ppg';
  MANUAL: 'manual';
  BLE: 'ble';
};

export function recordHeartRateSample(
  sample: {
    bpm: number;
    source: HeartRateSample['source'];
    confidence?: string | null;
    sessionId?: string | null;
    rmssdMs?: number | null;
  },
  db?: unknown
): Promise<HeartRateSample>;

export function listRecentHeartRateSamples(limit?: number, db?: unknown): Promise<HeartRateSample[]>;

export function listHeartRateSamplesBySource(source: HeartRateSample['source'], db?: unknown): Promise<HeartRateSample[]>;
