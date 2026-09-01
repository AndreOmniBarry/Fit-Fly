// Sidecar types for profile.js (hand-written JS, untouched — see
// tsconfig.json). Only the fields Sleep actually reads are declared —
// the fuller shape lives in the still-JS onboarding wizard that owns it.
export interface Profile {
  id: string;
  birthdate?: string;
  createdAt: string;
  updatedAt: string;
}

export function getProfile(): Promise<Profile | undefined>;
