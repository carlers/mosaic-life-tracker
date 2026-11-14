import { describe, expect, it } from 'vitest';
import {
  decryptDiary, encryptDiary, generateAccountRoot, generateDeviceWrappingKey,
  generateIndependentRecoverySecret, generateKeyId, generateRevision,
  generateOpaqueRowId, wrapRootForRecovery, unwrapRootFromRecovery,
  wrapRootForDevice, unwrapRootFromDevice,
} from '../../src/lib/crypto/pilotCrypto';
const owner = { projectId: '6ae94a2100014d01f5ed', ownerId: 'synthetic_a' };
function ctx() {
  return { ...owner, rowId: generateOpaqueRowId(), keyId: generateKeyId(),
    revision: generateRevision() };
}
describe('synthetic-only E2EE Diary crypto', () => {
  it('creates distinct random 256-bit key and recovery secret', () => {
    const a = generateAccountRoot(), b = generateIndependentRecoverySecret();
    expect(a).toHaveLength(32); expect(b).toHaveLength(32);
    expect([...a]).not.toEqual([...b]);
  });
  it('round-trips long UTF-8 content without plaintext in serialized envelope', async () => {
    const root = generateAccountRoot(), c = ctx();
    const p = { content: '日本語 🎈 مطر '+ 'test\n'.repeat(1500), emoji: '📒' };
    const x = await encryptDiary(root, c, p);
    expect(JSON.stringify(x)).not.toContain('日本語');
    expect(await decryptDiary(root, c, x)).toEqual(p);
  });
  it('randomizes nonce and ciphertext for same content', async () => {
    const root = generateAccountRoot(), c = ctx(), p = { content: 'x', emoji: '' };
    const x = await encryptDiary(root, c, p), y = await encryptDiary(root, c, p);
    expect(x.iv).not.toBe(y.iv); expect(x.ct).not.toBe(y.ct);
  });
  it('rejects wrong key, owner, project, row, revision or key ID', async () => {
    const root = generateAccountRoot(), c = ctx();
    const x = await encryptDiary(root, c, { content: 'secret', emoji: '' });
    await expect(decryptDiary(generateAccountRoot(), c, x)).rejects.toThrow();
    for (const bad of [
      { ...c, ownerId: 'wrong' }, { ...c, projectId: 'wrong' },
      { ...c, rowId: generateOpaqueRowId() }, { ...c, revision: generateRevision() },
      { ...c, keyId: generateKeyId() },
    ]) await expect(decryptDiary(root, bad, x)).rejects.toThrow();
  });
  it('rejects tampered and noncanonical envelopes without plaintext fallback', async () => {
    const root = generateAccountRoot(), c = ctx();
    const x = await encryptDiary(root, c, { content: 'secret', emoji: '🧪' });
    for (const bad of [
      { ...x, ct: 'AAAA' }, { ...x, ct: x.ct.slice(0, -2) },
      { ...x, iv: x.iv + '=' }, { ...x, iv: x.iv.slice(1) },
      { ...x, v: 2 }, { ...x, alg: 'A128GCM' },
      { ...x, extra: 'plaintext' }, { v: 1 },
    ]) await expect(decryptDiary(root, c, bad)).rejects.toThrow();
    await expect(encryptDiary(root, c, { content: 'a'.repeat(200000), emoji: '' })).rejects.toThrow();
  });
  it('uses separate high-entropy root wrapping for recovery, bound to owner', async () => {
    const root = generateAccountRoot(), secret = generateIndependentRecoverySecret(), kid = generateKeyId();
    const envelope = await wrapRootForRecovery(root, secret, owner, kid);
    expect([...await unwrapRootFromRecovery(secret, owner, envelope)]).toEqual([...root]);
    await expect(unwrapRootFromRecovery(generateIndependentRecoverySecret(), owner, envelope)).rejects.toThrow();
    await expect(unwrapRootFromRecovery(secret, { ...owner, ownerId: 'other' }, envelope)).rejects.toThrow();
  });
  it('uses a nonextractable, owner-bound browser device key', async () => {
    const key = await generateDeviceWrappingKey();
    expect(key.extractable).toBe(false);
    const root = generateAccountRoot();
    const envelope = await wrapRootForDevice(root, key, owner, generateKeyId());
    expect([...await unwrapRootFromDevice(key, owner, envelope)]).toEqual([...root]);
    await expect(unwrapRootFromDevice(key, { ...owner, ownerId: 'other' }, envelope)).rejects.toThrow();
    await expect(unwrapRootFromDevice(await generateDeviceWrappingKey(), owner, envelope)).rejects.toThrow();
  });
  it('validates the WebCrypto AES-GCM primitive against a published NIST vector', async () => {
    const k = await crypto.subtle.importKey('raw', new Uint8Array(16), 'AES-GCM', false, ['encrypt']);
    const raw = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(12), tagLength: 128 },
      k, new Uint8Array(16));
    expect([...new Uint8Array(raw)].map(n => n.toString(16).padStart(2, '0')).join(''))
      .toBe('0388dace60b6a392f328c2b971b2fe78ab6e47d42c371319711a46b835');
  });
});
