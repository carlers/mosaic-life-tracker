/**
 * #1027 no-network historical task/Diary photo byte-parity gate.
 * Consumes PREVIOUSLY VERIFIED complete one-owner source readbacks and
 * independently authenticated Storage archive manifests. Neither a caller
 * supplied SHA nor this pure comparison proves that an archive is genuine.
 * Never reads cloud objects, repairs references, drops tombstones or writes.
 */
import { createHash } from 'node:crypto';
import type { AppwriteHistoryReadback } from './appwriteOwnerHistoryRead';
import type { FrozenPersonalSnapshot } from './appwritePersonalSourceRead';
import { joinFrozenAppwriteOwnerSources } from './appwriteFrozenPersonalJoin';

const HEX = /^[a-f0-9]{64}$/;
const LEGACY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const SUPABASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const MAX_MEDIA = 5 * 1024 * 1024;
const MAX_OBJECTS = 100_000;
const MAX_PHOTO_REFS = 250_000;

export type OriginalMediaObject = {
  ownerLegacyId: string;
  fileId: string;
  bytes: number;
  sha256: string;
};
export type RestoredMediaObject = {
  /** Exact owner Supabase UUID/fileId.webp, not a public Storage URL. */
  path: string;
  bytes: number;
  sha256: string;
};
type Input = {
  personal: FrozenPersonalSnapshot;
  history: AppwriteHistoryReadback;
  /** Separately pinned seven-domain content+historical source scan digest. */
  expectedSevenDomainScanSha256: string;
  /** Independently authenticated complete original Appwrite Storage index. */
  originalStorage: readonly OriginalMediaObject[];
  originalStorageCount: number;
  originalStorageManifestSha256: string;
  /** Independently authenticated restored Supabase Storage object index. */
  restoredStorage: readonly RestoredMediaObject[];
  restoredStorageCount: number;
  restoredStorageManifestSha256: string;
};
const digest = (data: unknown): string =>
  createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
const byId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function rowsToReferences(rows: FrozenPersonalSnapshot['rows']): string[] {
  const refs: string[] = [];
  function add(id: unknown) {
    if (typeof id !== 'string') throw new Error('Non-string historical photo reference');
    if (!id) return;
    if (++count > MAX_PHOTO_REFS) throw new Error('Historical photo reference bound exceeded');
    refs.push(id);
  }
  let count = 0;
  for (const row of rows.tasks) {
    if (!Object.hasOwn(row.columns, 'image')) continue;
    const image = row.columns.image;
    if (image !== null) add(image);
  }
  for (const row of rows.diary) {
    if (!Object.hasOwn(row.columns, 'photos')) continue;
    const raw = row.columns.photos;
    if (raw === null || raw === '') continue;
    if (typeof raw !== 'string' || raw.length > 8192)
      throw new Error('Malformed historical Diary photo references');
    let photoIds: unknown;
    try { photoIds = JSON.parse(raw); }
    catch { throw new Error('Malformed historical Diary photo JSON; original must be retained'); }
    if (!Array.isArray(photoIds) || photoIds.length > 5 ||
        photoIds.some(x => typeof x !== 'string' || x.length < 1) ||
        new Set(photoIds).size !== photoIds.length)
      throw new Error('Malformed or unrepresentable historical Diary photo array');
    photoIds.forEach(add);
  }
  return refs;
}
function hashInventory<T>(objects: readonly T[], getKey: (obj:T)=>string): string {
  const ordered = [...objects].sort((a,b)=>byId(getKey(a),getKey(b)));
  return digest(ordered);
}
function metadata(bytes: number, sha256: string) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_MEDIA || !HEX.test(sha256))
    throw new Error('Storage byte length or SHA256 missing from authenticated inventory');
}
function verifiedCount(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || expected < 0 ||
      expected > MAX_OBJECTS || actual !== expected)
    throw new Error('Incomplete owner Storage inventory count witness');
}
/**
 * A verified byte-identical target MAY still have unresolved *historical*
 * references (pending/long/absent). Those remain in the encrypted owner
 * source archive; this gate does not silently delete or normalize them.
 */
