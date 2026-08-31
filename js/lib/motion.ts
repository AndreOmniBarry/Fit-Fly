// One shared check for "this person asked for less motion" — used
// anywhere a feature decides whether to run at all in JS, not just style
// itself differently in CSS (a real `@media (prefers-reduced-motion)`
// block still belongs in CSS for anything CSS can express alone).

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}
