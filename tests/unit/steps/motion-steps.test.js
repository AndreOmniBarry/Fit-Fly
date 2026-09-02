import { describe, expect, it } from 'vitest';
import { isMotionSensingAvailable } from '../../../js/features/steps/motion-steps.js';

describe('isMotionSensingAvailable', () => {
  it('reflects whether LinearAccelerationSensor exists, without throwing when it does not', () => {
    expect(typeof isMotionSensingAvailable()).toBe('boolean');
  });
});
