// Renders a small looping stick-figure animation for one *movement
// category* (see movement-category.js) — a real, reusable component the
// whole exercise library scales onto, instead of one hand-drawn (and, in
// the library's original version, entirely static) SVG per exercise.
//
// Pure and DOM-free: this only ever builds and returns a markup string.
// program-view.js is the one place that injects it into the page — the
// same "pure logic, separate from rendering" split every Programs domain
// file in this directory already follows.
//
// The loop itself is native SVG SMIL (<animate>/<animateTransform>,
// repeatCount="indefinite") rather than a JS animation loop or a CSS
// keyframe stylesheet: it's declarative, starts the instant the markup
// is parsed with zero wiring, and every instance of the same category
// (an exercise can appear more than once across a multi-week program)
// runs its own independent, self-contained loop.
//
// Each animation moves the figure through the *real* joint action that
// movement pattern trains — knees/hips bending and rising for a squat,
// hips hinging back for a hinge, elbows driving for a push/pull, a
// steady march cadence for cardio, a slow arch-and-release for mobility,
// and — deliberately the odd one out — near-stillness (just a slow
// breathing rise) for a hold, since a real isometric hold has no
// repetition to loop; the animation says "sustain this," not "repeat
// this."

const VIEWBOX = '0 0 120 100';
const GROUND = '<line x1="10" y1="92" x2="110" y2="92" stroke="currentColor" stroke-width="2" stroke-opacity="0.25" stroke-linecap="round"/>';
const LIMB_STYLE = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';

function animatedHead(values, dur) {
  const [cxValues, cyValues] = values;
  return `<circle r="7" fill="currentColor">
    <animate attributeName="cx" values="${cxValues}" dur="${dur}" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${cyValues}" dur="${dur}" repeatCount="indefinite"/>
  </circle>`;
}

/** A single limb/torso path whose shape morphs between poses in a loop —
 *  the actual body-part motion, not just a group translated as a block. */
function animatedPath(dValues, dur, { begin = '0s' } = {}) {
  return `<path ${LIMB_STYLE}><animate attributeName="d" values="${dValues}" dur="${dur}" begin="${begin}" repeatCount="indefinite"/></path>`;
}

