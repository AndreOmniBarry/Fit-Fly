// The app's icon system, from the JS side — thin references into the
// sprite defined once at the top of index.html (search that file for
// "ICON SPRITE" for the actual path data and the full rationale for why
// there's no emoji anywhere in this app). This module only exists so
// dynamically-built markup (soundscape catalogs, achievement badges, ...)
// gets a type-checked icon name instead of a magic string, and always
// stays in sync with the same sprite the static HTML uses.
/** Inline SVG markup for one icon — safe to drop straight into innerHTML.
 *  `size` sets both width/height (default 20). Always carries class="icon"
 *  (see base.css) for its stroke/fill; `aria-hidden` since every icon in
 *  this app is decorative next to a real text label or an aria-label on
 *  its parent control, never the only description of what it does. */
export function iconMarkup(name, { size = 20 } = {}) {
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;
}
//# sourceMappingURL=icons.js.map