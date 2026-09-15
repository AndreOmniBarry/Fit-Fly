// Chronotype self-assessment screen — a single-scroll form (six
// .chip-groups, one per question, rendered generically from
// CHRONOTYPE_QUESTIONS) reached from Sleep Insights' own "Chronotype"
// card. Deliberately does NOT touch sleep-view.ts: every element this
// module owns lives under its own #chronotype-* / #screen-chronotype ids
// in index.html, wired entirely here, so this feature and Sleep's own
// view module can be developed independently without colliding on the
// same file.
import { showScreen, onScreenShown } from '../../lib/router.js';
import { initChipGroup } from '../../lib/chip-group.js';
import type { ChipGroupHandle } from '../../lib/chip-group.js';
import {
  CHRONOTYPE_QUESTIONS,
  scoreChronotype,
  describeChronotypeCategory,
  chronotypeCategoryLabel,
} from './chronotype.js';
import type { ChronotypeAnswers } from './chronotype.js';
import {
  recordChronotypeAssessment,
  listRecentChronotypeAssessments,
} from '../../db/repositories/chronotype-assessments.js';
import type { ChronotypeAssessmentEntry } from '../../db/repositories/chronotype-assessments.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`chronotype-view: missing #${id}`);
  return el as T;
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

let latest: ChronotypeAssessmentEntry | null = null;
let questionChips: Map<keyof ChronotypeAnswers, ChipGroupHandle<string | null>> = new Map();

/** Renders the 6 questions generically from CHRONOTYPE_QUESTIONS, one
 *  .field + .chip-group block each, and wires each block's chip-group —
 *  no hand-coded near-duplicate markup per question. */
function renderQuestions(): void {
  const container = byId('chronotype-questions');
  container.innerHTML = CHRONOTYPE_QUESTIONS.map(
    (q, index) => `
      <div class="field" style="${index === 0 ? '' : 'margin-top:var(--space-4);'}">
        <label id="lbl-chronotype-${q.id}">${index + 1}. ${q.question}</label>
        <div class="chip-group" id="chronotype-q-${q.id}" role="group" aria-labelledby="lbl-chronotype-${q.id}">
          ${q.options
            .map(
              (opt) =>
                `<button type="button" class="chip" data-value="${opt.points}" aria-pressed="false">${opt.label}</button>`
            )
            .join('')}
        </div>
      </div>
    `
  ).join('');

  questionChips = new Map(
    CHRONOTYPE_QUESTIONS.map((q) => [q.id, initChipGroup<string | null>(byId(`chronotype-q-${q.id}`))])
  );
}

function resetForm(): void {
  for (const chips of questionChips.values()) chips.setValue(null);
  byId('err-chronotype').hidden = true;
}

function readAnswers(): ChronotypeAnswers | null {
  const values: Partial<Record<keyof ChronotypeAnswers, number>> = {};
  for (const q of CHRONOTYPE_QUESTIONS) {
    const raw = questionChips.get(q.id)?.getValue();
    if (raw == null) return null;
    values[q.id] = Number(raw);
  }
  return values as ChronotypeAnswers;
}

function renderResultCard(entry: ChronotypeAssessmentEntry): void {
  byId('chronotype-result-date').textContent = formatDateLabel(entry.takenAt);
  byId('chronotype-result-category').textContent = chronotypeCategoryLabel(entry.category);
  byId('chronotype-result-score').textContent = `Score: ${entry.total} out of 42`;
  byId('chronotype-result-description').textContent = describeChronotypeCategory(entry.category);
  byId('chronotype-result-card').hidden = false;
}

function renderEntryCard(): void {
  const emptyEl = byId('chronotype-entry-empty');
  const resultEl = byId('chronotype-entry-result');
  if (!latest) {
    emptyEl.hidden = false;
    resultEl.hidden = true;
    return;
  }
  emptyEl.hidden = true;
  resultEl.hidden = false;
  byId('chronotype-entry-category').textContent = chronotypeCategoryLabel(latest.category);
  byId('chronotype-entry-date').textContent = ` (${formatDateLabel(latest.takenAt)})`;
}

async function refreshLatest(): Promise<void> {
  const recent = await listRecentChronotypeAssessments(1);
  latest = recent[0] ?? null;
  renderEntryCard();
}

function openAssessment(): void {
  const form = byId<HTMLFormElement>('chronotype-form');
  if (latest) {
    renderResultCard(latest);
    form.hidden = true;
  } else {
    byId('chronotype-result-card').hidden = true;
    form.hidden = false;
  }
  showScreen('screen-chronotype');
}

export function initChronotypeFeature(): void {
  renderQuestions();

  byId('btn-chronotype-open').addEventListener('click', openAssessment);
  byId('btn-chronotype-back').addEventListener('click', () => showScreen('screen-sleep-insights'));

  byId('btn-chronotype-retake').addEventListener('click', () => {
    resetForm();
    byId('chronotype-result-card').hidden = true;
    byId<HTMLFormElement>('chronotype-form').hidden = false;
  });

  byId('chronotype-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const answers = readAnswers();
    if (!answers) {
      byId('err-chronotype').hidden = false;
      return;
    }
    byId('err-chronotype').hidden = true;

    const { total, category } = scoreChronotype(answers);
    latest = await recordChronotypeAssessment({ answers, total, category });
    renderEntryCard();
    renderResultCard(latest);
    byId<HTMLFormElement>('chronotype-form').hidden = true;
  });

  onScreenShown('screen-sleep-insights', () => {
    refreshLatest();
  });

  refreshLatest();
}
