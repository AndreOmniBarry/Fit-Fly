import { describe, expect, it } from 'vitest';
import { estimateDistanceFromSteps, formatStepsDistance } from '../../../js/features/steps/steps-distance-estimate.js';

describe('estimateDistanceFromSteps', () => {
  it('returns null with no steps', () => {
    expect(estimateDistanceFromSteps({ steps: 0, heightCm: 170 })).toBeNull();
  });

  it('returns null with no profile height on file — never a fabricated number', () => {
    expect(estimateDistanceFromSteps({ steps: 6000, heightCm: undefined })).toBeNull();
    expect(estimateDistanceFromSteps({ steps: 6000, heightCm: null })).toBeNull();
  });

  it('estimates a real distance from a real height and step count', () => {
    const result = estimateDistanceFromSteps({ steps: 6000, heightCm: 170 });
    expect(result).not.toBeNull();
    // stride = 1.70m * 0.414 = 0.7038m; 6000 steps -> 4222.8m
    expect(result.meters).toBeCloseTo(4222.8, 1);
    expect(result.method).toBe('height-stride-formula');
  });

  it('a taller person walks farther for the same step count', () => {
    const shorter = estimateDistanceFromSteps({ steps: 6000, heightCm: 150 });
    const taller = estimateDistanceFromSteps({ steps: 6000, heightCm: 190 });
    expect(taller.meters).toBeGreaterThan(shorter.meters);
  });
});

describe('formatStepsDistance', () => {
  it('formats sub-kilometer distances in meters', () => {
    expect(formatStepsDistance(850)).toBe('~850 m walked today');
  });

  it('formats kilometer-plus distances with one decimal', () => {
    expect(formatStepsDistance(4222.8)).toBe('~4.2 km walked today');
  });
});
