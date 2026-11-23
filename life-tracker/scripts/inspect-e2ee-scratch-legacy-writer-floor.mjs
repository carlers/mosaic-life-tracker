/**
 * M2 opt-in isolated Scratch legacy plaintext write-floor inventory.
 *
 * READ ONLY. Not a permission migration or release approval.
 * Before *any* future cutover, prove every old browser-creatable private
 * TablesDB collection and plaintext image bucket has a known exact schema
 * and is EMPTY. An old PWA could create new rows immediately afterwards:
 * this inventory is not an atomic write fence or a backend cutover.
 */
import { MOSAIC_TABLES, MOSAIC_BUCKET } from '../infrastructure/mosaic-backend.mjs';

const SCRATCH = '6b00671500279e901846';
const DATABASE = 'life_tracker';
export const LEGACY_PRIVATE_TABLES = Object.freeze([
  'tasks','categories','diary','settings','bucket_list_items','bucket_task_links',
]);
export const LEGACY_MEDIA_BUCKET = 'task_images';

function blocked(code) { throw new Error('E2EE legacy writer preflight blocked: ' + code); }
function sameStrings(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const a = [...actual].sort(), b = [...expected].sort();
  return a.every((value,index) => value === b[index]);
}
function fieldsEqual(actual,expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const keys=new Set();
  for(const item of actual) {
    if(!item || typeof item.key!=='string' || keys.has(item.key))return false;
    keys.add(item.key);
  }
  return expected.every(wanted=>{
    const found=actual.find(entry=>entry.key===wanted.key);
    return found?.type===wanted.type &&
      found?.required===wanted.required &&
      (wanted.size===undefined || found.size===wanted.size) &&
      (wanted.array===undefined || found.array===wanted.array) &&
      (wanted.default===undefined ||
       (found.default ?? null)===(wanted.default ?? null)) &&
      (found.status===undefined || found.status==='available');
  });
}
function indexesEqual(actual,expected) {
  if (!Array.isArray(actual) || actual.length!==expected.length) return false;
  const keys=new Set();
  for(const idx of actual) {
    if(!idx || typeof idx.key!=='string' || keys.has(idx.key)) return false;
    keys.add(idx.key);
  }
  return expected.every(wanted=>{
    const found=actual.find(item=>item.key===wanted.key);
    return found?.type===wanted.type &&
      sameStrings(found.attributes ?? found.columns,wanted.attributes) &&
      (found.status===undefined || found.status==='available');
  });
}
function assertEmptyRows(response,table) {
  if (!response || typeof response.total!=='number' ||
      !Number.isSafeInteger(response.total) || response.total!==0 ||
      !Array.isArray(response.rows) || response.rows.length!==0) blocked('nonempty-or-unproven-'+table);
}
/**
 * This inventory never submits PUT/POST/DELETE, even with a caller-supplied
 * mutation-capable request. It fails closed on unknown project, incomplete
 * metadata and pre-existing plaintext rows, files or changed ACLs.
 */
export async function inspectScratchLegacyWriterFloor({projectId,request}) {
  if(projectId!==SCRATCH)blocked('project');
  if(typeof request!=='function')blocked('request');
  const result=[];
  for(const tableId of LEGACY_PRIVATE_TABLES) {
    const expected=MOSAIC_TABLES.find(table=>table.id===tableId);
    if(!expected || expected.permissions.length!==1 ||
       !sameStrings(expected.permissions,['create("users")']))blocked('manifest-'+tableId);
    const path='/tablesdb/'+DATABASE+'/tables/'+tableId;
    const current=await request('GET',path);
    if(current?.$id!==tableId || current.name!==expected.name ||
       current.rowSecurity!==true || current.enabled!==true ||
       !fieldsEqual(current.columns,expected.columns) ||
       !indexesEqual(current.indexes,expected.indexes))blocked('schema-'+tableId);
    const permissions=current.$permissions ?? current.permissions;
    const open=sameStrings(permissions,['create("users")']);
    const sealed=sameStrings(permissions,[]);
    if(!open&&!sealed)blocked('permissions-'+tableId);
    // Require a *separate* row-inventory GET, not optimistic metadata.
    const rows=await request('GET',path+'/rows');
    assertEmptyRows(rows,tableId);
    result.push({tableId,state:sealed?'table-create-closed':'browser-create-open'});
  }
  const current=await request('GET','/storage/buckets/'+LEGACY_MEDIA_BUCKET);
  if(current?.$id!==MOSAIC_BUCKET.id || current.name!==MOSAIC_BUCKET.name)
    blocked('media-identity');
  for(const field of [
    'fileSecurity','enabled','maximumFileSize','compression','encryption',
    'antivirus','transformations',
  ]) if(current[field]!==MOSAIC_BUCKET[field])blocked('media-shape-'+field);
  if(!sameStrings(current.allowedFileExtensions,MOSAIC_BUCKET.allowedFileExtensions))
    blocked('media-extensions');
  const permissions=current.$permissions ?? current.permissions;
  const open=sameStrings(permissions,['create("users")']);
  const sealed=sameStrings(permissions,[]);
  if(!open&&!sealed)blocked('media-permissions');
  const files=await request('GET','/storage/buckets/'+LEGACY_MEDIA_BUCKET+'/files');
  if(!files || !Number.isSafeInteger(files.total) || files.total!==0 ||
     !Array.isArray(files.files) || files.files.length!==0)blocked('nonempty-or-unproven-media');
  return {
    projectId:SCRATCH,
    tables:result,
    media:{bucketId:LEGACY_MEDIA_BUCKET,state:sealed?'bucket-create-closed':'browser-create-open'},
    complete:true,
    mutationCount:0,
    // The caller MUST NOT use this result to change Function flags:
    // a concurrent old PWA can still create after this probe.
    accountScopedAcl:'not-verified',
    existingClientRowPermissions:'not-verified',
    atomicWriterFence:'not-verified',
    cutover:'not-authorized',
  };
}
