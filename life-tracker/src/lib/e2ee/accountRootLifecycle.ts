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
    this.#owner = { projectId: owner.projectId, ownerId: owner.ownerId };
    this.#root = root;
    this.#envelope = envelope;
    this.#keyText = text;
  }

  static async prepare(owner: Owner): Promise<InitialRootEnrollment> {
    const root = generateAccountRoot();
    const recovery = generateIndependentRecoverySecret();
    const kid = generateKeyId();
    const envelope = await wrapRootForRecovery(root, recovery, owner, kid);
    const text = await formatEmergencyRecoveryKey(recovery);
    recovery.fill(0);
    return new InitialRootEnrollment(owner, root, envelope, text);
  }

  get displayRecoveryKey(): string { return this.#keyText; }
  get confirmed(): boolean { return this.#confirmed; }

  async confirmSavedRecoveryKey(retypedKey: string): Promise<void> {
    const secret = await parseEmergencyRecoveryKey(retypedKey);
    try {
      const unwrapped = await unwrapRootFromRecovery(secret, this.#owner, this.#envelope);
      if (!sameKey(unwrapped, this.#root)) unavailable();
      this.#confirmed = true;
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
    const outcome = await transport.create(this.#owner, this.#envelope);
    if (outcome === 'conflict') throw new AccountRootConflictError();
    if (outcome !== 'created' && outcome !== 'duplicate') unavailable();
    // Confirm the authoritative row. A success response without readback does
    // not unlock protected sync, even if the remote create actually succeeded.
    const row = await transport.read(this.#owner);
    validateRemote(row);
    if (row.generation !== 1 || !sameEnvelope(row.envelope, this.#envelope)) {
      throw new AccountRootConflictError();
    }
    // If remembering was requested, a failed local store transaction leaves
    // the account locked; the saved emergency key can still recover the root.
    if (devices) await devices.remember(this.#owner, this.#root, row.envelope.kid, row.generation);
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
  await gate.assertReady(owner);
  const row = await transport.read(owner);
  validateRemote(row);
  const secret = await parseEmergencyRecoveryKey(retypedRecoveryKey);
  let root: Bytes;
  try { root = await unwrapRootFromRecovery(secret, owner, row.envelope); }
  finally { secret.fill(0); }
  if (devices) await devices.remember(owner, root, row.envelope.kid, row.generation);
  return { root, keyId: row.envelope.kid, generation: row.generation };
}

/** A remembered key cannot silently adopt an unrecognized root or rollback. */
export async function unlockRememberedAccountRoot(
  owner: Owner,
  gate: FullyAuthenticatedSessionGate,
  transport: AtomicRootTransport,
  devices: RememberedRootStore,
): Promise<CryptoSession | null> {
  await gate.assertReady(owner);
  const remembered = await devices.unlock(owner);
  if (!remembered) return null;
  ensureKey(owner, remembered);
  const remote = await transport.read(owner);
  validateRemote(remote);
  if (remote.envelope.kid !== remembered.keyId ||
      remote.generation < remembered.generation) unavailable();
  if (remote.generation > remembered.generation) {
    await devices.remember(owner, remembered.root, remembered.keyId, remote.generation);
  }
  return { root: remembered.root, keyId: remembered.keyId, generation: remote.generation };
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
    this.#owner = { projectId: owner.projectId, ownerId: owner.ownerId };
    this.#root = root;
    this.#old = old;
    this.#envelope = envelope;
    this.#keyText = text;
  }

  static async prepare(
    owner: Owner, session: CryptoSession,
    gate: FullyAuthenticatedSessionGate, transport: AtomicRootTransport,
  ): Promise<RecoveryKeyReplacement> {
    ensureKey(owner, session);
    await gate.assertReady(owner);
    const current = await transport.read(owner);
    validateRemote(current);
    if (current.envelope.kid !== session.keyId ||
        current.generation !== session.generation) unavailable();
    const secret = generateIndependentRecoverySecret();
    const envelope = await wrapRootForRecovery(session.root, secret, owner, session.keyId);
    const formatted = await formatEmergencyRecoveryKey(secret);
    secret.fill(0);
    return new RecoveryKeyReplacement(owner, session.root, current, envelope, formatted);
  }

  get displayRecoveryKey(): string { return this.#keyText; }

  async confirmSavedRecoveryKey(retypedKey: string): Promise<void> {
    const secret = await parseEmergencyRecoveryKey(retypedKey);
    try {
      if (!sameKey(await unwrapRootFromRecovery(secret, this.#owner, this.#envelope),
          this.#root)) unavailable();
      this.#confirmed = true;
    } finally { secret.fill(0); }
  }

  async commit(gate: FullyAuthenticatedSessionGate, remote: AtomicRootTransport):
    Promise<CryptoSession> {
    if (!this.#confirmed) unavailable();
    await gate.assertReady(this.#owner);
    const status = await remote.replace(this.#owner, this.#old, this.#envelope);
    if (status !== 'updated') {
      if (status === 'conflict') throw new AccountRootConflictError();
      unavailable();
    }
    const readback = await remote.read(this.#owner);
    validateRemote(readback);
    if (readback.generation !== this.#old.generation + 1 ||
        !sameEnvelope(readback.envelope, this.#envelope)) unavailable();
    return { root: this.#root.slice(), keyId: this.#envelope.kid, generation: readback.generation };
  }
}
