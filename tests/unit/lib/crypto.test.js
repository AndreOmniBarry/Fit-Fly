import { describe, expect, it } from 'vitest';
import {
  createPinVerifier,
  decryptJson,
  deriveKeyFromPin,
  encryptJson,
  generateIv,
  generateSalt,
  verifyPin,
} from '../../../js/lib/crypto.js';

describe('encryptJson / decryptJson round-trip', () => {
  it('recovers the exact original object', async () => {
    const salt = generateSalt();
    const iv = generateIv();
    const key = await deriveKeyFromPin('1234', salt);
    const original = { flowIntensity: 'medium', symptoms: ['cramps', 'fatigue'], notes: 'felt okay today' };

    const cipherBytes = await encryptJson(key, iv, original);
    expect(cipherBytes).toBeInstanceOf(Uint8Array);

    const decrypted = await decryptJson(key, iv, cipherBytes);
    expect(decrypted).toEqual(original);
  });

  it('the ciphertext is not the plaintext in disguise', async () => {
    const salt = generateSalt();
    const iv = generateIv();
    const key = await deriveKeyFromPin('1234', salt);
    const cipherBytes = await encryptJson(key, iv, { notes: 'a secret note about symptoms' });

    const asText = new TextDecoder('utf-8', { fatal: false }).decode(cipherBytes);
    expect(asText).not.toContain('secret note about symptoms');
  });

  it('decrypting with the wrong key throws rather than returning garbage', async () => {
    const salt = generateSalt();
    const iv = generateIv();
    const rightKey = await deriveKeyFromPin('1234', salt);
    const wrongKey = await deriveKeyFromPin('9999', salt);
    const cipherBytes = await encryptJson(rightKey, iv, { secret: true });

    await expect(decryptJson(wrongKey, iv, cipherBytes)).rejects.toThrow();
  });

  it('the same PIN with a different salt derives a different key', async () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    const keyA = await deriveKeyFromPin('1234', saltA);
    const keyB = await deriveKeyFromPin('1234', saltB);
    const iv = generateIv();
    const cipherBytes = await encryptJson(keyA, iv, { x: 1 });

    await expect(decryptJson(keyB, iv, cipherBytes)).rejects.toThrow();
  });
});

describe('PIN verifier: createPinVerifier / verifyPin', () => {
  it('accepts the correct PIN and returns a usable key', async () => {
    const verifier = await createPinVerifier('4242');
    const key = await verifyPin('4242', verifier);
    expect(key).not.toBeNull();

    // the returned key actually works for real encryption
    const iv = generateIv();
    const cipherBytes = await encryptJson(key, iv, { ok: true });
    expect(await decryptJson(key, iv, cipherBytes)).toEqual({ ok: true });
  });

  it('rejects an incorrect PIN without throwing', async () => {
    const verifier = await createPinVerifier('4242');
    await expect(verifyPin('0000', verifier)).resolves.toBeNull();
  });

  it('two verifiers for the same PIN use independent random salts (not reused)', async () => {
    const verifierA = await createPinVerifier('4242');
    const verifierB = await createPinVerifier('4242');
    expect(verifierA.salt).not.toEqual(verifierB.salt);
  });
}, 20000);
