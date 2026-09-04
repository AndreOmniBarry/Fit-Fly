// Sidecar types for profile.js (hand-written JS, untouched — see
// tsconfig.json). Only the fields TypeScript callers actually read are
// declared — the fuller shape lives in the still-JS onboarding wizard
// that owns it.
export interface Profile {
  id: string;
  birthdate?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  createdAt: string;
  updatedAt: string;
}

export function getProfile(): Promise<Profile | undefined>;

/** Merges `patch` onto the existing profile (or creates it) — never
 *  drops fields the caller didn't mention, so a plain biometric edit
 *  (see js/features/settings/settings-view.ts) can't accidentally erase
 *  onboarding-only fields like goal/experienceLevel it never touches. */
export function saveProfile(patch: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Profile>;
