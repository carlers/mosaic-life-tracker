import { describe, expect, it } from 'vitest';
import {
  generateAccountRoot, generateIndependentRecoverySecret,
  generateKeyId, generateOpaqueRowId, generateRevision,
  encryptPrivateRecord, decryptPrivateRecord,
  generateDeviceWrappingKey, wrapRootForDevice, unwrapRootFromDevice,
  wrapRootForRecovery, unwrapRootFromRecovery,
  formatEmergencyRecoveryKey, parseEmergencyRecoveryKey,
} from '../../src/lib/e2ee/coreCrypto';
import { isPrivatePayloadDomain } from '../../src/lib/e2ee/domainRegistry';
import { ownerPrivacyFields } from '../../src/lib/e2ee/fieldManifest';

const owner = { projectId: 'scratch_project_id', ownerId: 'synthetic_only_owner' };
function ctx(payloadDomain: 'diary' | 'task' = 'diary') {
  return { ...owner, payloadDomain, rowId: generateOpaqueRowId(),
    keyId: generateKeyId(), revision: generateRevision() };
}

describe('M0/M1 E2EE crypto foundation (no normal-app activation)', () => {
  it('uses independent 256-bit secrets and typo-detecting recovery key', async () => {
    const root = generateAccountRoot();
    const recovery = generateIndependentRecoverySecret();
    expect(root).toHaveLength(32);
    expect(recovery).toHaveLength(32);
    expect([...root]).not.toEqual([...recovery]);
    const printable = await formatEmergencyRecoveryKey(recovery);
    expect(printable).toMatch(/^mosaic1-/);
    expect([...await parseEmergencyRecoveryKey(printable)]).toEqual([...recovery]);
    await expect(parseEmergencyRecoveryKey(printable.replace(/^mosaic1-./, 'mosaic1-!'))).rejects.toThrow();
  });
  it('encrypts JSON business fields without plaintext in network envelope', async () => {
    const root = generateAccountRoot(), c = ctx();
    const plain = { content: 'Mosaic 秘密 📔', emoji: '🌙', photos: ['opaque'] };
    const sealed = await encryptPrivateRecord(root, c, plain);
    expect(JSON.stringify(sealed)).not.toContain('Mosaic');
    expect(await decryptPrivateRecord(root, c, sealed)).toEqual(plain);
    expect(sealed.alg).toBe('A256GCM');
  });
  it('separates domains and owner/project/row/revision/key contexts', async () => {
    const root = generateAccountRoot(), c = ctx();
    const sealed = await encryptPrivateRecord(root, c, { content: 'sensitive' });
    for (const wrong of [
      { ...c, payloadDomain: 'task' as const },
      { ...c, ownerId: 'other' }, { ...c, projectId: 'other' },
      { ...c, rowId: generateOpaqueRowId() },
      { ...c, revision: generateRevision() },
      { ...c, keyId: generateKeyId() },
    ]) await expect(decryptPrivateRecord(root, wrong, sealed)).rejects.toThrow();
    await expect(decryptPrivateRecord(generateAccountRoot(), c, sealed)).rejects.toThrow();
  });
  it('does not reuse a nonce and rejects forged/plaintext/malformed envelopes', async () => {
    const root = generateAccountRoot(), c = ctx('task');
    const a = await encryptPrivateRecord(root, c, { title: 'private task' });
    const b = await encryptPrivateRecord(root, c, { title: 'private task' });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    for (const invalid of [
      { ...a, ct: 'AAAA' }, { ...a, iv: a.iv + '=' },
      { ...a, alg: 'A128GCM' }, { ...a, v: 2 },
      { ...a, accidentalPlaintext: 'task' }, { title: 'private task' },
    ]) await expect(decryptPrivateRecord(root, c, invalid)).rejects.toThrow();
    await expect(encryptPrivateRecord(root, c, { text: 'x'.repeat(160000) })).rejects.toThrow();
  });
  it('authenticates canonical routing metadata without treating it as ciphertext', async () => {
    const key = generateAccountRoot(), c = { ...ctx(), publicRouting: { date: '2026-11-19', deleted: false } };
    const sealed = await encryptPrivateRecord(key, c, { content: 'secret' });
    await expect(decryptPrivateRecord(key, { ...c, publicRouting: { date: '2026-11-20', deleted: false } }, sealed)).rejects.toThrow();
    expect(await decryptPrivateRecord(key, { ...c, publicRouting: { deleted: false, date: '2026-11-19' } }, sealed))
      .toEqual({ content: 'secret' });
    await expect(encryptPrivateRecord(key, { ...c, publicRouting: { name: { nested: 'invalid' } } }, { x: 1 }))
      .rejects.toThrow();
  });
  it('unwraps independently with emergency key and remembered browser key', async () => {
    const root = generateAccountRoot(), emergency = generateIndependentRecoverySecret();
    const kid = generateKeyId();
    const wrappedRecovery = await wrapRootForRecovery(root, emergency, owner, kid);
    expect([...await unwrapRootFromRecovery(emergency, owner, wrappedRecovery)]).toEqual([...root]);
    await expect(unwrapRootFromRecovery(generateIndependentRecoverySecret(), owner, wrappedRecovery)).rejects.toThrow();
    const deviceKey = await generateDeviceWrappingKey();
    expect(deviceKey.extractable).toBe(false);
    const wrappedDevice = await wrapRootForDevice(root, deviceKey, owner, kid);
    expect([...await unwrapRootFromDevice(deviceKey, owner, wrappedDevice)]).toEqual([...root]);
    await expect(unwrapRootFromDevice(deviceKey, { ...owner, ownerId: 'other' }, wrappedDevice)).rejects.toThrow();
  });
  it('classifies current owner model fields and rejects unknown domains', () => {
    expect(ownerPrivacyFields.diary.content).toBe('encrypted');
    expect(ownerPrivacyFields.tasks.date).toBe('routing');
    expect(ownerPrivacyFields.messages.content).toBe('encrypted');
    expect(isPrivatePayloadDomain('chat-message')).toBe(true);
    expect(isPrivatePayloadDomain('user-chosen-unreviewed')).toBe(false);
  });
});
