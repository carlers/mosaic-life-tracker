/**
 * Dormant isolated-Scratch browser-side page opener for the prospective v2
 * owner ciphertext scan. In-memory decryption only; NO live SDK, HTTP, RxDB
 * replication, ACK, IndexedDB changes, migration or cutover.
 *
 * The server's scan is not a consistent snapshot. This cannot establish
 * complete sync, historical-client safety, root authorization or migration
 * readiness, even when all returned rows independently decrypt.
 */
import {type Bytes,type Owner,deriveMigratedOwnerRowId} from './coreCrypto';
import {
  SCRATCH_OWNER_V2_PROJECT,V2_OWNER_DOMAIN,
  openV2PrivateOwnerDocument,type OwnerV2Collection,
  type V2OwnerRecord,
} from './ownerPrivateV2Contract';
import type {OwnerV2RehearsalGate} from './ownerV2TransportRehearsal';

const ROW=/^p_[a-f0-9]{32}$/,KEY=/^k_[a-f0-9]{32}$/,
  OP=/^o_[a-f0-9]{32}$/,OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const MAX_ROWS=25;
const RECORD_FIELDS=[
  'policy','schemaVersion','projectId','ownerId','rowId',
  'collection','domain','routing','published','envelope',
];
function blocked():never{
  throw new Error('Encrypted owner scan is incomplete; no sync or migration acknowledged.');
}
function exact(value:unknown,fields:readonly string[]):
  value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype&&
    Object.keys(value).length===fields.length&&
    fields.every(field=>Object.hasOwn(value,field));
}
function time(value:unknown):value is string{
  if(typeof value!=='string'||
     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false;
  try{return new Date(value).toISOString()===value;}
  catch{return false;}
}
export type OwnerV2ScanRequest=Readonly<{
  operation:'scan';collection:OwnerV2Collection;expectedKeyId:string;
  expectedGeneration:number;limit:number;cursor:string|null;
}>;
export type OwnerV2ScanPort=Readonly<{
  scan:(request:OwnerV2ScanRequest)=>Promise<unknown>;
}>;
export type OwnerV2DecryptedScanPage=Readonly<{
  status:'local-decryption-only-not-sync';
  records:readonly Readonly<{
    rowId:string;document:Record<string,unknown>;
    opId:string;serverUpdatedAt:string;
  }>[];
  nextCursor:string|null;complete:false;
}>;
/**
 * Revalidate every returned owner scope, operation, epoch, row order,
 * timestamp and AES-GCM additional-data binding against the locally held
 * account root. An opaque server row ID must match the original source ID's
 * deterministic domain-specific derived ID for this migration-only format.
 *
 * This is deliberately a page rehearsal, NOT a normal RxDB pull handler.
 */
export async function decryptProspectiveOwnerV2ScanPage(
  root:Bytes,owner:Owner,collection:OwnerV2Collection,
  keyId:string,generation:number,limit:number,cursor:string|null,
  port:OwnerV2ScanPort,gate:OwnerV2RehearsalGate,
):Promise<OwnerV2DecryptedScanPage>{
  if(!(root instanceof Uint8Array)||root.length!==32||
     !owner||owner.projectId!==SCRATCH_OWNER_V2_PROJECT||
     typeof owner.ownerId!=='string'||!OWNER.test(owner.ownerId)||
     !Object.hasOwn(V2_OWNER_DOMAIN,collection)||
     typeof keyId!=='string'||!KEY.test(keyId)||
     !Number.isSafeInteger(generation)||generation<1||
     generation>2147483647||!Number.isSafeInteger(limit)||
     limit<1||limit>MAX_ROWS||
     !(cursor===null||typeof cursor==='string'&&ROW.test(cursor))||
     typeof port?.scan!=='function'||typeof gate?.assertReady!=='function')
    blocked();
  const scoped:Owner=Object.freeze({
    projectId:owner.projectId,ownerId:owner.ownerId,
  });
  const key=root.slice();
  try{
    const request:OwnerV2ScanRequest=Object.freeze({
      operation:'scan',collection,expectedKeyId:keyId,
      expectedGeneration:generation,limit,cursor,
    });
    await gate.assertReady(scoped);
    let raw:unknown;
    try{raw=structuredClone(await port.scan(structuredClone(request)));}
    catch{return blocked();}
    if(!exact(raw,['status','body'])||raw.status!==200||
       !exact(raw.body,['ok','rows','nextCursor','complete'])||
       raw.body.ok!==true||raw.body.complete!==false||
       !Array.isArray(raw.body.rows)||raw.body.rows.length>limit)
      blocked();
    const entries=raw.body.rows as unknown[];
    const seenOps=new Set<string>();
    const opened:OwnerV2DecryptedScanPage['records'][number][]=[];
    let prior=cursor;
    for(const entry of entries){
      if(!exact(entry,[
        'rowId','record','opId','keyGeneration','serverUpdatedAt',
      ])||typeof entry.rowId!=='string'||!ROW.test(entry.rowId)||
         (prior!==null&&entry.rowId<=prior)||
         typeof entry.opId!=='string'||!OP.test(entry.opId)||
         seenOps.has(entry.opId)||entry.keyGeneration!==generation||
         !time(entry.serverUpdatedAt)||
         !exact(entry.record,RECORD_FIELDS))
        blocked();
      const record=entry.record as unknown as V2OwnerRecord;
      if(record.projectId!==scoped.projectId||
         record.ownerId!==scoped.ownerId||record.rowId!==entry.rowId||
         record.collection!==collection||
         record.domain!==V2_OWNER_DOMAIN[collection]||
         record.envelope?.kid!==keyId)blocked();
      const document=await openV2PrivateOwnerDocument(key,scoped,{
        ...scoped,rowId:entry.rowId,keyId,
        revision:record.envelope.revision,
        payloadDomain:V2_OWNER_DOMAIN[collection],
      },collection,record);
      if(typeof document.id!=='string'||!document.id||
         await deriveMigratedOwnerRowId(
           key,scoped,V2_OWNER_DOMAIN[collection],document.id)!==entry.rowId)
        blocked();
      opened.push(Object.freeze({
        rowId:entry.rowId,document,opId:entry.opId,
        serverUpdatedAt:entry.serverUpdatedAt,
      }));
      seenOps.add(entry.opId);prior=entry.rowId;
    }
    const expectCursor=entries.length===limit?prior:null;
    if(raw.body.nextCursor!==expectCursor)blocked();
    await gate.assertReady(scoped);
    return Object.freeze({
      status:'local-decryption-only-not-sync',
      records:Object.freeze(opened),nextCursor:expectCursor,complete:false,
    });
  }catch{return blocked();}
  finally{key.fill(0);}
}
