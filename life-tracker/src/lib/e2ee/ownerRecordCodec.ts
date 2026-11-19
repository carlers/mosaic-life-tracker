/**
 * M2 source-only encrypted domain transport. Nothing here is called by the
 * currently enabled plaintext RxDB/Appwrite sync. Versioned Scratch migration
 * and ciphertext-only server writer floor are required before activation.
 */
import {
  type Bytes, type PrivateRecordContext, type RecordEnvelope,
  encryptPrivateRecord, decryptPrivateRecord,
} from './coreCrypto';
import { ownerPrivacyFields, type PrivacyClass } from './fieldManifest';
import type { PrivatePayloadDomain } from './domainRegistry';

export type OwnerCollection = keyof typeof ownerPrivacyFields;
type RoutedValue = string | number | boolean | null;
export type EncryptedOwnerRecord = Readonly<{
  projectId: string;
  ownerId: string;
  rowId: string;
  collection: OwnerCollection;
  domain: PrivatePayloadDomain;
  routing: Record<string, RoutedValue>;
  published: Record<string, RoutedValue>;
  envelope: RecordEnvelope;
}>;

const DOMAIN_FOR_COLLECTION: Record<OwnerCollection, PrivatePayloadDomain> = {
  tasks: 'task',
  categories: 'category',
  diary: 'diary',
  bucketList: 'bucket-list',
  bucketTaskLinks: 'bucket-task-link',
  settings: 'settings-private',
  friendships: 'social-private',
  messages: 'chat-message',
};

function invalid(): never { throw new Error('Protected record classification is unavailable.'); }

function classesFor(collection: OwnerCollection): Record<string, PrivacyClass> {
  const classes = ownerPrivacyFields[collection] as Record<string, PrivacyClass>;
  if (!classes) invalid();
  return classes;
}
function checkRoutingFields(
  collection: OwnerCollection, routing: Record<string, unknown>,
  published: Record<string, unknown>, allowPublic: boolean,
): void {
  const classes = classesFor(collection);
  for (const [key, kind] of [...Object.entries(routing).map(([k, v]) => [k, v, 'routing']), 
    ...Object.entries(published).map(([k, v]) => [k, v, 'public'])] as Array<[string, unknown, PrivacyClass]>) {
    if (classes[key] !== kind) invalid();
  }
  if (!allowPublic && Object.keys(published).length) invalid();
}
function safeScalar(value: unknown): value is RoutedValue {
  return value === null || typeof value === 'string' || typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isSafeInteger(value));
}
function copySafe(input: Record<string, unknown>, policy: PrivacyClass,
  classes: Record<string, PrivacyClass>): Record<string, RoutedValue> {
  const output: Record<string, RoutedValue> = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(classes, key)) invalid();
    if (classes[key] !== policy || value === undefined) continue;
    if (!safeScalar(value)) invalid();
    output[key] = value;
  }
  return output;
}

/**
 * Fail closed on unclassified properties. Encryption excludes intentionally
 * published fields unless the caller explicitly opts into disclosure.
 */
export async function encryptOwnerDocument(
  root: Bytes,
  collection: OwnerCollection,
  c: PrivateRecordContext,
  doc: Record<string, unknown>,
  allowPublic = false,
): Promise<EncryptedOwnerRecord> {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) ||
      c.payloadDomain !== DOMAIN_FOR_COLLECTION[collection]) invalid();
  const classes = classesFor(collection);
  for (const key of Object.keys(doc)) if (!Object.hasOwn(classes, key)) invalid();
  if (doc.userId !== c.ownerId) invalid();
  const routing = copySafe(doc, 'routing', classes);
  const published = copySafe(doc, 'public', classes);
  checkRoutingFields(collection, routing, published, allowPublic);
  // Published payloads are excluded from private-data assurances and must be
  // explicitly permissioned and disclosed by their feature's server route.
  const privateData: Record<string, unknown> = Object.create(null);
  for (const [key, kind] of Object.entries(classes)) {
    if (kind === 'encrypted' && doc[key] !== undefined) privateData[key] = doc[key];
  }
  const envelope = await encryptPrivateRecord(root, { ...c, publicRouting: { ...routing, ...published } }, privateData);
  return {
    projectId: c.projectId, ownerId: c.ownerId, rowId: c.rowId,
    collection, domain: c.payloadDomain, routing, published, envelope,
  };
}

/** Metadata is authenticated and unknown/moved fields are rejected on read. */
export async function decryptOwnerDocument(
  root: Bytes,
  collection: OwnerCollection,
  c: PrivateRecordContext,
  remote: EncryptedOwnerRecord,
  allowPublic = false,
): Promise<Record<string, unknown>> {
  if (!remote || c.payloadDomain !== DOMAIN_FOR_COLLECTION[collection] ||
      remote.collection !== collection || remote.domain !== c.payloadDomain ||
      remote.projectId !== c.projectId || remote.ownerId !== c.ownerId ||
      remote.rowId !== c.rowId) invalid();
  checkRoutingFields(collection, remote.routing, remote.published, allowPublic);
  const ciphertext = await decryptPrivateRecord(root,
    { ...c, publicRouting: { ...remote.routing, ...remote.published } }, remote.envelope);
  const classes = classesFor(collection);
  for (const key of Object.keys(ciphertext)) {
    if (classes[key] !== 'encrypted') invalid();
  }
  return { ...remote.routing, ...remote.published, ...ciphertext };
}
