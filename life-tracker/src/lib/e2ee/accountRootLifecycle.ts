/**
 * Stage-1 source-only account root lifecycle (#1662/#2083).
 *
 * No normal-app sync uses this module. The remote transport MUST implement
 * server-authenticated owner/MFA, an atomic first-create and an atomic
 * generation compare-and-swap. Do not substitute a browser-only check.
 *
 * The emergency key is an independent random 256-bit secret. A user's saved
 * copy is indispensable after losing all remembered devices. Never transmit
 * the key itself through the server transport or persist the key in clear.
 */
import {
  type Bytes, type Owner, type RootEnvelope,
  generateAccountRoot, generateIndependentRecoverySecret, generateKeyId,
  formatEmergencyRecoveryKey, parseEmergencyRecoveryKey,
  wrapRootForRecovery, unwrapRootFromRecovery,
} from './coreCrypto';

export type RootGeneration = Readonly<{
  generation: number;
  envelope: RootEnvelope;
}>;

export type CryptoSession = Readonly<{
  root: Bytes; // Memory-only; may be passed only to reviewed client codecs.
  keyId: string;
  generation: number;
}>;

export interface FullyAuthenticatedSessionGate {
  // Appwrite account authentication AND completed MFA, never cached identity.
  assertReady(owner: Owner): Promise<void>;
}

export interface AtomicRootTransport {
  // The backend must enforce a unique owner row. No overwrites on conflict.
  create(owner: Owner, envelope: RootEnvelope): Promise<'created' | 'duplicate' | 'conflict'>;
  read(owner: Owner): Promise<RootGeneration | null>;
  // Backend must condition on both the expected epoch AND existing envelope
  // identity. Accepting only a client-side read/compare is not safe.
  replace(
    owner: Owner, expected: RootGeneration, envelope: RootEnvelope,
  ): Promise<'updated' | 'conflict'>;
}

export interface RememberedRootStore {
  // Local writes are durable IndexedDB commits, not best-effort promises.
  remember(owner: Owner, root: Bytes, keyId: string, generation: number): Promise<void>;
  unlock(owner: Owner): Promise<CryptoSession | null>;
}

const KEY_PATTERN = /^k_[a-f0-9]{32}$/;

export class AccountRootConflictError extends Error {
  constructor() {
    super('An encryption root already exists. Recover the existing root; do not overwrite it.');
    this.name = 'AccountRootConflictError';
  }
}

function unavailable(): never {
  throw new Error('Encryption root is not ready. Existing encrypted data was not changed.');
}
/** Copy caller-owned identity and cryptographic state before the first await. */
function snapshotOwner(owner: Owner): Owner {
  if (!owner || typeof owner.projectId !== 'string' || !owner.projectId ||
      typeof owner.ownerId !== 'string' || !owner.ownerId) unavailable();
  return Object.freeze({ projectId: owner.projectId, ownerId: owner.ownerId });
}
function snapshotRemote(row: RootGeneration | null): RootGeneration {
  validateRemote(row);
  try { return { generation: row.generation, envelope: structuredClone(row.envelope) }; }
  catch { return unavailable(); }
}
function snapshotSession(owner: Owner, session: CryptoSession): CryptoSession {
  ensureKey(owner, session);
  return { root: session.root.slice(), keyId: session.keyId, generation: session.generation };
}

