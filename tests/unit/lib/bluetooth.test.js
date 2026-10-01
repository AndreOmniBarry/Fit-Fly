import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../js/lib/native-runtime.js', () => ({
  isNativeRuntime: vi.fn(() => false),
}));
vi.mock('../../../js/vendor/ble/bleClient.js', () => ({
  BleClient: {
    initialize: vi.fn(() => Promise.resolve()),
    requestDevice: vi.fn(() => Promise.resolve({ deviceId: 'device-1' })),
    connect: vi.fn(() => Promise.resolve()),
    startNotifications: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
  },
}));

const { isNativeRuntime } = await import('../../../js/lib/native-runtime.js');
const { BleClient } = await import('../../../js/vendor/ble/bleClient.js');
const { connectBleCharacteristic, isBluetoothAvailable, sig16BitUuid } = await import('../../../js/lib/bluetooth.js');

afterEach(() => {
  vi.clearAllMocks();
  isNativeRuntime.mockReturnValue(false);
  delete globalThis.navigator;
});

describe('isBluetoothAvailable', () => {
  it('is false with neither a native runtime nor Web Bluetooth', () => {
    expect(isBluetoothAvailable()).toBe(false);
  });

  it('is true inside the native app shell, even with no navigator.bluetooth', () => {
    isNativeRuntime.mockReturnValue(true);
    expect(isBluetoothAvailable()).toBe(true);
  });

  it('is true when the plain browser exposes Web Bluetooth', () => {
    globalThis.navigator = { bluetooth: {} };
    expect(isBluetoothAvailable()).toBe(true);
  });
});

describe('sig16BitUuid', () => {
  it('expands a real Bluetooth SIG 16-bit assigned number to its full 128-bit form', () => {
    // Heart Rate service, 0x180D — a real, standard GATT UUID.
    expect(sig16BitUuid('180d')).toBe('0000180d-0000-1000-8000-00805f9b34fb');
  });

  it('lowercases the input', () => {
    expect(sig16BitUuid('2A37')).toBe('00002a37-0000-1000-8000-00805f9b34fb');
  });
});

describe('connectBleCharacteristic', () => {
  const serviceUuid = '0000180d-0000-1000-8000-00805f9b34fb';
  const characteristicUuid = '00002a37-0000-1000-8000-00805f9b34fb';

  it('fails honestly — never a fabricated connection — when Bluetooth is unavailable at all', async () => {
    const onError = vi.fn();
    const result = await connectBleCharacteristic({ serviceUuid, characteristicUuid, parse: vi.fn(), onError });
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(BleClient.requestDevice).not.toHaveBeenCalled();
  });

  it('wires a real connect/notify sequence: init, request the real service, connect, start notifications', async () => {
    isNativeRuntime.mockReturnValue(true);
    const onReading = vi.fn();
    const result = await connectBleCharacteristic({
      serviceUuid,
      characteristicUuid,
      parse: (dataView) => ({ raw: dataView }),
      onReading,
      onError: vi.fn(),
    });

    expect(BleClient.initialize).toHaveBeenCalled();
    expect(BleClient.requestDevice).toHaveBeenCalledWith({ services: [serviceUuid] });
    expect(BleClient.connect).toHaveBeenCalledWith('device-1', expect.any(Function));
    expect(BleClient.startNotifications).toHaveBeenCalledWith(
      'device-1',
      serviceUuid,
      characteristicUuid,
      expect.any(Function)
    );
    expect(result).toEqual({ disconnect: expect.any(Function) });
  });

  it('parses each real notification and hands the real parsed reading to onReading, never the raw bytes', async () => {
    isNativeRuntime.mockReturnValue(true);
    const onReading = vi.fn();
    const parse = vi.fn((dataView) => ({ bpm: dataView }));
    await connectBleCharacteristic({ serviceUuid, characteristicUuid, parse, onReading, onError: vi.fn() });

    const notifyCallback = BleClient.startNotifications.mock.calls[0][3];
    const fakeDataView = { byteLength: 2 };
    notifyCallback(fakeDataView);

    expect(parse).toHaveBeenCalledWith(fakeDataView);
    expect(onReading).toHaveBeenCalledWith({ bpm: fakeDataView });
  });

  it('fires the real onDisconnect callback exactly when BleClient reports the device disconnected', async () => {
    isNativeRuntime.mockReturnValue(true);
    const onDisconnect = vi.fn();
    await connectBleCharacteristic({ serviceUuid, characteristicUuid, parse: vi.fn(), onDisconnect, onError: vi.fn() });

    expect(onDisconnect).not.toHaveBeenCalled();
    const disconnectCallback = BleClient.connect.mock.calls[0][1];
    disconnectCallback('device-1');
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnect() delegates to the real BleClient.disconnect for that exact device', async () => {
    isNativeRuntime.mockReturnValue(true);
    const result = await connectBleCharacteristic({ serviceUuid, characteristicUuid, parse: vi.fn(), onError: vi.fn() });

    result.disconnect();
    expect(BleClient.disconnect).toHaveBeenCalledWith('device-1');
  });

  it('surfaces a genuine connection failure through onError rather than throwing or silently succeeding', async () => {
    isNativeRuntime.mockReturnValue(true);
    BleClient.requestDevice.mockRejectedValueOnce(new Error('User cancelled the device chooser.'));
    const onError = vi.fn();

    const result = await connectBleCharacteristic({ serviceUuid, characteristicUuid, parse: vi.fn(), onError });

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'User cancelled the device chooser.' }));
  });
});
