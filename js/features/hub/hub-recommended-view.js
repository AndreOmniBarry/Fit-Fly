// The Hub's "Continue your program" card — a real shortcut back into
// whatever program is already active, shown only when one genuinely is.
// Programs has no fixed calendar-day schedule (Day 1/2/3 rotate whenever
// a person actually shows up, not fixed weekdays — see program-view.js's
// own comment), so this deliberately never tries to guess "today's
// planned workout." It shows only two real, simple facts instead: which
// category the active program is for, and how many real sessions have
// already been logged against it this week.
import { onScreenShown } from '../../lib/router.js';
import { getLatestCategoryAssignment } from '../../db/repositories/category-assignments.js';
import { getActiveProgram } from '../../db/repositories/programs.js';
import { listSessionsForProgram } from '../../db/repositories/sessions.js';
import { sessionDatesForProgram, currentWeekRange } from '../programs/program-calendar.js';
import { formatCategoryLabel } from '../onboarding/category-label.js';
import { openProgramScreen } from '../programs/program-view.js';
function byId(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`hub-recommended-view: missing #${id}`);
    return el;
}
function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}
export function initHubRecommendedFeature() {
    byId('btn-hub-recommended-program').addEventListener('click', () => void openProgramScreen());
    onScreenShown('screen-hub', () => void refreshHubRecommendedCard());
}
async function refreshHubRecommendedCard() {
    const card = byId('btn-hub-recommended-program');
    const assignment = await getLatestCategoryAssignment();
    if (!assignment) {
        card.hidden = true;
        return;
    }
    // Never creates one — only ever surfaces a program someone has actually
    // opened My Program for at least once (see program-view.js's own
    // ensureActiveProgram, which is the only thing that creates one).
    const program = await getActiveProgram(assignment.category, assignment.trainingFocus);
    if (!program) {
        card.hidden = true;
        return;
    }
    const sessions = await listSessionsForProgram(program.id);
    const dates = sessionDatesForProgram(sessions);
    const { start, end } = currentWeekRange(todayIsoDate());
    const sessionsThisWeek = [...dates].filter((date) => date >= start && date <= end).length;
    const sessionWord = sessionsThisWeek === 1 ? 'session' : 'sessions';
    byId('hub-recommended-category').textContent = formatCategoryLabel(assignment.category, assignment.trainingFocus);
    byId('hub-recommended-sub').textContent = `${sessionsThisWeek} ${sessionWord} logged this week`;
    card.hidden = false;
}
//# sourceMappingURL=hub-recommended-view.js.map