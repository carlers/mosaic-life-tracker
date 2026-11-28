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
  it('never silently advances a remembered generation using the same key ID',async()=>{
    const f=fixture(),setup=await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session=await setup.commit(f.gate,f.transport,f.store);
    const existing=f.getRemote()!;
    const read=vi.spyOn(f.transport,'read').mockResolvedValueOnce({
      generation:session.generation+1,envelope:structuredClone(existing.envelope),
    });
    await expect(unlockRememberedAccountRoot(
      owner,f.gate,f.transport,f.store)).rejects.toThrow('not ready');
    expect(read).toHaveBeenCalledOnce();
    // The enrollment itself persisted once; the stale remembered device is
    // not silently rewritten as a newer server root generation.
    expect(f.store.remember).toHaveBeenCalledTimes(1);
    const restored=await unlockRememberedAccountRoot(
      owner,f.gate,f.transport,f.store);
    expect(restored).toMatchObject({generation:1,keyId:session.keyId});
    expect(restored?.root).toEqual(session.root);
    expect(f.store.remember).toHaveBeenCalledTimes(1);
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

describe('M1 root lifecycle async identity/epoch snapshot regression', () => {
  it('binds recovery-key replacement to the original root and owner before suspended MFA', async () => {
    const f = fixture();
    const setup = await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session = await setup.commit(f.gate, f.transport, null);
    const original = session.root.slice();
    const changingOwner = { ...owner };
    const changingSession = { ...session, root: session.root.slice() };
    let release: (() => void) | undefined;
    const pausedGate: FullyAuthenticatedSessionGate = {
      assertReady: vi.fn(() => new Promise<void>(resolve => { release = resolve; })),
    };
    const pending = RecoveryKeyReplacement.prepare(
      changingOwner, changingSession, pausedGate, f.transport);
    // These are caller-owned references and may change while MFA awaits.
    changingOwner.ownerId = other.ownerId;
    changingSession.root.fill(0);
    changingSession.generation = 99;
    changingSession.keyId = 'k_' + 'f'.repeat(32);
    expect(release).toBeTypeOf('function');
    release?.();
    const replacement = await pending;
    await replacement.confirmSavedRecoveryKey(replacement.displayRecoveryKey);
    const renewed = await replacement.commit(f.gate, f.transport);
    expect(renewed.generation).toBe(2);
    expect(renewed.root).toEqual(original);
    expect((await recoverAccountRoot(owner, replacement.displayRecoveryKey,
      f.gate, f.transport, null)).root).toEqual(original);
  });

  it('takes immutable owner identity before suspended MFA recovery and remembered unlock', async () => {
    const f = fixture();
    const setup = await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    const session = await setup.commit(f.gate, f.transport, f.store);
    const changingOwner = { ...owner };
    let release: (() => void) | undefined;
    // Recovery has three gate checks: first is held and later are released
    // by switching the test gate after the first explicit deferred check.
    let calls = 0;
    const gate: FullyAuthenticatedSessionGate = {
      assertReady: vi.fn(async (_scope) => {
        if (++calls === 1) await new Promise<void>(resolve => { release = resolve; });
      }),
    };
    const pending = recoverAccountRoot(changingOwner,
      setup.displayRecoveryKey, gate, f.transport, null);
    changingOwner.ownerId = other.ownerId;
    release?.();
    const recovered = await pending;
    expect(recovered.root).toEqual(session.root);
    expect(vi.mocked(gate.assertReady).mock.calls.every(
      ([scope]) => scope.ownerId === owner.ownerId)).toBe(true);
    const changingOwner2 = { ...owner };
    const held = {resolve: undefined as (() => void) | undefined};
    let count = 0;
    const delayed: FullyAuthenticatedSessionGate = {
      assertReady: vi.fn(async (_scope) => {
        if (++count === 1) await new Promise<void>(resolve => { held.resolve = resolve; });
      }),
    };
    const waiting = unlockRememberedAccountRoot(changingOwner2,
      delayed, f.transport, f.store);
    changingOwner2.ownerId = other.ownerId;
    held.resolve?.();
    expect((await waiting)?.root).toEqual(session.root);
    expect(vi.mocked(delayed.assertReady).mock.calls.every(
      ([scope]) => scope.ownerId === owner.ownerId)).toBe(true);
  });

  it('rejects changed authoritative envelope or epoch during emergency recovery', async () => {
    const f = fixture();
    const setup = await InitialRootEnrollment.prepare(owner);
    await setup.confirmSavedRecoveryKey(setup.displayRecoveryKey);
    await setup.commit(f.gate, f.transport, null);
    const row = f.getRemote();
    expect(row).not.toBeNull();
    const changed = { generation: 2, envelope: row!.envelope };
    const changedRead = vi.spyOn(f.transport, 'read')
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(changed);
    await expect(recoverAccountRoot(owner, setup.displayRecoveryKey,
      f.gate, f.transport, f.store)).rejects.toThrow();
    expect(f.store.remember).not.toHaveBeenCalled();
    expect(changedRead).toHaveBeenCalledTimes(2);
  });
});


describe('dormant M1 trusted callback identity is immutable after enrollment',()=>{
  it('blocks synchronous account-switch attempts by MFA and remote transport callbacks',async()=>{
    const f=fixture();
    const attempted=(scope:Owner)=>{
      expect(scope).toEqual(owner);
      expect(Object.isFrozen(scope)).toBe(true);
      // Reflect.set avoids strict-mode TypeError, so the test can assert the
      // exact object being passed to the asynchronous callback is immutable.
      expect(Reflect.set(scope,'ownerId',other.ownerId)).toBe(false);
      expect(scope.ownerId).toBe(owner.ownerId);
    };
    const gate:FullyAuthenticatedSessionGate={
      assertReady:vi.fn(async scope=>{attempted(scope);}),
    };
    const transport:AtomicRootTransport={
      create:vi.fn(async (scope,envelope)=>{
        attempted(scope);
        return f.transport.create(scope,envelope);
      }),
      read:vi.fn(async scope=>{
        attempted(scope);
        return f.transport.read(scope);
      }),
      replace:vi.fn(async (scope,expected,envelope)=>{
        attempted(scope);
        return f.transport.replace(scope,expected,envelope);
      }),
    };
    const prepared=await InitialRootEnrollment.prepare({...owner});
    await prepared.confirmSavedRecoveryKey(prepared.displayRecoveryKey);
    const opened=await prepared.commit(gate,transport,null);
    expect(opened.generation).toBe(1);
    expect((await recoverAccountRoot({...owner},prepared.displayRecoveryKey,
      gate,transport,null)).root).toEqual(opened.root);
    const renewal=await RecoveryKeyReplacement.prepare({...owner},opened,gate,transport);
    await renewal.confirmSavedRecoveryKey(renewal.displayRecoveryKey);
    expect((await renewal.commit(gate,transport)).generation).toBe(2);
    expect(f.getRemote()?.generation).toBe(2);
    expect(vi.mocked(gate.assertReady).mock.calls.length).toBeGreaterThan(5);
  });
});