export function verifyHistoricalOwnerPhotoCoverage(input: Input) {
  if (!input || !HEX.test(input.expectedSevenDomainScanSha256) ||
      !HEX.test(input.originalStorageManifestSha256) ||
      !HEX.test(input.restoredStorageManifestSha256) ||
      !Array.isArray(input.originalStorage) ||
      !Array.isArray(input.restoredStorage))
    throw new Error('Media parity requires independent owner-source and Storage archive evidence');
  const joined = joinFrozenAppwriteOwnerSources({
    personal: input.personal, history: input.history,
  });
  if (joined.sevenDomainScanSha256 !== input.expectedSevenDomainScanSha256)
    throw new Error('Frozen owner photo references differ from pinned seven-domain source');
  verifiedCount(input.originalStorage.length, input.originalStorageCount);
  verifiedCount(input.restoredStorage.length, input.restoredStorageCount);
  const sourceOwner = joined.owner.legacyUserId;
  const targetOwner = joined.owner.supabaseUserId;
  const source = new Map<string, OriginalMediaObject>();
  for (const item of input.originalStorage) {
    if (!item || item.ownerLegacyId !== sourceOwner || typeof item.fileId !== 'string' ||
        !LEGACY_ID.test(item.fileId) || source.has(item.fileId))
      throw new Error('Foreign, duplicate or malformed historical owner Storage object');
    metadata(item.bytes,item.sha256);
    source.set(item.fileId,item);
  }
  if (hashInventory(input.originalStorage, x=>x.fileId) !==
      input.originalStorageManifestSha256)
    throw new Error('Historical Storage inventory does not match separately pinned source manifest');
  const target = new Map<string, RestoredMediaObject>();
  for (const item of input.restoredStorage) {
    if (!item || typeof item.path !== 'string' || typeof item.sha256 !== 'string' ||
        !item.path.startsWith(targetOwner + '/') || !item.path.endsWith('.webp'))
      throw new Error('Foreign owner or malformed restored private Storage path');
    const fileId = item.path.slice(targetOwner.length + 1, -5);
    if (!SUPABASE_ID.test(fileId) || target.has(fileId))
      throw new Error('Duplicate, invalid or rewritten restored private Storage ID');
    metadata(item.bytes,item.sha256);
    target.set(fileId,item);
  }
  if (hashInventory(input.restoredStorage,x=>x.path) !==
      input.restoredStorageManifestSha256)
    throw new Error('Restored private Storage differs from separately pinned target manifest');

  let supportedSourceCount = 0;
  let unrepresentableSourceObjects = 0;
  for (const [fileId, original] of source) {
    if (!SUPABASE_ID.test(fileId)) {
      unrepresentableSourceObjects++;
      continue; // Keep exact original bytes in encrypted quarantine, never rename.
    }
    supportedSourceCount++;
    const restored = target.get(fileId);
    if (!restored || restored.bytes !== original.bytes ||
        restored.sha256 !== original.sha256)
      throw new Error('Missing or changed owner photo bytes in restored Storage');
  }
  if (target.size !== supportedSourceCount)
    throw new Error('Extra, foreign or unreviewed restored Storage objects');
  for (const id of target.keys()) {
    if (!source.has(id)) throw new Error('Unexpected restored photo file ID');
  }
  const referenced = rowsToReferences(input.personal.rows);
  const unique = new Set(referenced);
  let missingReferencedBytes = 0;
  let unrepresentableReferences = 0;
  for (const id of unique) {
    if (!SUPABASE_ID.test(id)) unrepresentableReferences++;
    if (!source.has(id)) missingReferencedBytes++;
  }
  const orphanSourceObjects = [...source.keys()].filter(id => !unique.has(id)).length;
  return {
    owner: { ...joined.owner },
    sevenDomainScanSha256: joined.sevenDomainScanSha256,
    originalStorageManifestSha256: input.originalStorageManifestSha256,
    restoredStorageManifestSha256: input.restoredStorageManifestSha256,
    referenceOccurrences: referenced.length,
    uniqueReferencedObjects: unique.size,
    preservedSourceObjects: source.size,
    byteMatchedRestoredObjects: target.size,
    sourceObjectsWithoutReferences: orphanSourceObjects,
    unresolvedMissingReferences: missingReferencedBytes,
    unresolvedUnrepresentableReferences: unrepresentableReferences,
    unrepresentableSourceObjects,
    /** No task/Diary ref silently disappears; real archived originals required. */
    ownerMediaReferencesFullyRecovered: missingReferencedBytes === 0 &&
      unrepresentableReferences === 0 && unrepresentableSourceObjects === 0,
    fullEncryptedSourceAuthenticated: false as const,
    providerCutoverEligible: false as const,
  };
}
