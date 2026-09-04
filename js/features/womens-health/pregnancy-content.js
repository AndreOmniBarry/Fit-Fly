// Week-by-week development info — real, standard prenatal-education
// facts (the kind found in ACOG/Mayo Clinic patient materials), worded
// cautiously ("typically", "around") rather than with false precision,
// since every pregnancy's timeline varies. Deliberately non-diagnostic:
// this describes typical development, never a personal prediction or
// a substitute for real prenatal care.

export const WEEKLY_MILESTONES = Object.freeze([
  {
    week: 4,
    title: 'Implantation',
    text: 'The fertilised egg has typically implanted in the uterine lining, and pregnancy hormone (hCG) production has begun — often the first point a home test can detect a real result.',
  },
  {
    week: 6,
    title: 'A heartbeat begins',
    text: "The embryo's heart has typically begun beating, though it's usually still too early to hear it — an early ultrasound is the standard way to confirm it at this stage.",
  },
  {
    week: 8,
    title: 'Major organs forming',
    text: 'All major organs have typically begun forming, and the embryo is developing recognisable facial features and limb buds.',
  },
  {
    week: 10,
    title: 'End of the embryonic stage',
    text: 'The embryonic period typically ends around now — every major organ system has begun forming, and the pregnancy is usually referred to as a fetus from this point.',
  },
  {
    week: 12,
    title: 'First trimester ends',
    text: 'The first trimester typically ends around this week. Miscarriage risk usually drops meaningfully after this point, which is why many people choose to share the news around now.',
  },
  {
    week: 16,
    title: 'Movement may begin',
    text: 'Early fetal movement ("quickening") sometimes becomes noticeable around now, though it commonly isn\'t felt clearly until several weeks later, especially in a first pregnancy.',
  },
  {
    week: 20,
    title: 'The halfway point',
    text: 'This is typically the halfway point of a full-term pregnancy, usually when a detailed anatomy ultrasound is offered to check growth and development.',
  },
  {
    week: 24,
    title: 'Viability milestone',
    text: 'Around this week is typically cited as the earliest point of fetal viability with intensive medical care, and the standard glucose-screening test is usually offered soon after.',
  },
  {
    week: 28,
    title: 'Third trimester begins',
    text: "The third trimester typically begins around now. Many care providers introduce daily fetal movement (\"kick count\") tracking from around this point — see this app's own Kick Counter below.",
  },
  {
    week: 32,
    title: 'Rapid weight gain',
    text: 'The fetus is typically gaining weight quickly now, and practice breathing movements usually become more regular.',
  },
  {
    week: 36,
    title: 'Considered early term soon',
    text: 'Pregnancies reaching 37 weeks are typically classified as "early term" — most of the remaining development from here is about gaining weight and finishing lung maturation.',
  },
  {
    week: 39,
    title: 'Full term',
    text: 'Pregnancies are typically considered "full term" from 39 weeks — only a small share of births happen exactly on the estimated due date itself, so timing from here varies a lot.',
  },
]);

/** The most relevant milestone for a given week — the latest one whose
 *  own week has already been reached, or the first one if none has.
 *  Never fabricates an entry for a week nothing here covers. */
export function milestoneForWeek(week) {
  const reached = WEEKLY_MILESTONES.filter((m) => m.week <= week);
  return reached.length > 0 ? reached[reached.length - 1] : WEEKLY_MILESTONES[0];
}

export const PREGNANCY_SYMPTOMS = Object.freeze([
  { id: 'nausea', label: 'Nausea' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'back-pain', label: 'Back pain' },
  { id: 'swelling', label: 'Swelling' },
  { id: 'heartburn', label: 'Heartburn' },
  { id: 'braxton-hicks', label: 'Braxton Hicks' },
  { id: 'round-ligament-pain', label: 'Round ligament pain' },
  { id: 'insomnia', label: 'Insomnia' },
  { id: 'food-aversion', label: 'Food aversion' },
  { id: 'frequent-urination', label: 'Frequent urination' },
]);
