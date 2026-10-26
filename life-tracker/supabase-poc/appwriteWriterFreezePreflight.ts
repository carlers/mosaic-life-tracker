/**
 * #1027 no-network operator inspection of the complete Appwrite old-client
 * WRITE surface before a provider migration. Does NOT revoke permissions,
 * mint server leases or authorize any production schema/role change.
 *
 * Only an independently authenticated admin snapshot of ALL owner rows,
 * affected table/bucket grants and Function deployments, followed by
 * direct signed old-client 403 denials, is a plausible freeze prerequisite.
 * Even a passing normalized object cannot prove the server actually
 * provided the evidence or that a privileged key cannot bypass it.
 */
import { createHash } from 'node:crypto';
import {
  APPWRITE_DATABASE_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
  APPWRITE_STORAGE_BUCKET_ID, APPWRITE_TABLES,
} from '../src/lib/appwriteConfig';

const OWNER_TABLES = [
  APPWRITE_TABLES.tasks, APPWRITE_TABLES.categories, APPWRITE_TABLES.diary,
  APPWRITE_TABLES.settings, APPWRITE_TABLES.bucketList,
  APPWRITE_TABLES.bucketTaskLinks,
] as const;
const MAX_ROWS = 250_000;
const UUID = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,254}$/;
const PERMISSION = /^(create|read|update|delete|write)\("[^"\n]+"\)$/;
const MUTATION = /^(create|update|delete|write)\("/;
const PRIVILEGED_WRITE = /\.write$|^execution\.write$|^sessions\.write$/;
type TableName = (typeof OWNER_TABLES)[number];
type OwnerRowGrant = { id: string; ownerId: string; permissions: string[] };
type OwnerFileGrant = OwnerRowGrant;
type TableGrant = {
  id: TableName;
  enabled: true;
  rowSecurity: true;
  permissions: string[];
  ownerRows: OwnerRowGrant[];
};
type BucketGrant = {
  id: string;
  fileSecurity: true;
  enabled: true;
  permissions: string[];
  ownerFiles: OwnerFileGrant[];
};
type FunctionGrant = {
  id: string; enabled: boolean; scopes: string[];
};
type DeniedOperation = 'create' | 'update' | 'delete';
export type SignedOldClientDenial = {
  domain: TableName | typeof APPWRITE_STORAGE_BUCKET_ID;
  operation: DeniedOperation;
  /** Authenticated real signed owner session, NOT a missing/expired JWT. */
  ownerId: string;
  accountAuthenticated: true;
  /** 403 forbidden from the backend for an otherwise valid operation. */
  httpStatus: 403;
  sourceDeploymentId: string;
  generation: string;
};
export type AppwriteWriterFreezeReadback = {
  ownerLegacyId: string;
  sourceDeploymentId: string;
  generation: string;
  expiresAt: string;
  tableGrants: TableGrant[];
  photoBucket: BucketGrant;
  /** Independently server-counted full owner row/file inventories. */
  expectedOwnerCounts: Record<TableName | typeof APPWRITE_STORAGE_BUCKET_ID, number>;
  functionGrants: FunctionGrant[];
  expectedFunctionCount: number;
  /** Independent signed-owner, frozen-generation write denial readbacks. */
  signedOldClientDenials: SignedOldClientDenial[];
};
function fail(message: string): never {
  throw new Error('Appwrite source write-freeze preflight: ' + message);
}
function checkGrants(values: unknown, label: string) {
  if (!Array.isArray(values) || values.some(x =>
    typeof x !== 'string' || !PERMISSION.test(x)))
    fail('invalid or unreviewed ' + label + ' grants');
  if (values.some(x=>MUTATION.test(x))) fail('client write permission remains in ' + label);
}
function checkOwnerGrants(
  rows: OwnerRowGrant[], owner: string, label: string, expected: number,
) {
  if (!Array.isArray(rows) || !Number.isSafeInteger(expected) ||
      expected < 0 || expected > MAX_ROWS || rows.length !== expected)
    fail('incomplete independently counted ' + label + ' owner inventory');
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !UUID.test(row.id) ||
        row.ownerId !== owner || ids.has(row.id))
      fail('foreign, duplicate or malformed ' + label + ' owner record');
    ids.add(row.id);
    checkGrants(row.permissions,label + ' row');
  }
}
const sha = (x: unknown) =>
  createHash('sha256').update(JSON.stringify(x), 'utf8').digest('hex');
const compare = (a: string,b: string)=>a < b?-1:a > b?1:0;
/**
 * Do NOT interpret a returned audit as an authoritative server lock.
 * The migration operator must separately validate the admin source
 * snapshot's signature and the real old-PWA 403 denial receipts, check
 * backend credential/Function revocation and actually issue an exclusive
 * trusted source-write lease before source capture or destination writes.
 */
