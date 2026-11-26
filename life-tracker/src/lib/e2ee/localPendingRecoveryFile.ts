/**
 * Offline-only file carrier for the authenticated legacy-pending capsule.
 * No browser download, upload, queue import/replay or remote action is performed.
 * The caller must make an explicit user-gesture download and verify the actual
 * saved file separately; in-memory Blob readback is not proof of filesystem save.
 */
import type { Bytes, Owner } from './coreCrypto';
import {
  decryptPendingLegacyIntents, type PendingLegacyIntent,
} from './legacyPendingRecovery';
import {
  sealOwnerPendingQueueSnapshot, snapshotOwnerPendingQueues,
} from './localPendingQueueSnapshot';

type ReadOnlyQueueStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;
const MAX_CAPSULE_FILE_BYTES = 2_200_000;
export const LEGACY_RECOVERY_FILENAME = 'mosaic-pending-recovery-v1.enc';

function denied(): never {
  throw new Error('Encrypted pending-recovery file could not be verified.');
}

/** Requires the unlocked 256-bit owner root; no implicit fallback or upload. */
export async function readLocalPendingRecoveryFile(
  owner: Owner, root: Bytes, file: Pick<Blob, 'size' | 'text'>,
): Promise<readonly PendingLegacyIntent[]> {
  if (!file || !Number.isSafeInteger(file.size) ||
      file.size < 1 || file.size > MAX_CAPSULE_FILE_BYTES ||
      typeof file.text !== 'function') denied();
  let contents: string;
  try { contents = await file.text(); } catch { return denied(); }
  try {
    return await decryptPendingLegacyIntents(owner, root, contents);
  } catch {
    return denied();
  }
}

/**
 * Build ciphertext-only downloadable bytes from the known localStorage queues.
 * This cannot recover historical PWA RxDB/IndexedDB edits or pending media.
 * A second read of the original store detects visible races; file must then
 * be saved/downloaded and independently selected from disk for final proof.
 */
export async function buildLocalPendingRecoveryFile(
  owner: Owner, root: Bytes, storage: ReadOnlyQueueStorage,
): Promise<Readonly<{ filename: string; file: Blob; count: number }>> {
  const ciphertext = await sealOwnerPendingQueueSnapshot(owner, root, storage);
  const file = new Blob([ciphertext], { type: 'application/octet-stream' });
  if (file.size > MAX_CAPSULE_FILE_BYTES) denied();
  const decoded = await readLocalPendingRecoveryFile(owner, root, file);
  // A changed store is not an immutable captured snapshot.
  const fresh = snapshotOwnerPendingQueues(owner, storage);
  if (JSON.stringify(fresh) !== JSON.stringify(decoded)) denied();
  return { filename: LEGACY_RECOVERY_FILENAME, file, count: decoded.length };
}
