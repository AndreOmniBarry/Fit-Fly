/** Whole years between a birth date and a reference date (defaults to
 *  now), accounting for whether the birthday has happened yet this year.
 *  Both args are ISO date strings (YYYY-MM-DD, or a full ISO timestamp). */
export function calculateAge(birthDateIso, onDateIso = new Date().toISOString()) {
  const birth = new Date(birthDateIso);
  const on = new Date(onDateIso);

  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    on.getUTCMonth() > birth.getUTCMonth() ||
    (on.getUTCMonth() === birth.getUTCMonth() && on.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;

  return age;
}
