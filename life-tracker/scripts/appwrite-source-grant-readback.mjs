/**
 * #1027 dormant READ-ONLY Appwrite admin ACL inventory collector.
 *
 * To use in an approved trusted operator context, supply a separately scoped
 * admin GET requester (scripts/lib/appwrite-backend.mjs) and independently
 * authenticated owner/account, file IDs, source deployment and counts. This
 * does not request sessions, revoke grants, sign leases, use Production, or
 * write an archive. The caller must securely encrypt/save original ACLs and
 * prove old-PWA 403 denials before attempting an actual freeze.
 */
import { createHash } from 'node:crypto';
import { MOSAIC_BUCKET, MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const OWNER_TABLE_IDS = Object.freeze([
  'tasks','categories','diary','settings','bucket_list_items','bucket_task_links',
]);
const ALL_IDS = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/;
const OWNER_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,254}$/;
const MAX_ROWS = 250_000;
const MAX_FILES = 100_000;
const MAX_FUNCTIONS = 2_000;
const PAGE_SIZE = 100;
const HEX = /^[a-f0-9]{64}$/;
const q = (method, attribute, values) => JSON.stringify({
  method, ...(attribute ? { attribute } : {}),
  ...(values !== undefined ? { values } : {}),
});
const hash = x => createHash('sha256').update(JSON.stringify(x),'utf8').digest('hex');
const sortById = (a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
function refuse(message) { throw new Error('Appwrite read-only source grant inventory: ' + message); }
function exactKeys(object, keys) {
  return object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).sort().join('|') === [...keys].sort().join('|');
}
function safeGrant(permissions) {
  return Array.isArray(permissions) && permissions.length <= 100 &&
    permissions.every(p=>typeof p === 'string' && p.length <= 256 &&
      /^(create|read|update|delete|write)\("[^"\n]+"\)$/.test(p));
}
function recordId(item) {
  const value=item?.$id;
  if (typeof value !== 'string' || !ALL_IDS.test(value))
    refuse('invalid backend object identity');
  return value;
}
function readPermissions(item) {
  const values=item?.$permissions ?? item?.permissions;
  if (!safeGrant(values)) refuse('invalid backend permissions');
  return [...values].sort();
}
function paramsFor(queries, isRows) {
  const params=new URLSearchParams();
  for (const query of queries) params.append('queries[]',query);
  params.set('total','true');
  // ttl is accepted for TablesDB rows, NOT other Appwrite list endpoints.
  if(isRows) params.set('ttl','0');
  return params.toString();
}
/**
 * Fetch an EXACT bounded owner/metadata inventory in two passes; only GET
 * requests are ever issued. The callback may use the existing protected
 * Appwrite admin requester, or an injected in-memory test backend.
 *
 * A supplied source-write lease/count witness is NOT self-authorizing.
 * Storage File metadata has no guaranteed canonical owner identity: a
 * separate owner file ID witness can cross-check exact objects but cannot
 * establish no *other* owner-owned files were omitted. Thus completion and
 * cutover are always false even on two stable scans.
 */
export async function inspectAppwriteAdminSourceGrants({
  request, ownerId, endpoint, projectId, databaseId=MOSAIC_DATABASE.id,
  bucketId=MOSAIC_BUCKET.id, deploymentId,
  ownerCounts, expectedOwnerFileIds, expectedFunctionCount,
  pageSize=PAGE_SIZE,
}={}) {
  if (typeof request !== 'function' || typeof ownerId !== 'string' ||
      !OWNER_ID.test(ownerId) || typeof deploymentId !== 'string' ||
      !deploymentId || typeof endpoint !== 'string' ||
      !endpoint.startsWith('https://') || !endpoint.endsWith('/v1') ||
      typeof projectId !== 'string' || !ALL_IDS.test(projectId) ||
      databaseId !== MOSAIC_DATABASE.id || bucketId !== MOSAIC_BUCKET.id ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE ||
      !ownerCounts || typeof ownerCounts !== 'object' ||
      !Number.isSafeInteger(expectedFunctionCount) ||
      expectedFunctionCount < 0 || expectedFunctionCount > MAX_FUNCTIONS ||
      !Array.isArray(expectedOwnerFileIds))
    refuse('missing source target, independent owner counts or read-only admin requester');
  const fileIds=new Set();
  for(const id of expectedOwnerFileIds){
    if(typeof id!=='string'|| !ALL_IDS.test(id) || fileIds.has(id))
      refuse('duplicate or invalid externally witnessed owner Storage file ID');
    fileIds.add(id);
  }
  if(fileIds.size>MAX_FILES || ownerCounts[bucketId]!==fileIds.size ||
     OWNER_TABLE_IDS.some(id=>!Number.isSafeInteger(ownerCounts[id]) ||
        ownerCounts[id]<0 || ownerCounts[id]>MAX_ROWS))
    refuse('incomplete or unbounded independently counted owner inventory');
  const base='/tablesdb/'+encodeURIComponent(databaseId)+'/tables';
  const fileBase='/storage/buckets/'+encodeURIComponent(bucketId);
  async function get(path) {
    if (!path.startsWith('/') || path.includes('#') ||
        !['/tablesdb/','/storage/','/functions'].some(prefix=>path.startsWith(prefix)))
      refuse('unreviewed admin request path');
    try {
      const result=await request('GET',path);
      if(!result || typeof result!=='object') refuse('backend response missing');
      return result;
    } catch {
      refuse('signed read-only admin metadata request denied or failed');
    }
  }
  async function getPages(path,itemKey,baseQueries,maximum,projectRow){
    let total, cursor='',count=0, pages=0;
    const records=[];
    for(;;) {
      const query=[...baseQueries,q('orderAsc','$id'),q('limit',undefined,[pageSize])];
      if(cursor)query.push(q('cursorAfter',undefined,[cursor]));
      const page=await get(path+'?'+paramsFor(query,itemKey==='rows'));
      if(!Array.isArray(page[itemKey]) || page[itemKey].length>pageSize ||
          !Number.isSafeInteger(page.total) || page.total<0 ||
          page.total>maximum || (total!==undefined && page.total!==total))
        refuse('invalid, changing or excessive backend list count for '+itemKey);
      total=page.total;
      if(pages++>Math.ceil(total/pageSize)+1)
        refuse('bounded owner inventory pagination exceeded');
      for (const item of page[itemKey]) {
        const id=recordId(item);
        if(id<=cursor) refuse('duplicate or unsorted backend owner cursor');
        cursor=id;
        records.push(projectRow(item));
        if(++count>total) refuse('backend owner inventory exceeded server count');
      }
      if(count===total) break;
      if(page[itemKey].length!==pageSize)
        refuse('incomplete Appwrite admin inventory before total');
    }
    return records;
  }
  async function pass() {
    const tableGrants=[];
    for(const id of OWNER_TABLE_IDS) {
      if(!MOSAIC_TABLES.some(x=>x.id===id))
        refuse('source table not in reviewed Mosaic backend manifest');
      const table=await get(base+'/'+encodeURIComponent(id));
      if(recordId(table)!==id || typeof table.rowSecurity!=='boolean' ||
          typeof table.enabled!=='boolean')
        refuse('missing or incompatible owner table metadata');
      const permissions=readPermissions(table);
      const rows=await getPages(base+'/'+encodeURIComponent(id)+'/rows','rows',
        [q('equal','user_id',[ownerId])],MAX_ROWS,item=>{
          if(item.user_id!==ownerId) refuse('foreign owner in filtered backend Rows');
          return {id:recordId(item),ownerId,permissions:readPermissions(item)};
        });
      if(rows.length!==ownerCounts[id])
        refuse('independent complete owner row count differs from backend');
      tableGrants.push({id,enabled:table.enabled,rowSecurity:table.rowSecurity,
        permissions,ownerRows:rows});
    }
    const bucket=await get(fileBase);
    if(recordId(bucket)!==bucketId || typeof bucket.enabled!=='boolean' ||
        typeof bucket.fileSecurity!=='boolean')
      refuse('missing private Storage bucket configuration');
    const bucketPermissions=readPermissions(bucket);
    // Full bucket pagination, including OTHER owners; never mistake an
    // owner-filtered partial list for a complete file inventory.
    const allFiles=await getPages(fileBase+'/files','files',[],MAX_FILES,item=>({
      id:recordId(item),permissions:readPermissions(item),
    }));
    const fileMap=new Map(allFiles.map(item=>[item.id,item]));
    const ownerFiles=[...fileIds].sort().map(id=>{
      const found=fileMap.get(id);
      if(!found) refuse('externally evidenced owner file missing from complete bucket');
      return {id,ownerId,permissions:found.permissions};
    });
    const functions=await getPages('/functions','functions',[],MAX_FUNCTIONS,item=>{
      if(typeof item.enabled!=='boolean' || !Array.isArray(item.scopes) ||
          item.scopes.some(x=>typeof x!=='string' || x.length>128))
        refuse('Function execution scope inventory missing or malformed');
      return {id:recordId(item),enabled:item.enabled,scopes:[...item.scopes].sort()};
    });
    if(functions.length!==expectedFunctionCount)
      refuse('independent privileged Function count differs from backend');
    return {
      tableGrants,
      photoBucket:{id:bucketId,enabled:bucket.enabled,fileSecurity:bucket.fileSecurity,
        permissions:bucketPermissions,ownerFiles},
      expectedOwnerCounts:{...ownerCounts},
      functionGrants:functions,
      expectedFunctionCount,
      completeBucketObjectCount:allFiles.length,
      unattributedBucketFileCount:allFiles.length-ownerFiles.length,
    };
  }
  const first=await pass();
  const second=await pass();
  if(hash(first)!==hash(second))
    refuse('Appwrite source ACL or owner inventory changed between full passes');
  const scanSha256=hash(first);
  if(!HEX.test(scanSha256)) refuse('invalid admin snapshot fingerprint');
  return {
    ownerLegacyId:ownerId,
    sourceDeploymentId:[endpoint,projectId,databaseId,deploymentId].join('|'),
    ...first,
    /** A real signed 403 matrix must be obtained from old session probes. */
    signedOldClientDenials:[],
    adminGrantSnapshotSha256:scanSha256,
    ownerFileMembershipIndependentlyAuthenticated:false,
    authenticatedSourceLeaseIssued:false,
    privilegedWriterKeysRevoked:false,
    providerCutoverEligible:false,
  };
}
