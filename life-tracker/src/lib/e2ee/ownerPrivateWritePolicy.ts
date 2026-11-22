/**
 * M2 source-only owner-private write preflight (#2084).
 *
 * One shared gate for the shadow migration and the low-level ciphertext writer.
 * It rejects shared/public visibility and references to legacy unencrypted
 * media before any ciphertext intent can enter the outbox or reach a Function.
 * This is NOT a completed migration, old-client fence, or proof of local data
 * freshness; those require separate backend and replication gates.
 */
import type { Owner } from './coreCrypto';
import type { OwnerOnlyCollection } from './ownerCiphertextTransport';
import { ownerPrivacyFields } from './fieldManifest';

const privateVisibility = new Set<OwnerOnlyCollection>(['tasks','categories','diary']);
const encoder = new TextEncoder();

function blocked(reason: string): never {
  throw new Error('E2EE owner-private staging blocked: ' + reason);
}
function routingScalar(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isSafeInteger(value));
}

/**
 * Input must be a known, owner-scoped document with no plaintext media
 * dependencies. Do not silently treat inherited/absent visibility as private.
 * The server repeats these restrictions independently at its authenticated
 * boundary; the client must also reject before enqueuing a doomed operation.
 */
export function assertStagedPrivateOwnerDocument(
  collection: OwnerOnlyCollection, doc: Record<string, unknown>, owner: Owner,
): void {
  if (!owner?.projectId || !owner?.ownerId ||
      !doc || typeof doc !== 'object' || Array.isArray(doc) ||
      doc.userId !== owner.ownerId || typeof doc.id !== 'string' ||
      doc.id.length < 1 || doc.id.length > 255 ||
      typeof doc.isDeleted !== 'boolean') blocked('missing owner or document identity');
  const classes = ownerPrivacyFields[collection] as Record<string, string> | undefined;
  if (!classes) blocked('unrecognized owner-private collection');
  for (const key of Object.keys(doc)) {
    if (!Object.hasOwn(classes, key)) blocked('unclassified field');
  }
  if (privateVisibility.has(collection) && doc.visibility !== 'private') {
    blocked('explicit private visibility required');
  }
  if (collection === 'tasks' && doc.image !== undefined && doc.image !== '') {
    blocked('task photo requires encrypted media migration');
  }
  if (collection === 'diary' && doc.photos !== undefined &&
      doc.photos !== '' &&
      !(typeof doc.photos === 'string' && doc.photos.trim() === '[]')) {
    blocked('diary photos require encrypted media migration');
  }
  if (collection === 'settings') {
    if (typeof doc.key !== 'string') blocked('unclassified settings key');
    if (/(file|image|photo|avatar|wallpaper|media|attachment)/i.test(doc.key)) {
      blocked('media settings require attachment audit');
    }
  }

  // Mirror the server's upper bounds on routing metadata without copying
  // private values into any log, network payload or error message.
  const routing: Record<string, string | number | boolean | null> = {};
  for (const [key, classification] of Object.entries(classes)) {
    if (classification !== 'routing' || doc[key] === undefined) continue;
    const value = doc[key];
    if (!routingScalar(value) ||
        (typeof value === 'string' && encoder.encode(value).length > 512)) {
      blocked('invalid owner routing metadata');
    }
    routing[key] = value;
  }
  if (Object.keys(routing).length > 32 ||
      encoder.encode(JSON.stringify(routing)).length > 4096) {
    blocked('oversize owner routing metadata');
  }
  try {
    const serialized = JSON.stringify(doc);
    if (typeof serialized !== 'string' ||
        encoder.encode(serialized).length > 131072) blocked('oversize private document');
  } catch {
    blocked('invalid private document serialization');
  }
}
