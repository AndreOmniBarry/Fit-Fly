// AES-GCM encryption keyed by a PBKDF2-derived key, via the Web Crypto
// API — used specifically for the cycle-tracking data (see
// js/features/womens-health/). Nothing here is a custom cipher: it's the
// browser's own audited crypto primitives, just wired together.
//
// The PIN itself is never stored anywhere, in any form. Losing it means
// losing the data it protects — that's the correct, honest behavior for
// real encryption, not a design gap. AES-GCM's built-in authentication
// tag does double duty as PIN verification: decrypting a known probe
// value with the wrong key throws, so there's no separate password-hash
// scheme to get subtly wrong.

const PBKDF2_ITERATIONS = 250000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // the standard/recommended nonce size for AES-GCM

export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export function generateIv() {
  return crypto.getRandomValues(new Uint8Array(IV_BYTES));
}

/** Derives a non-extractable AES-GCM key from a PIN + salt. The same PIN
 *  and salt always derive the same key, but the key material itself can
 *  never be read back out via the Web Crypto API (`extractable: false`). */
export async function deriveKeyFromPin(pin, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(key, iv, data) {
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return new Uint8Array(cipherBuffer);
}

/** Throws if `key` is wrong for this ciphertext — AES-GCM's built-in
 *  authentication tag makes tampering/wrong-key detectable, not just
 *  garbled output. */
export async function decryptJson(key, iv, cipherBytes) {
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return JSON.parse(new TextDecoder().decode(plainBuffer));
}

const PIN_PROBE_VALUE = { probe: 'fit-fly-pin-check' };

/** Encrypts a known constant with a freshly derived key — the "verifier"
 *  a later PIN attempt is checked against (by trying to decrypt it; a
 *  wrong PIN derives a different key, and decryption fails). */
export async function createPinVerifier(pin) {
  const salt = generateSalt();
  const iv = generateIv();
  const key = await deriveKeyFromPin(pin, salt);
  const cipherBytes = await encryptJson(key, iv, PIN_PROBE_VALUE);
  return { salt, iv, cipherBytes };
}

/** Returns the derived key on a correct PIN, or null on an incorrect one
 *  — never throws for a wrong PIN (that's an expected outcome, not an
 *  error condition the caller should have to try/catch). */
export async function verifyPin(pin, verifier) {
  try {
    const key = await deriveKeyFromPin(pin, verifier.salt);
    const decrypted = await decryptJson(key, verifier.iv, verifier.cipherBytes);
    if (decrypted?.probe !== PIN_PROBE_VALUE.probe) return null;
    return key;
  } catch {
    return null;
  }
}
