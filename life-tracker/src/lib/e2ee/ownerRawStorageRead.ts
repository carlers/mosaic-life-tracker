/**
 * Dormant current-origin raw RxDB storage read for lossless *visible* tombstone
 * inventory. Does not write, clear, restore, replicate, or contact Appwrite.
 * Scans both _deleted states because RxDocument queries exclude internal
 * tombstones. This does NOT recover tombstones already physically cleaned up
 * or prove a multi-tab atomic snapshot.
 */
import {normalizeMangoQuery,prepareQuery} from 'rxdb';

type RawDocument=Readonly<Record<string,unknown>>;
type RawStorage=Readonly<{
  schema:unknown;
  query(prepared:unknown):Promise<{documents:readonly unknown[]}>;
}>;
const PAGE_SIZE=75;
const MAX_SCANNED=3000;
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
function blocked():never{
  throw new Error('Owner raw RxDB storage inventory incomplete; no migration permitted.');
}
function verifiedRow(value:unknown,ownerId:string,deleted:boolean):RawDocument {
  if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype)blocked();
  const row=value as Record<string,unknown>;
  const meta=row._meta;
  if(typeof row.id!=='string'||!ID.test(row.id)||row.userId!==ownerId||
     typeof row.isDeleted!=='boolean'||row._deleted!==deleted||
     typeof row._rev!=='string'||!row._rev||
     !meta||typeof meta!=='object'||Array.isArray(meta)||
     !Number.isFinite((meta as Record<string,unknown>).lwt))blocked();
  return row;
}
/**
 * Read only the exact owner, using the *storage* (not RxCollection.find())
 * with _deleted true AND false. Every page is bounded and validated.
 * Caller must hold a separate authenticated/root-unlocked gate and do
 * a second whole-source readback to detect observed concurrent changes.
 */
export async function readOwnerRawStorageRows(
  storage:RawStorage,ownerId:string,
):Promise<readonly RawDocument[]> {
  if(!storage||typeof storage.query!=='function'||!storage.schema||
     typeof ownerId!=='string'||!OWNER.test(ownerId))blocked();
  const schema=storage.schema as Parameters<typeof normalizeMangoQuery>[0];
  if(!schema||typeof schema!=='object'||(schema as {primaryKey?:unknown}).primaryKey!=='id')blocked();
  const found:RawDocument[]=[];
  const seen=new Set<string>();
  for(const deleted of [false,true]){
    // Keyset pagination avoids silently skipping/duplicating owner rows if a
    // different tab inserts/deletes a lower-key row between two page reads.
    // It is NOT a global transaction; the full source recheck remains required.
    let afterId:string|null=null;
    while(true){
      const selector={userId:ownerId,_deleted:deleted,
        ...(afterId===null?{}:{id:{$gt:afterId}})};
      const input={selector,sort:[{id:'asc'}],limit:PAGE_SIZE};
      const prepared=prepareQuery(schema,
        normalizeMangoQuery(schema,input as Parameters<typeof normalizeMangoQuery>[1]));
      const reply=await storage.query(prepared);
      if(!reply||!Array.isArray(reply.documents)||
         reply.documents.length>PAGE_SIZE)blocked();
      let latest:string|null=afterId;
      for(const candidate of reply.documents){
        const row=verifiedRow(candidate,ownerId,deleted);
        const id=row.id as string;
        if(latest!==null&&id<=latest)blocked(); // ordered, strictly advancing
        if(seen.has(id))blocked(); // cross-page and cross-deleted duplicates
        latest=id;
        seen.add(id);
        found.push(row);
        if(found.length>MAX_SCANNED)blocked();
      }
      if(reply.documents.length<PAGE_SIZE)break;
      if(latest===null||latest===afterId)blocked();
      afterId=latest;
    }
  }
  return found.sort((x,y)=>(x.id as string).localeCompare(y.id as string));
}
