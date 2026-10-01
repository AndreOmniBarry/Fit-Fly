// Shared BLE transport for every GATT integration in this app (the
// heart-rate strap, and Vitals' blood-pressure cuff/pulse oximeter/
// thermometer) — one real connection path instead of each feature
// hand-rolling its own navigator.bluetooth plumbing.
//
// Backed by @capacitor-community/bluetooth-le's BleClient (vendored under
// js/vendor/ble/ — see js/vendor/THIRD_PARTY_NOTICES.md), which is itself
// a single JS API that transparently picks the right real transport:
// genuine native Android BLE (Android's own BluetoothGatt, wired into the
// native app shell via Capacitor — see android/capacitor.settings.gradle)
// when running inside the Capacitor-built app, falling back to the
// browser's own Web Bluetooth API (navigator.bluetooth) everywhere else.
// This file never branches on isNativeRuntime() itself — BleClient
// already does, the same "one real call site, the library picks the
// right backend" shape native-background-geo.js's own BackgroundGeolocation
// plugin already established for GPS.
//
// Native BLE is the actual fix for a real gap Web Bluetooth left open:
// it has zero iOS support at all, and even on Android it isn't reliably
// present inside a bare WebView the way it is in standalone Chrome — the
// exact reason Vitals/Heart Rate's BLE features needed a native path to
// be trustworthy inside the installed app, not just in a desktop browser
// tab.
import { BleClient } from '../vendor/ble/bleClient.js';
import { isNativeRuntime } from './native-runtime.js';

/** True when this device can plausibly do BLE at all — native app shell
 *  (real BluetoothGatt always available, permissions aside) or a browser
 *  that implements Web Bluetooth. False on iOS Safari/desktop Safari/
 *  Firefox in a plain browser tab, where every BLE feature already
 *  degrades to its own honest manual-entry fallback. */
export function isBluetoothAvailable() {
  return isNativeRuntime() || (typeof navigator !== 'undefined' && 'bluetooth' in navigator);
}

/** Converts a real Bluetooth SIG 16-bit assigned number (e.g. the Heart
 *  Rate service, 0x180D) to the full 128-bit UUID string BleClient
 *  requires — unlike Web Bluetooth's own requestDevice/getPrimaryService,
 *  it doesn't accept the short canonical names ('heart_rate') or bare
 *  16-bit hex. Every GATT UUID in this app's BLE features is a real,
 *  standard SIG-assigned number (never a vendor-specific one), so this
 *  one real transform covers them all. */
export function sig16BitUuid(shortHex) {
  return `0000${shortHex.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
}

/**
 * Connects to a real peripheral advertising `serviceUuid`, starts
 * notifications on `characteristicUuid`, and hands each real raw
 * notification to `parse` before calling `onReading` — the one real
 * connect/notify/disconnect sequence every BLE feature in this app needs,
 * written once. `serviceUuid`/`characteristicUuid` must already be full
 * 128-bit UUID strings (see sig16BitUuid above).
 *
 * @param {object} options
 * @param {string} options.serviceUuid
 * @param {string} options.characteristicUuid
 * @param {(dataView: DataView) => unknown} options.parse
 * @param {(reading: unknown) => void} options.onReading
 * @param {() => void} [options.onDisconnect]
 * @param {(error: Error) => void} options.onError
 * @returns {Promise<{disconnect: () => void}|null>} null if BLE isn't
 *   available at all, or the connection genuinely failed (surfaced
 *   through onError first) — never a fabricated connection.
 */
export async function connectBleCharacteristic({ serviceUuid, characteristicUuid, parse, onReading, onDisconnect, onError }) {
  if (!isBluetoothAvailable()) {
    onError?.(new Error('This device doesn\'t support Bluetooth — try a manual entry instead.'));
    return null;
  }

  try {
    await BleClient.initialize();
    const device = await BleClient.requestDevice({ services: [serviceUuid] });
    await BleClient.connect(device.deviceId, () => onDisconnect?.());
    await BleClient.startNotifications(device.deviceId, serviceUuid, characteristicUuid, (dataView) => {
      onReading?.(parse(dataView));
    });

    return { disconnect: () => void BleClient.disconnect(device.deviceId) };
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
