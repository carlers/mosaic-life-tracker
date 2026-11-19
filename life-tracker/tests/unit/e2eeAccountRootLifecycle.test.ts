import { describe, expect, it, vi } from 'vitest';
import {
  type Owner, type RootEnvelope, generateAccountRoot,
} from '../../src/lib/e2ee/coreCrypto';
import {
  AccountRootConflictError, InitialRootEnrollment, RecoveryKeyReplacement,
  recoverAccountRoot, unlockRememberedAccountRoot,
  type AtomicRootTransport, type CryptoSession, type FullyAuthenticatedSessionGate,
  type RememberedRootStore, type RootGeneration,
} from '../../src/lib/e2ee/accountRootLifecycle';

const owner: Owner = { projectId: 'scratch_project', ownerId: 'synthetic_owner' };
const other: Owner = { projectId: 'scratch_project', ownerId: 'other_owner' };
function fixture() {
  let latest: RootGeneration | null = null;
  const create = vi.fn(async (_: Owner, envelope: RootEnvelope) => {
    if (latest) {
      return latest.envelope.ct === envelope.ct ? 'duplicate' : 'conflict';
    }
    latest = { envelope, generation: 1 };
    return 'created';
  });
  const read = vi.fn(async (_: Owner) => latest);
  const replace = vi.fn(async (_: Owner, expected: RootGeneration, envelope: RootEnvelope) => {
    if (!latest || latest.generation !== expected.generation ||
        latest.envelope.ct !== expected.envelope.ct) return 'conflict';
    latest = { generation: latest.generation + 1, envelope };
    return 'updated';
  });
  const transport = { create, read, replace } as AtomicRootTransport;
  let remembered: CryptoSession | null = null;
  const store: RememberedRootStore = {
    remember: vi.fn(async (_o, root, keyId, generation) => {
      remembered = { root: root.slice(), keyId, generation };
    }),
    unlock: vi.fn(async _o => remembered),
  };
  const gate: FullyAuthenticatedSessionGate = { assertReady: vi.fn(async _o => {}) };
  return { transport, store, gate, getRemote: () => latest };
}

