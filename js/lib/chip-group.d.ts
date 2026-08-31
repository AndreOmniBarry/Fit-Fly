// Sidecar types for chip-group.js (hand-written JS, untouched — see
// tsconfig.json).
export interface ChipGroupHandle<T = string> {
  getValue(): T;
  setValue(value: T): void;
}

export function initChipGroup<T = string>(
  container: HTMLElement,
  options?: { multi?: boolean; initial?: T; onChange?: (value: T) => void }
): ChipGroupHandle<T>;
