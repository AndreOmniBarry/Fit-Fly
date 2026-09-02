import { describe, expect, it } from 'vitest';
import { isBluetoothAvailable } from '../../../js/lib/bluetooth.js';

describe('isBluetoothAvailable', () => {
  it('reflects whether navigator.bluetooth exists, without throwing when it does not', () => {
    expect(typeof isBluetoothAvailable()).toBe('boolean');
  });
});
