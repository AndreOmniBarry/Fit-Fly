/** Escapes text for safe interpolation into an innerHTML template string.
 *  Anywhere a person's own free-text input (a food name, a note, ...)
 *  gets rendered back via innerHTML, it needs to go through this first —
 *  otherwise typing something like `<img src=x onerror=...>` into a form
 *  field becomes a stored XSS payload the next time that list renders. */
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
