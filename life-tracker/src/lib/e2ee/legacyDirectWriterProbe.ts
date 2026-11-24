/**
 * Deliberate synthetic-only authenticated legacy SDK writer replay (#2084).
 * This is not a live old-installed-PWA / existing-row / offline-queue proof.
 * Runs only on explicitly clicked isolated M2 lab after a verified root.
 *
 * IMPORTANT: A 400, 409, network error or successful creation is NEVER PASS.
 * On unexpected success STOP immediately; retain the canary for independent
 * administrator inventory/cleanup instead of hiding an ACL bypass.
 */
import { scratchLegacyAclProbe } from '../sdk';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../appwriteConfig';
import type { Owner } from './coreCrypto';
import type { FullyAuthenticatedSessionGate } from './accountRootLifecycle';

const SCRATCH = '6b00671500279e901846';
const ENDPOINT = 'https://129-221-244-67.sslip.io/v1';
const DATABASE = 'life_tracker';
const STAMP = '2000-01-01T00:00:00.000Z';
const DATE = '2000-01-01';
const TARGETS = [
  'tasks','categories','diary','settings','bucket_list_items','bucket_task_links',
] as const;
type Target = (typeof TARGETS)[number] | 'task_images';
export type LegacyReplayResult = Readonly<{
  outcome: 'denied' | 'unsafe' | 'inconclusive';
  checked: number;
  total: 7;
  target: Target | null;
  status: number | null;
}>;
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3X8AAAAASUVORK5CYII=';

function fixture(target: Target, ownerId: string): Record<string, unknown> {
  const privateText = 'M2 disposable legacy-write denial canary';
  switch (target) {
    case 'tasks':
      return {user_id:ownerId,title:privateText,category_id:'m2_synthetic',
        date:DATE,created_at:STAMP,updated_at:STAMP,visibility:'private'};
    case 'categories':
      return {user_id:ownerId,name:privateText,color:'#777777',
        order:0,visibility:'private'};
    case 'diary':
      return {user_id:ownerId,date:DATE,content:privateText,
        updated_at:STAMP,visibility:'private'};
    case 'settings':
      return {user_id:ownerId,key:'m2_synthetic_legacy_denial',
        value:privateText};
    case 'bucket_list_items':
      return {user_id:ownerId,title:privateText,created_at:STAMP,updated_at:STAMP};
    case 'bucket_task_links':
      return {user_id:ownerId,bucket_list_id:'m2_synthetic',task_id:'m2_synthetic',
        created_at:STAMP,updated_at:STAMP};
    case 'task_images': return {};
  }
}
function status(error: unknown): number | null {
  const code=error && typeof error==='object' && 'code' in error
    ? (error as {code?:unknown}).code : null;
  return typeof code === 'number' && Number.isSafeInteger(code) &&
    code>=400 && code<=599 ? code : null;
}
function nextId(): string {
  const bytes=crypto.getRandomValues(new Uint8Array(12));
  return 'm2canary_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function invalid(owner: Owner): boolean {
  return APPWRITE_PROJECT_ID!==SCRATCH || APPWRITE_ENDPOINT!==ENDPOINT ||
    owner.projectId!==SCRATCH ||
    typeof owner.ownerId!=='string' || owner.ownerId.length<1 ||
    owner.ownerId.length>255;
}
export async function probeLegacyDirectWriters(
  owner: Owner,gate: FullyAuthenticatedSessionGate,
): Promise<LegacyReplayResult> {
  if (invalid(owner)) return {outcome:'inconclusive',checked:0,total:7,target:null,status:null};
  let checked=0;
  for(const target of TARGETS) {
    await gate.assertReady(owner);
    try {
      await scratchLegacyAclProbe.createRow({
        databaseId:DATABASE, tableId:target,rowId:nextId(),
        data:fixture(target,owner.ownerId),permissions:[],
      });
      return {outcome:'unsafe',checked,total:7,target,status:null};
    } catch(error) {
      const code=status(error);
      if(code!==401 && code!==403) {
        return {outcome:'inconclusive',checked,total:7,target,status:code};
      }
      checked++;
    }
  }
  await gate.assertReady(owner);
  const binary=Uint8Array.from(atob(PNG),c=>c.charCodeAt(0));
  try {
    await scratchLegacyAclProbe.createFile({
      bucketId:'task_images',fileId:nextId(),
      file:new File([binary],'m2-synthetic-denial.png',{type:'image/png'}),
      permissions:[],
    });
    return {outcome:'unsafe',checked,total:7,target:'task_images',status:null};
  } catch(error) {
    const code=status(error);
    if(code!==401 && code!==403)
      return {outcome:'inconclusive',checked,total:7,target:'task_images',status:code};
  }
  return {outcome:'denied',checked:7,total:7,target:null,status:null};
}
