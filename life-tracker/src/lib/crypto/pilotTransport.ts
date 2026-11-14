/**
 * Transport adapter for the synthetic-only private-Diary pilot.
 * Never routes a protected record through legacy RxDB/Diary sync.
 */
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../appwriteConfig';
import { sendAppAction } from '../appAction';
import type { Owner, RecordEnvelope, RootEnvelope } from './pilotCrypto';
import type { PendingCiphertext } from './pilotDeviceStore';

const SCRATCH_PROJECT = '6ae94a2100014d01f5ed';
const SCRATCH_ENDPOINT = 'https://129-221-244-67.sslip.io/v1';

export type PilotRemoteRow = {
  rowId: string;
  revision: string;
  keyId: string;
  envelope: string;
  deleted: boolean;
  updatedAt: string;
};
export function assertPilotScratch(owner: Owner): void {
  if (APPWRITE_PROJECT_ID !== SCRATCH_PROJECT || APPWRITE_ENDPOINT !== SCRATCH_ENDPOINT ||
      owner.projectId !== SCRATCH_PROJECT) {
    throw new Error('Encrypted Diary pilot requires isolated Oracle Scratch.');
  }
}
async function action(owner: Owner, operation: string, extra: Record<string, unknown> = {}):
  Promise<Record<string, unknown>> {
  assertPilotScratch(owner);
  // Guard the caller's account separately in the UI; Function binds actual
  // caller from Appwrite's trusted header and rejects provided owner spoofing.
  const result = await sendAppAction({
    action: 'e2ee_diary_pilot', operation, ownerId: owner.ownerId, ...extra,
  });
  return result;
}
export async function createPilotRoot(owner: Owner, envelope: RootEnvelope): Promise<void> {
  const result = await action(owner, 'create_root', { envelope });
  if (!result.ok || !['created', 'duplicate'].includes(String(result.status))) {
    throw new Error('Could not commit encrypted recovery envelope.');
  }
}
export async function fetchPilotRoot(owner: Owner): Promise<RootEnvelope> {
  const result = await action(owner, 'read_root');
  if (!result.ok || !result.envelope || typeof result.envelope !== 'object') {
    throw new Error('Encrypted recovery envelope unavailable.');
  }
  return result.envelope as RootEnvelope;
}
export async function listPilotRows(owner: Owner, after?: string): Promise<{
  rows: PilotRemoteRow[]; after: string | null;
}> {
  const result = await action(owner, 'list', after ? { after } : {});
  if (!result.ok || !Array.isArray(result.rows)) {
    throw new Error('Encrypted Diary listing unavailable.');
  }
  return { rows: result.rows as PilotRemoteRow[], after:
    typeof result.after === 'string' ? result.after : null };
}
export async function putPilotRow(owner: Owner, write: PendingCiphertext): Promise<void> {
  const result = await action(owner, 'put', {
    rowId: write.rowId, opId: write.opId,
    expectedRevision: write.expectedRevision,
    deleted: write.deleted, envelope: write.envelope as RecordEnvelope,
  });
  if (!result.ok || !['created', 'updated', 'duplicate'].includes(String(result.status))) {
    throw new Error('Encrypted Diary write could not be committed.');
  }
}
