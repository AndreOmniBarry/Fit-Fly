// Sidecar types for run-units.js (hand-written JS, untouched — see
// tsconfig.json).
export type DistanceUnit = 'km' | 'mi';

export function getDistanceUnit(): DistanceUnit;
export function setDistanceUnit(unit: DistanceUnit): void;
export function formatDistanceForUnit(meters: number, unit: DistanceUnit): string;
export function formatPaceForUnit(secPerKm: number | null, unit: DistanceUnit): string;
export function splitBoundaryMetersForUnit(unit: DistanceUnit): number;
