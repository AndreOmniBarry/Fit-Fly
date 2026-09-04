// Sidecar types for units.js (hand-written JS, untouched — see
// tsconfig.json).
export function kgToLb(kg: number): number;
export function lbToKg(lb: number): number;
export function cmToIn(cm: number): number;
export function inToCm(inches: number): number;
export function cmToFeetInches(cm: number): { feet: number; inches: number };
export function feetInchesToCm(feet: number, inches: number): number;
