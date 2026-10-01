import { registerPlugin } from '../capacitor-core.mjs';
export const BluetoothLe = registerPlugin('BluetoothLe', {
    web: () => import('./web').then((m) => new m.BluetoothLeWeb()),
});
//# sourceMappingURL=plugin.js.map