describe('M1 account key lifecycle — NOT enabled for normal app sync', () => {
  it('does not publish anything before the user proves the saved key works', async () => {
    const f = fixture();
    const prepared = await InitialRootEnrollment.prepare(owner);
    expect(prepared.displayRecoveryKey).toMatch(/^mosaic1-/);
    await expect(prepared.commit(f.gate, f.transport, f.store)).rejects.toThrow();
    expect(f.transport.create).not.toHaveBeenCalled();
    await expect(prepared.confirmSavedRecoveryKey('123456')).rejects.toThrow();
    expect(prepared.confirmed).toBe(false);
    await prepared.confirmSavedRecoveryKey(prepared.displayRecoveryKey);
    const session = await prepared.commit(f.gate, f.transport, f.store);
    expect(session.root).toHaveLength(32);
    expect(f.getRemote()?.generation).toBe(1);
    expect(JSON.stringify(f.getRemote())).not.toContain(prepared.displayRecoveryKey);
    expect(f.store.remember).toHaveBeenCalledOnce();
  });
  it('prevents competing first-device roots from silently overwriting', async () => {
    const f = fixture(), a = await InitialRootEnrollment.prepare(owner);
    const b = await InitialRootEnrollment.prepare(owner);
    await a.confirmSavedRecoveryKey(a.displayRecoveryKey);
    await b.confirmSavedRecoveryKey(b.displayRecoveryKey);
    const winner = await a.commit(f.gate, f.transport, null);
    await expect(b.commit(f.gate, f.transport, f.store)).rejects.toBeInstanceOf(AccountRootConflictError);
    expect((await recoverAccountRoot(owner, a.displayRecoveryKey,
      f.gate, f.transport, null)).root).toEqual(winner.root);
    await expect(recoverAccountRoot(owner, b.displayRecoveryKey,
      f.gate, f.transport, null)).rejects.toThrow();
    expect(f.store.remember).not.toHaveBeenCalled();
  });
  it('does not unlock until authoritative readback and durable local remember', async () => {
    const f=fixture(), a=await InitialRootEnrollment.prepare(owner);
    await a.confirmSavedRecoveryKey(a.displayRecoveryKey);
    const read = vi.spyOn(f.transport,'read').mockRejectedValueOnce(new Error('offline'));
    await expect(a.commit(f.gate,f.transport,f.store)).rejects.toThrow('offline');
    expect(f.store.remember).not.toHaveBeenCalled();
    read.mockRestore();
    // The same candidate envelope may be retried idempotently after a lost read response.
    await expect(a.commit(f.gate,f.transport,f.store)).resolves.toHaveProperty('generation',1);
    vi.spyOn(f.store,'remember').mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(a.commit(f.gate,f.transport,f.store)).rejects.toThrow('quota exceeded');
  });
  it('requires full session authorization before any remote operation', async () => {
    const f=fixture(), a=await InitialRootEnrollment.prepare(owner);
    await a.confirmSavedRecoveryKey(a.displayRecoveryKey);
    vi.spyOn(f.gate,'assertReady').mockRejectedValueOnce(new Error('MFA required'));
    await expect(a.commit(f.gate,f.transport,null)).rejects.toThrow('MFA required');
    expect(f.transport.create).not.toHaveBeenCalled();
  });
  it('recovers on a fresh device and fails with wrong account or wrong key', async () => {
    const f=fixture(), setup=await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session=await setup.commit(f.gate,f.transport,null);
    expect((await recoverAccountRoot(owner,setup.displayRecoveryKey,f.gate,f.transport,f.store)).root).toEqual(session.root);
    await expect(recoverAccountRoot(other,setup.displayRecoveryKey,f.gate,f.transport,null)).rejects.toThrow();
    await expect(recoverAccountRoot(owner,'mosaic1-not-a-valid-key',f.gate,f.transport,null)).rejects.toThrow();
  });
  it('blocks remembered-device rollback and unknown key IDs', async () => {
    const f=fixture(), setup=await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session=await setup.commit(f.gate,f.transport,f.store);
    expect((await unlockRememberedAccountRoot(owner,f.gate,f.transport,f.store))?.root).toEqual(session.root);
    const spoof=vi.spyOn(f.store,'unlock').mockResolvedValueOnce({
      ...session,keyId:'k_'+'f'.repeat(32),
    });
    await expect(unlockRememberedAccountRoot(owner,f.gate,f.transport,f.store)).rejects.toThrow();
    spoof.mockRestore();
    vi.spyOn(f.store,'unlock').mockResolvedValueOnce({
      ...session,generation:session.generation+5,
    });
    await expect(unlockRememberedAccountRoot(owner,f.gate,f.transport,f.store)).rejects.toThrow();
  });
  it('requires independently saved and verified new key before CAS replacement', async () => {
    const f=fixture(), setup=await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session=await setup.commit(f.gate,f.transport,null);
    const rotation=await RecoveryKeyReplacement.prepare(owner,session,f.gate,f.transport);
    await expect(rotation.commit(f.gate,f.transport)).rejects.toThrow();
    await rotation.confirmSavedRecoveryKey(rotation.displayRecoveryKey);
    const updated=await rotation.commit(f.gate,f.transport);
    expect(updated.generation).toBe(2);
    expect(updated.root).toEqual(session.root);
    expect((await recoverAccountRoot(owner,rotation.displayRecoveryKey,f.gate,f.transport,null)).root).toEqual(session.root);
    await expect(recoverAccountRoot(owner,setup.displayRecoveryKey,f.gate,f.transport,null)).rejects.toThrow();
  });
  it('rejects stale concurrent replacement without lost updates', async () => {
    const f=fixture(), setup=await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session=await setup.commit(f.gate,f.transport,null);
    const a=await RecoveryKeyReplacement.prepare(owner,session,f.gate,f.transport);
    const b=await RecoveryKeyReplacement.prepare(owner,session,f.gate,f.transport);
    await a.confirmSavedRecoveryKey(a.displayRecoveryKey);
    await b.confirmSavedRecoveryKey(b.displayRecoveryKey);
    await a.commit(f.gate,f.transport);
    await expect(b.commit(f.gate,f.transport)).rejects.toBeInstanceOf(AccountRootConflictError);
    expect(f.getRemote()?.generation).toBe(2);
  });
  it('refuses remote recovery if no established root exists', async () => {
    const f=fixture();
    await expect(recoverAccountRoot(owner,'mosaic1-abc',f.gate,f.transport,null)).rejects.toThrow();
    expect((await unlockRememberedAccountRoot(owner,f.gate,f.transport,f.store))).toBe(null);
  });
  it('keeps the 256-bit root in memory only; secret is independent from it', async () => {
    const f=fixture(), setup=await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session=await setup.commit(f.gate,f.transport,null);
    expect(session.root).not.toEqual(generateAccountRoot());
    expect(JSON.stringify(setup)).toBe('{}');
    expect(JSON.stringify(f.getRemote())).not.toContain('mosaic1-');
  });
});
