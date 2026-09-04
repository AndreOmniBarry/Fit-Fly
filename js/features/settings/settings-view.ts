// Settings: the one place this app's data ever leaves this device on
// purpose — a real backup file, saved and restored entirely locally (no
// server, no account; see js/db/backup.js). Export always works; import
// is destructive (a real restore, not a merge — see backup.js's own
// comment on why), so it's gated behind the same "hidden safety-flag,
// explicit danger button" confirmation pattern the Cycle Tracker's own
// "forgot PIN" reset already uses.
import { showScreen } from '../../lib/router.js';
import { exportBackup, importBackup } from '../../db/backup.js';
import type { FitFlyBackup } from '../../db/backup.js';
import { initChipGroup } from '../../lib/chip-group.js';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '../../lib/units.js';
import { calculateAge } from '../onboarding/age.js';
import { getProfile, saveProfile } from '../../db/repositories/profile.js';

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`settings-view: missing #${id}`);
  return el as T;
}

function showError(id: string, show: boolean): void {
  byId(id).hidden = !show;
}

function todayFilenameStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function countRows(backup: FitFlyBackup): number {
  return Object.values(backup.tables).reduce((sum, rows) => sum + rows.length, 0);
}

export function initSettingsFeature(): void {
  let pendingImport: unknown = null;

  // ---------- profile ----------
  // Canonical metric values the form is currently editing — kept
  // separately from whatever's on screen so switching the units toggle
  // can re-render the other unit system's fields from the same real
  // numbers, instead of losing them or showing stale blanks.
  let currentHeightCm: number | null = null;
  let currentWeightKg: number | null = null;

  const profileSexChips = initChipGroup<string | null>(byId('profile-sex'));
  const profileUnitsChips = initChipGroup(byId('profile-units'), {
    initial: 'metric',
    onChange: (value) => {
      byId('profile-height-metric').hidden = value !== 'metric';
      byId('profile-height-imperial').hidden = value === 'metric';
      byId('profile-weight-metric').hidden = value !== 'metric';
      byId('profile-weight-imperial').hidden = value === 'metric';
      populateHeightWeightFields();
    },
  });

  function populateHeightWeightFields(): void {
    if (profileUnitsChips.getValue() === 'metric') {
      byId<HTMLInputElement>('profile-height-cm').value = currentHeightCm != null ? String(Math.round(currentHeightCm)) : '';
      byId<HTMLInputElement>('profile-weight-kg').value = currentWeightKg != null ? currentWeightKg.toFixed(1) : '';
    } else {
      if (currentHeightCm != null) {
        const { feet, inches } = cmToFeetInches(currentHeightCm);
        byId<HTMLInputElement>('profile-height-ft').value = String(feet);
        byId<HTMLInputElement>('profile-height-in').value = String(Math.round(inches));
      } else {
        byId<HTMLInputElement>('profile-height-ft').value = '';
        byId<HTMLInputElement>('profile-height-in').value = '';
      }
      byId<HTMLInputElement>('profile-weight-lb').value = currentWeightKg != null ? kgToLb(currentWeightKg).toFixed(1) : '';
    }
  }

  async function loadProfileForm(): Promise<void> {
    const profile = await getProfile();
    byId<HTMLInputElement>('profile-birthdate').value = profile?.birthdate ?? '';
    byId('profile-age-hint').textContent = profile?.birthdate
      ? `${calculateAge(profile.birthdate)} years old`
      : '';
    profileSexChips.setValue(profile?.sex ?? null);
    currentHeightCm = profile?.heightCm ?? null;
    currentWeightKg = profile?.weightKg ?? null;
    populateHeightWeightFields();
    byId('profile-save-status').textContent = '';
  }

  byId<HTMLInputElement>('profile-birthdate').addEventListener('change', () => {
    const birthdate = byId<HTMLInputElement>('profile-birthdate').value;
    byId('profile-age-hint').textContent = birthdate ? `${calculateAge(birthdate)} years old` : '';
  });

  byId('btn-profile-save').addEventListener('click', async () => {
    const birthdate = byId<HTMLInputElement>('profile-birthdate').value;
    const sex = profileSexChips.getValue();

    let heightCm: number | null = null;
    let weightKg: number | null = null;
    if (profileUnitsChips.getValue() === 'metric') {
      heightCm = Number(byId<HTMLInputElement>('profile-height-cm').value) || null;
      weightKg = Number(byId<HTMLInputElement>('profile-weight-kg').value) || null;
    } else {
      const ft = Number(byId<HTMLInputElement>('profile-height-ft').value);
      const inches = Number(byId<HTMLInputElement>('profile-height-in').value) || 0;
      heightCm = ft ? feetInchesToCm(ft, inches) : null;
      const lb = Number(byId<HTMLInputElement>('profile-weight-lb').value) || null;
      weightKg = lb ? lbToKg(lb) : null;
    }

    showError('err-profile-birthdate', !birthdate);
    showError('err-profile-sex', !sex);
    showError('err-profile-height', !heightCm || heightCm <= 0);
    showError('err-profile-weight', !weightKg || weightKg <= 0);
    if (!birthdate || !sex || !heightCm || !weightKg) return;

    await saveProfile({ birthdate, sex, heightCm, weightKg });
    currentHeightCm = heightCm;
    currentWeightKg = weightKg;
    byId('profile-age-hint').textContent = `${calculateAge(birthdate)} years old`;
    byId('profile-save-status').textContent = 'Saved.';
  });

  byId('btn-hub-settings').addEventListener('click', async () => {
    await loadProfileForm();
    showScreen('screen-settings');
  });
  byId('btn-settings-back').addEventListener('click', () => showScreen('screen-hub'));

  // ---------- export ----------
  byId('btn-settings-export').addEventListener('click', async () => {
    const statusEl = byId('settings-export-status');
    statusEl.textContent = 'Preparing your backup…';
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fit-fly-backup-${todayFilenameStamp()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      statusEl.textContent = `Saved — ${countRows(backup).toLocaleString()} entries across ${Object.keys(backup.tables).length} stores.`;
    } catch {
      statusEl.textContent = "Couldn't create a backup just now — try again.";
    }
  });

  // ---------- import: pick a file, confirm, then actually restore ----------
  const fileInput = byId<HTMLInputElement>('settings-import-file');

  byId('btn-settings-import').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // so picking the same file twice in a row still fires 'change'
    if (!file) return;

    byId('err-settings-import').hidden = true;
    byId('settings-import-success').hidden = true;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      pendingImport = parsed;
      byId('settings-import-confirm').hidden = false;
    } catch {
      byId('err-settings-import').textContent = "That file isn't readable as a Fit Fly backup.";
      byId('err-settings-import').hidden = false;
    }
  });

  byId('btn-settings-import-cancel').addEventListener('click', () => {
    pendingImport = null;
    byId('settings-import-confirm').hidden = true;
  });

  byId('btn-settings-import-confirm').addEventListener('click', async () => {
    byId('settings-import-confirm').hidden = true;
    byId('err-settings-import').hidden = true;
    const confirmBtn = byId<HTMLButtonElement>('btn-settings-import-confirm');
    confirmBtn.disabled = true;

    try {
      await importBackup(pendingImport);
      pendingImport = null;
      byId('settings-import-success').textContent = 'Restored. Reloading Fit Fly…';
      byId('settings-import-success').hidden = false;
      // Every mini-app on every screen just had its data replaced out
      // from under it — a full reload is the one guaranteed-correct way
      // for all of them to pick that up, rather than hand-wiring a
      // "refresh everything" call through every feature this app has.
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      confirmBtn.disabled = false;
      byId('err-settings-import').textContent =
        error instanceof Error ? error.message : "Couldn't restore that backup.";
      byId('err-settings-import').hidden = false;
    }
  });
}
