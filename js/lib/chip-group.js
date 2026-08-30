// Wires up a `.chip-group` container (single- or multi-select) using event
// delegation, so it works whether the chips were already in the markup or
// got appended dynamically afterward.

export function initChipGroup(container, { multi = false, initial, onChange } = {}) {
  let selected = multi ? new Set(initial ?? []) : (initial ?? null);

  function apply() {
    for (const chip of container.querySelectorAll('.chip')) {
      const { value } = chip.dataset;
      const isSelected = multi ? selected.has(value) : selected === value;
      chip.setAttribute('aria-pressed', String(isSelected));
    }
  }

  container.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip || !container.contains(chip)) return;

    const { value } = chip.dataset;
    if (multi) {
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
    } else {
      selected = value; // single-select never toggles back off
    }

    apply();
    onChange?.(multi ? Array.from(selected) : selected);
  });

  apply();

  return {
    getValue: () => (multi ? Array.from(selected) : selected),
    setValue: (value) => {
      selected = multi ? new Set(value) : value;
      apply();
    },
  };
}
