import { describe, expect, it } from 'vitest';
import {
  generateAccountRoot, generateIndependentRecoverySecret,
  generateKeyId, generateOpaqueRowId, generateRevision,
  encryptPrivateRecord, decryptPrivateRecord,
  deriveMigratedOwnerRowId,
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
  it('derives stable separate pseudorandom IDs for new workout and task-link migration domains', async () => {
    const root = generateAccountRoot(), scope = { projectId:'scratch', ownerId:'owner_1' };
    const sourceId = 'private_activity_local_id';
    const activity = await deriveMigratedOwnerRowId(root,scope,'activity',sourceId);
    const link = await deriveMigratedOwnerRowId(root,scope,'activity-task-link',sourceId);
    expect(activity).toMatch(/^p_[a-f0-9]{32}$/);
    expect(link).toMatch(/^p_[a-f0-9]{32}$/);
    expect(activity).not.toBe(link);
    expect(await deriveMigratedOwnerRowId(root,scope,'activity',sourceId)).toBe(activity);
    expect(await deriveMigratedOwnerRowId(root,{...scope,ownerId:'other'},'activity',sourceId)).not.toBe(activity);
    expect(await deriveMigratedOwnerRowId(root,{...scope,projectId:'different'},'activity',sourceId)).not.toBe(activity);
    expect(await deriveMigratedOwnerRowId(generateAccountRoot(),scope,'activity',sourceId)).not.toBe(activity);
    await expect(deriveMigratedOwnerRowId(root,scope,'chat-message',sourceId)).rejects.toThrow();
  });
  it('derives stable, owner-specific opaque IDs for concurrent legacy migrations', async () => {
    const root = generateAccountRoot();
    const scope = { projectId: 'scratch', ownerId: 'synthetic_a' };
    const id1 = await deriveMigratedOwnerRowId(root, scope, 'diary', '2026-11-19');
    const id2 = await deriveMigratedOwnerRowId(root, scope, 'diary', '2026-11-19');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^p_[a-f0-9]{32}$/);
    expect(id1).not.toContain('2026');
    for (const changed of [
      deriveMigratedOwnerRowId(root, scope, 'task', '2026-11-19'),
      deriveMigratedOwnerRowId(root, { ...scope, ownerId: 'synthetic_b' }, 'diary', '2026-11-19'),
      deriveMigratedOwnerRowId(root, { ...scope, projectId: 'different' }, 'diary', '2026-11-19'),
      deriveMigratedOwnerRowId(generateAccountRoot(), scope, 'diary', '2026-11-19'),
      deriveMigratedOwnerRowId(root, scope, 'diary', '2026-11-20'),
    ]) expect(await changed).not.toBe(id1);
    await expect(deriveMigratedOwnerRowId(root, scope, 'chat-message', 'secret')).rejects.toThrow();
    await expect(deriveMigratedOwnerRowId(root, scope, 'diary', '')).rejects.toThrow();
  });
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
    expect(ownerPrivacyFields.tasks.date).toBe('encrypted');
    expect(ownerPrivacyFields.messages.content).toBe('encrypted');
    expect(isPrivatePayloadDomain('chat-message')).toBe(true);
    expect(isPrivatePayloadDomain('user-chosen-unreviewed')).toBe(false);
  });
});

describe('source-only crypto primitives pin mutable owner/root/context inputs before crypto awaits',()=>{
  it('private-record AEAD remains bound to original root/context/routing and payload',async()=>{
    const root=generateAccountRoot(),originalRoot=root.slice();
    const stable=ctx('task');
    const original={...stable,publicRouting:{userId:stable.ownerId,isDeleted:false}};
    const mutContext={...stable,publicRouting:{...original.publicRouting}};
    const payload={id:'SYNTHETIC_PRIVATE_AEAD',date:'2045-01-01'};
    const pending=encryptPrivateRecord(root,mutContext,payload);
    root.fill(0);
    mutContext.ownerId='mutated_owner';
    mutContext.rowId=generateOpaqueRowId();
    mutContext.publicRouting.userId='mutated_owner';
    payload.id='mutated_id';
    const sealed=await pending;
    const decoded=await decryptPrivateRecord(originalRoot,original,sealed);
    expect(decoded).toEqual({id:'SYNTHETIC_PRIVATE_AEAD',date:'2045-01-01'});
    const decryptContext={...original,publicRouting:{...original.publicRouting}};
    const incoming=structuredClone(sealed);
    const inputRoot=originalRoot.slice();
    const opened=decryptPrivateRecord(inputRoot,decryptContext,incoming);
    inputRoot.fill(0);
    decryptContext.rowId=generateOpaqueRowId();
    decryptContext.publicRouting.userId='altered';
    (incoming as unknown as {ct:string}).ct='corrupted';
    expect(await opened).toEqual(decoded);
  });
  it('recovery root wrapping and migrated opaque IDs ignore post-call caller mutation',async()=>{
    const root=generateAccountRoot(),originalRoot=root.slice();
    const recovery=generateIndependentRecoverySecret(),originalRecovery=recovery.slice();
    const scope={projectId:'synthetic',ownerId:'locked_owner'};
    const scopeOriginal={...scope};
    const kid=generateKeyId();
    const wrapping=wrapRootForRecovery(root,recovery,scope,kid);
    root.fill(0);recovery.fill(0);scope.ownerId='mutated_owner';
    const envelope=await wrapping;
    expect(await unwrapRootFromRecovery(originalRecovery,scopeOriginal,envelope))
      .toEqual(originalRoot);
    const mutableRoot=originalRoot.slice(),mutableScope={...scopeOriginal};
    const pending=deriveMigratedOwnerRowId(mutableRoot,mutableScope,
      'task','original_private_task');
    mutableRoot.fill(0);
    mutableScope.ownerId='changed_after_call';
    expect(await pending).toEqual(await deriveMigratedOwnerRowId(
      originalRoot,scopeOriginal,'task','original_private_task'));
  });
});