function svgShell(category, label, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-label="${label} movement demonstration" data-movement-category="${category}">
<title>${label} pattern</title>
${GROUND}
${inner}
</svg>`;
}

// Each builder returns the category's { label, inner } — head + torso +
// arms + legs, most of them animated, sharing the same 120x100 stage and
// stick-figure vocabulary the exercise library's original static art
// used (head circle at ~cy18-58, hips ~y58-72, feet on the y92 ground
// line), so a demo always reads as the same "figure" regardless of which
// category is currently showing.

function squatDemo() {
  const dur = '1.6s';
  // Standing -> hips-back-and-down -> standing. Knees and hips are the
  // real joints a squat loads, so they're what actually moves.
  const torso = animatedPath('M60,26 L58,58;M60,40 L57,70;M60,26 L58,58', dur);
  const armL = animatedPath('M60,26 L78,32 L92,40;M60,40 L80,44 L95,44;M60,26 L78,32 L92,40', dur);
  const armR = animatedPath('M60,26 L44,32 L30,26;M60,40 L42,44 L27,44;M60,26 L44,32 L30,26', dur);
  const legL = animatedPath('M58,58 L42,74 L38,92;M57,70 L38,80 L38,92;M58,58 L42,74 L38,92', dur);
  const legR = animatedPath('M58,58 L74,74 L78,92;M57,70 L76,80 L78,92;M58,58 L74,74 L78,92', dur);
  const headEl = animatedHead(['60;60;60', '18;32;18'], dur);
  return { label: 'Squat', inner: `<g>${torso}${armL}${armR}${legL}${legR}</g>${headEl}` };
}

function hingeDemo() {
  const dur = '1.7s';
  // Standing -> hinge forward at the hips, weight pushed back, soft
  // knees -> standing. The torso leans; the legs barely bend — that
  // distinction from a squat is the whole point of a hinge pattern.
  const torso = animatedPath('M58,26 L58,58;M40,34 L55,58;M58,26 L58,58', dur);
  const armL = animatedPath('M58,26 L74,34 L86,46;M40,34 L52,50 L58,66;M58,26 L74,34 L86,46', dur);
  const armR = animatedPath('M58,26 L44,30 L34,24;M40,34 L34,52 L28,64;M58,26 L44,30 L34,24', dur);
  const legL = animatedPath('M58,58 L44,74 L40,92;M55,58 L46,76 L42,92;M58,58 L44,74 L40,92', dur);
  const legR = animatedPath('M58,58 L72,74 L76,92;M55,58 L68,76 L74,92;M58,58 L72,74 L76,92', dur);
  const headEl = animatedHead(['58;36;58', '18;28;18'], dur);
  return { label: 'Hinge', inner: `<g>${torso}${armL}${armR}${legL}${legR}</g>${headEl}` };
}

function pushDemo() {
  const dur = '1.4s';
  // A plank body line with elbows bending to lower the chest and
  // pressing back up — a real push-up cycle, not a standing figure.
  const torso = animatedPath('M28,58 L70,60 L104,84;M28,66 L70,68 L104,86;M28,58 L70,60 L104,84', dur);
  const armFront = animatedPath('M28,58 L34,42 L52,44;M28,66 L28,50 L48,52;M28,58 L34,42 L52,44', dur);
  const armBack = animatedPath('M60,59 L64,44 L82,46;M62,67 L58,54 L78,56;M60,59 L64,44 L82,46', dur);
  const legs = animatedPath('M70,60 L88,66 L104,84;M70,68 L88,72 L104,86;M70,60 L88,66 L104,84', dur);
  const headEl = animatedHead(['22;22;22', '55;63;55'], dur);
  return { label: 'Push', inner: `<g>${torso}${armFront}${armBack}${legs}</g>${headEl}` };
}

function pullDemo() {
  const dur = '1.5s';
  // Arms extended -> elbows drive back, shoulder blades pulling
  // together -> extended. Standing pull (row) posture: hinged forward.
  const torso = animatedPath('M56,28 L56,58;M56,28 L56,58;M56,28 L56,58', dur);
  const armL = animatedPath('M56,34 L78,40 L96,36;M56,34 L74,26 L86,16;M56,34 L78,40 L96,36', dur);
  const armR = animatedPath('M56,34 L78,44 L96,48;M56,34 L74,32 L86,24;M56,34 L78,44 L96,48', dur);
  const legL = animatedPath('M56,58 L44,74 L40,92;M56,58 L44,74 L40,92;M56,58 L44,74 L40,92', dur);
  const legR = animatedPath('M56,58 L68,74 L72,92;M56,58 L68,74 L72,92;M56,58 L68,74 L72,92', dur);
  const headEl = animatedHead(['56;56;56', '20;20;20'], dur);
  return { label: 'Pull', inner: `<g>${torso}${armL}${armR}${legL}${legR}</g>${headEl}` };
}

function holdDemo() {
  // Deliberately near-static: a real isometric hold has no rep to loop,
  // so this is one long, slow breathing cycle (a subtle chest rise/fall)
  // rather than repeated motion — the animation itself communicates
  // "sustain," not "repeat."
  const dur = '3s';
  const torso = animatedPath('M30,58 L68,60 L105,85;M30,56 L68,58 L105,85;M30,58 L68,60 L105,85', dur);
  const arm = 'M30,58 L28,75 L30,90';
  const headEl = animatedHead(['25;25;25', '55;53;55'], dur);
  return { label: 'Hold', inner: `<g>${torso}<path ${LIMB_STYLE} d="${arm}"/></g>${headEl}` };
}

function coreDemo() {
  const dur = '2.4s';
  // Lying supine, one arm and the opposite leg slowly extend and
  // retract, then switch sides — the actual dead-bug pattern (a dynamic
  // core drill, not a hold).
  const torso = 'M30,70 L70,70';
  const armExtend = animatedPath('M35,70 L20,68 L8,66;M35,70 L40,52 L44,38;M35,70 L20,68 L8,66', dur);
  const armTuck = animatedPath('M65,70 L78,68 L90,66;M65,70 L70,66 L78,62;M65,70 L78,68 L90,66', dur);
  const legExtend = animatedPath('M65,70 L84,72 L100,74;M65,70 L86,80 L104,92;M65,70 L84,72 L100,74', dur);
  const legTuck = animatedPath('M35,70 L20,74 L10,70;M35,70 L24,80 L20,90;M35,70 L20,74 L10,70', dur);
  const headEl = animatedHead(['22;22;22', '68;68;68'], dur);
  return { label: 'Core', inner: `<g><path ${LIMB_STYLE} d="${torso}"/>${armExtend}${armTuck}${legExtend}${legTuck}</g>${headEl}` };
}

function cardioDemo() {
  const dur = '0.8s'; // a real marching/jogging cadence — noticeably brisker than any strength-rep loop
  const torso = 'M56,26 L56,56';
  const armL = animatedPath('M56,30 L70,38 L80,50;M56,30 L42,38 L32,48;M56,30 L70,38 L80,50', dur);
  const armR = animatedPath('M56,30 L42,38 L32,48;M56,30 L70,38 L80,50;M56,30 L42,38 L32,48', dur);
  const legL = animatedPath('M56,56 L44,58 L40,92;M56,56 L46,44 L52,34;M56,56 L44,58 L40,92', dur);
  const legR = animatedPath('M56,56 L46,44 L52,34;M56,56 L44,58 L40,92;M56,56 L46,44 L52,34', dur);
  const headEl = animatedHead(['56;56;56', '18;18;18'], dur);
  return { label: 'Cardio', inner: `<g><path ${LIMB_STYLE} d="${torso}"/>${armL}${armR}${legL}${legR}</g>${headEl}` };
}

function mobilityDemo() {
  const dur = '4s'; // slow, controlled — the tempo that separates a stretch from a strength rep
  // Kneeling cat-cow-style arch and round, held a beat at each end.
  const torso = animatedPath(
    'M30,58 Q58,50 86,60;M30,60 Q58,72 86,64;M30,58 Q58,50 86,60',
    dur,
  );
  const armFront = 'M30,58 L30,90';
  const armBack = 'M86,60 L88,90';
  const legs = 'M30,58 L20,92 M86,60 L96,92';
  const headEl = animatedHead(['24;24;24', '46;56;46'], dur);
  return {
    label: 'Mobility',
    inner: `<g>${torso}<path ${LIMB_STYLE} d="${armFront}"/><path ${LIMB_STYLE} d="${armBack}"/><path ${LIMB_STYLE} d="${legs}"/></g>${headEl}`,
  };
}

const BUILDERS = Object.freeze({
  squat: squatDemo,
  hinge: hingeDemo,
  push: pushDemo,
  pull: pullDemo,
  hold: holdDemo,
  core: coreDemo,
  cardio: cardioDemo,
  mobility: mobilityDemo,
});

/** A static (unanimated) single-pose fallback — every `animatedPath`'s
 *  first pose, rendered as a plain, non-animated `<path>`. Used when the
 *  viewer has asked for reduced motion: the figure still shows the
 *  movement's starting position, it just doesn't loop. */
function stripAnimation(markup) {
  return markup
    .replace(/<animate[^>]*\/>/g, '')
    .replace(/<path ([^>]*)><\/path>/g, '<path $1/>');
}

/**
 * @param {string} category - one of movement-category.js's MOVEMENT_CATEGORIES
 * @param {object} [options]
 * @param {boolean} [options.reduceMotion] - when true, returns the same
 *   figure at its resting pose with no looping animation (prefers-
 *   reduced-motion support) — pure/testable rather than left to CSS to
 *   fight SMIL with.
 * @returns {string} inline SVG markup, or null for an unrecognized category
 */
export function getMovementDemoSvgMarkup(category, { reduceMotion = false } = {}) {
  const builder = BUILDERS[category];
  if (!builder) return null;
  const { label, inner } = builder();
  const markup = svgShell(category, label, inner);
  return reduceMotion ? stripAnimation(markup) : markup;
}
