// Shared feature-detection for the Web Bluetooth API — used by every BLE
// integration in this app (the heart-rate strap, and now a blood-pressure
// cuff and a pulse oximeter). A Chrome/Android-family API with no
// Safari/iOS implementation at all, so every BLE feature has to degrade
// gracefully rather than assume it's there. Pulled out of
// ble-heart-rate.js so a second/third BLE integration reuses this one
// check instead of a copy of it.

export function isBluetoothAvailable() {
  return 'bluetooth' in navigator;
}