function validateRemote(row: RootGeneration | null): asserts row is RootGeneration {
  if (!row || !Number.isSafeInteger(row.generation) || row.generation < 1 ||
      !row.envelope || !KEY_PATTERN.test(row.envelope.kid)) unavailable();
}
function sameEnvelope(a: RootEnvelope, b: RootEnvelope): boolean {
  return a.v === b.v && a.alg === b.alg && a.kid === b.kid &&
    a.iv === b.iv && a.ct === b.ct;
}
function sameKey(a: Bytes, b: Bytes): boolean {
  if (a.length !== 32 || b.length !== 32) return false;
  let difference = 0;
  for (let i = 0; i < 32; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
function ensureKey(owner: Owner, session: CryptoSession): void {
  if (!owner?.projectId || !owner?.ownerId || !KEY_PATTERN.test(session.keyId) ||
      !Number.isSafeInteger(session.generation) || session.generation < 1 ||
      !(session.root instanceof Uint8Array) || session.root.length !== 32) unavailable();
}

/**
 * Prepare locally first. No server record exists at this point.
 * The user must save the printed key AND re-enter it successfully before
 * commit. If another device wins initialization, this candidate is discarded.
 */
export class InitialRootEnrollment {
  readonly #owner: Owner;
  readonly #root: Bytes;
  readonly #envelope: RootEnvelope;
  readonly #keyText: string;
  #confirmed = false;

  private constructor(owner: Owner, root: Bytes, envelope: RootEnvelope, text: string) {
    this.#owner = Object.freeze({ projectId: owner.projectId, ownerId: owner.ownerId });
    this.#root = root;
    this.#envelope = envelope;
    this.#keyText = text;
  }

  static async prepare(owner: Owner): Promise<InitialRootEnrollment> {
    const scope = snapshotOwner(owner);
    const root = generateAccountRoot();
    const recovery = generateIndependentRecoverySecret();
    const kid = generateKeyId();
    try {
      const envelope = await wrapRootForRecovery(root, recovery, scope, kid);
      const text = await formatEmergencyRecoveryKey(recovery);
      return new InitialRootEnrollment(scope, root, envelope, text);
    } catch (error) {
      // Enrollment never hands an unconfirmed root to a caller on failure.
      root.fill(0);
      throw error;
    } finally {
      recovery.fill(0);
    }
  }

  get displayRecoveryKey(): string { return this.#keyText; }
  get confirmed(): boolean { return this.#confirmed; }

  async confirmSavedRecoveryKey(retypedKey: string): Promise<void> {
    const secret = await parseEmergencyRecoveryKey(retypedKey);
    try {
      const unwrapped = await unwrapRootFromRecovery(secret, this.#owner, this.#envelope);
      try {
        if (!sameKey(unwrapped, this.#root)) unavailable();
        this.#confirmed = true;
      } finally {
        unwrapped.fill(0);
      }
    } finally {
      secret.fill(0);
    }
  }

  async commit(
    gate: FullyAuthenticatedSessionGate,
    transport: AtomicRootTransport,
    devices: RememberedRootStore | null,
  ): Promise<CryptoSession> {
    if (!this.#confirmed) unavailable();
    await gate.assertReady(this.#owner);
    const outcome = await transport.create(this.#owner, structuredClone(this.#envelope));
    if (outcome === 'conflict') throw new AccountRootConflictError();
    if (outcome !== 'created' && outcome !== 'duplicate') unavailable();
    // Confirm the authoritative row. A success response without readback does
    // not unlock protected sync, even if the remote create actually succeeded.
    const row = snapshotRemote(await transport.read(this.#owner));
    if (row.generation !== 1 || !sameEnvelope(row.envelope, this.#envelope)) {
      throw new AccountRootConflictError();
    }
    // If remembering was requested, a failed local store transaction leaves
    // the account locked; the saved emergency key can still recover the root.
    await gate.assertReady(this.#owner);
    if (devices) {
      const temporary = this.#root.slice();
      try {
        await devices.remember(this.#owner, temporary, row.envelope.kid, row.generation);
      } finally {
        temporary.fill(0);
      }
    }
    return { root: this.#root.slice(), keyId: row.envelope.kid, generation: row.generation };
  }
}

/** Recovery must work on a fresh device; no old IndexedDB state is needed. */
export async function recoverAccountRoot(
  owner: Owner, retypedRecoveryKey: string,
  gate: FullyAuthenticatedSessionGate,
  transport: AtomicRootTransport,
  devices: RememberedRootStore | null,
): Promise<CryptoSession> {
  const scope = snapshotOwner(owner);
  await gate.assertReady(scope);
  const row = snapshotRemote(await transport.read(scope));
  const secret = await parseEmergencyRecoveryKey(retypedRecoveryKey);
  let root: Bytes;
  try { root = await unwrapRootFromRecovery(secret, scope, row.envelope); }
  finally { secret.fill(0); }
  let handedOff = false;
  try {
    // An expired MFA session or a remote generation change during recovery
    // must not quietly persist the decrypted root from a stale server snapshot.
    await gate.assertReady(scope);
    const current = snapshotRemote(await transport.read(scope));
    if (current.generation !== row.generation ||
        !sameEnvelope(current.envelope, row.envelope)) unavailable();
    if (devices) {
      const temporary = root.slice();
      try {
        await devices.remember(scope, temporary, row.envelope.kid, row.generation);
      } finally {
        temporary.fill(0);
      }
    }
    await gate.assertReady(scope);
    handedOff = true;
    return { root, keyId: row.envelope.kid, generation: row.generation };
  } finally {
    // The returned root belongs to the caller. Any rejected recovery must
    // instead erase the authenticated plaintext root before unwinding.
    if (!handedOff) root.fill(0);
  }
}

/** A remembered key cannot silently adopt an unrecognized root or rollback. */
export async function unlockRememberedAccountRoot(
  owner: Owner,
  gate: FullyAuthenticatedSessionGate,
  transport: AtomicRootTransport,
  devices: RememberedRootStore,
): Promise<CryptoSession | null> {
  const scope = snapshotOwner(owner);
  await gate.assertReady(scope);
  const stored = await devices.unlock(scope);
  if (!stored) return null;
  // Pin the owner's cached root/key/generation across the remote read and
  // session gate so concurrent caller mutation cannot switch credentials.
  const remembered = snapshotSession(scope, stored);
  let handedOff = false;
  try {
    const remote = snapshotRemote(await transport.read(scope));
    // A different server generation cannot be adopted just because the
    // key ID matches. A recovery-wrapper replacement can legitimately keep
    // that ID, but also requires authenticated owner-root continuity and a
    // server-serialized rotation proof that this dormant adapter cannot supply.
    // Never silently rewrite the remembered epoch on an unverified read.
    if (remote.envelope.kid !== remembered.keyId ||
        remote.generation !== remembered.generation) unavailable();
    await gate.assertReady(scope);
    handedOff = true;
    return { root: remembered.root, keyId: remembered.keyId,
      generation: remembered.generation };
  } finally {
    if (!handedOff) remembered.root.fill(0);
  }
}

/**
 * Only a change of recovery secret, NOT a compromised-root rotation.
 * The caller must save and confirm the new secret before requesting CAS.
 * On uncertain transport failure, the caller retains both saved secrets and
 * must re-read the remote state, rather than assuming either key works.
 */
export class RecoveryKeyReplacement {
  readonly #owner: Owner;
  readonly #root: Bytes;
  readonly #old: RootGeneration;
  readonly #envelope: RootEnvelope;
  readonly #keyText: string;
  #confirmed = false;

  private constructor(
    owner: Owner, root: Bytes, old: RootGeneration, envelope: RootEnvelope, text: string,
  ) {
    this.#owner = Object.freeze({ projectId: owner.projectId, ownerId: owner.ownerId });
    this.#root = root.slice();
    this.#old = { generation: old.generation, envelope: structuredClone(old.envelope) };
    this.#envelope = structuredClone(envelope);
    this.#keyText = text;
  }

  static async prepare(
    owner: Owner, session: CryptoSession,
    gate: FullyAuthenticatedSessionGate, transport: AtomicRootTransport,
  ): Promise<RecoveryKeyReplacement> {
    const scope = snapshotOwner(owner);
    const pinned = snapshotSession(scope, session);
    try {
      await gate.assertReady(scope);
      const current = snapshotRemote(await transport.read(scope));
      if (current.envelope.kid !== pinned.keyId ||
          current.generation !== pinned.generation) unavailable();
      const secret = generateIndependentRecoverySecret();
      try {
        const envelope = await wrapRootForRecovery(
          pinned.root, secret, scope, pinned.keyId);
        const formatted = await formatEmergencyRecoveryKey(secret);
        return new RecoveryKeyReplacement(scope, pinned.root, current, envelope, formatted);
      } finally {
        secret.fill(0);
      }
    } finally {
      // The replacement constructor makes its own root copy before returning.
      pinned.root.fill(0);
    }
  }

  get displayRecoveryKey(): string { return this.#keyText; }

  async confirmSavedRecoveryKey(retypedKey: string): Promise<void> {
    const secret = await parseEmergencyRecoveryKey(retypedKey);
    try {
      const unwrapped = await unwrapRootFromRecovery(secret, this.#owner, this.#envelope);
      try {
        if (!sameKey(unwrapped, this.#root)) unavailable();
        this.#confirmed = true;
      } finally {
        unwrapped.fill(0);
      }
    } finally { secret.fill(0); }
  }

  async commit(gate: FullyAuthenticatedSessionGate, remote: AtomicRootTransport):
    Promise<CryptoSession> {
    if (!this.#confirmed) unavailable();
    await gate.assertReady(this.#owner);
    const status = await remote.replace(
      this.#owner, structuredClone(this.#old), structuredClone(this.#envelope));
    if (status !== 'updated') {
      if (status === 'conflict') throw new AccountRootConflictError();
      unavailable();
    }
    const readback = snapshotRemote(await remote.read(this.#owner));
    await gate.assertReady(this.#owner);
    if (readback.generation !== this.#old.generation + 1 ||
        !sameEnvelope(readback.envelope, this.#envelope)) unavailable();
    return { root: this.#root.slice(), keyId: this.#envelope.kid, generation: readback.generation };
  }
}