export function auditAppwriteSourceWriteFreeze(input: AppwriteWriterFreezeReadback) {
  if (!input || typeof input.ownerLegacyId !== 'string' ||
      !UUID.test(input.ownerLegacyId) ||
      typeof input.sourceDeploymentId !== 'string' ||
      !input.sourceDeploymentId ||
      typeof input.generation !== 'string' || !input.generation ||
      typeof input.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(input.expiresAt)) ||
      Date.parse(input.expiresAt) <= Date.now() ||
      !Array.isArray(input.tableGrants) ||
      !input.photoBucket || !input.expectedOwnerCounts ||
      !Array.isArray(input.functionGrants) ||
      !Array.isArray(input.signedOldClientDenials))
    fail('missing owner, signed source generation or complete inventories');
  const deployment = [APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
    APPWRITE_DATABASE_ID].join('|');
  if (!input.sourceDeploymentId.startsWith(deployment + '|'))
    fail('source Appwrite endpoint/project/database differs from reviewed installation');
  const tables = new Map<string, TableGrant>();
  for (const table of input.tableGrants) {
    if (!table || !OWNER_TABLES.includes(table.id) ||
        tables.has(table.id) || table.enabled !== true ||
        table.rowSecurity !== true)
      fail('unexpected, duplicated or disabled owner table');
    tables.set(table.id, table);
    checkGrants(table.permissions,'table ' + table.id);
    checkOwnerGrants(table.ownerRows,input.ownerLegacyId,table.id,
      input.expectedOwnerCounts[table.id]);
  }
  if (tables.size !== OWNER_TABLES.length)
    fail('missing private personal table grants');
  const bucket = input.photoBucket;
  if (bucket.id !== APPWRITE_STORAGE_BUCKET_ID ||
      bucket.fileSecurity !== true || bucket.enabled !== true)
    fail('missing private personal photo bucket policy');
  checkGrants(bucket.permissions, 'photo bucket');
  checkOwnerGrants(bucket.ownerFiles,input.ownerLegacyId,'photo file',
    input.expectedOwnerCounts[APPWRITE_STORAGE_BUCKET_ID]);
  if (!Number.isSafeInteger(input.expectedFunctionCount) ||
      input.expectedFunctionCount < 0 ||
      input.functionGrants.length !== input.expectedFunctionCount)
    fail('incomplete privileged Function inventory');
  const functionIds = new Set<string>();
  for (const fn of input.functionGrants) {
    if (!fn || typeof fn.id !== 'string' || !fn.id ||
        functionIds.has(fn.id) || typeof fn.enabled !== 'boolean' ||
        !Array.isArray(fn.scopes) ||
        fn.scopes.some(v=>typeof v !== 'string'))
      fail('invalid or duplicate Function inventory');
    functionIds.add(fn.id);
    if (fn.enabled && fn.scopes.some(scope => PRIVILEGED_WRITE.test(scope)))
      fail('enabled privileged Function can bypass frozen owner rows');
  }
  const expectedProbeKeys = new Set<string>();
  for (const domain of [...OWNER_TABLES,APPWRITE_STORAGE_BUCKET_ID]) {
    for (const operation of ['create','update','delete'] as const)
      expectedProbeKeys.add(domain + ':' + operation);
  }
  const matched = new Set<string>();
  for (const proof of input.signedOldClientDenials) {
    const key = proof?.domain + ':' + proof?.operation;
    if (!expectedProbeKeys.has(key) || matched.has(key) ||
        proof.ownerId !== input.ownerLegacyId ||
        proof.accountAuthenticated !== true || proof.httpStatus !== 403 ||
        proof.sourceDeploymentId !== input.sourceDeploymentId ||
        proof.generation !== input.generation)
      fail('missing authentic owner write denial or wrong generation');
    matched.add(key);
  }
  if (matched.size !== expectedProbeKeys.size)
    fail('incomplete signed old-client direct write denial matrix');
  const grants = [...tables.values()].sort((a,b)=>compare(a.id,b.id)).map(table=>({
    id:table.id,permissions:[...table.permissions].sort(),
    rows:[...table.ownerRows].sort((a,b)=>compare(a.id,b.id)).map(row=>({
      id:row.id, ownerId:row.ownerId,permissions:[...row.permissions].sort(),
    })),
  }));
  return {
    ownerId:input.ownerLegacyId,
    sourceDeploymentId:input.sourceDeploymentId,
    generation:input.generation,
    checkedPersonalTables:OWNER_TABLES.length,
    checkedOwnerRows:grants.reduce((sum,t)=>sum+t.rows.length,0),
    checkedOwnerFiles:bucket.ownerFiles.length,
    checkedOldClientDenials:matched.size,
    inspectedMetadataSha256:sha({
      generation:input.generation,ownerId:input.ownerLegacyId,
      tables:grants,
      bucket:{
        id:bucket.id,permissions:[...bucket.permissions].sort(),
        files:[...bucket.ownerFiles].sort((a,b)=>compare(a.id,b.id)).map(row=>({
          id:row.id,ownerId:row.ownerId,permissions:[...row.permissions].sort(),
        })),
      },
      functions:[...input.functionGrants].sort((a,b)=>compare(a.id,b.id)),
      denials:[...matched].sort(),
    }),
    /** Normalized/read-only evidence, NOT a trusted server lease signature. */
    serverFreezeAuthorityAuthenticated: false as const,
    privilegedWriterCredentialsRevoked: false as const,
    providerCutoverEligible: false as const,
  };
}
