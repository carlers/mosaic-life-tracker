/**
 * Dormant source-only encrypted local rescue bundle for the CURRENT app origin.
 * Not a complete old installed-PWA backup, not a restore/import, no server IO.
 */
import {
  type Bytes, type Owner, type RecordEnvelope,
  generateOpaqueRowId, generateRevision,
  encryptPrivateRecord, decryptPrivateRecord,
} from './coreCrypto';
import {
  sealCurrentOwnerOfflineRows, decryptOwnerOfflineRow,
  type OwnerLocalReader,type OwnerLocalGate,type SealedLocalRow,
} from './ownerOfflineRowSnapshot';
import {
  sealOwnerPendingImages, decryptOwnerPendingImage,
  type PendingImageSource,type EncryptedPendingImage,
  indexedDbPendingImageSource,
} from './ownerPendingImageRescue';
import type {EncryptedMediaManifest} from './privateMediaCodec';
import { sealOwnerPendingQueueSnapshot } from './localPendingQueueSnapshot';
import { decryptPendingLegacyIntents } from './legacyPendingRecovery';

const FORMAT='mosaic-e2ee-local-rescue-bundle';
const PURPOSE='rescue-manifest-v2';
const MAX_FILE_BYTES=116*1024*1024;
const KID=/^k_[a-f0-9]{32}$/;
const ROW=/^p_[a-f0-9]{32}$/;
const REV=/^r_[a-f0-9]{32}$/;
const ENC=new TextEncoder();
export const OWNER_LOCAL_RESCUE_FILENAME='mosaic-local-rescue-v2.enc';

type ManifestRecord=Readonly<{
  rowId:string;keyId:string;revision:string;envelope:RecordEnvelope;
}>;
type PhotoWire=Readonly<{
  rowId:string;keyId:string;revision:string;sealedMetadata:RecordEnvelope;
  manifest:EncryptedMediaManifest;ciphertextBase64:string;
}>;
type RescueWire=Readonly<{
  format:typeof FORMAT;version:2;manifest:ManifestRecord;
  rows:readonly SealedLocalRow[];media:readonly PhotoWire[];
  queueCapsule:string;
}>;
export interface OwnerLocalRescueResult {
  readonly file:Blob;
  readonly filename:typeof OWNER_LOCAL_RESCUE_FILENAME;
  readonly rows:number;
  readonly media:number;
  readonly pending:number;
}
export interface OwnerLocalRescueSources {
  rows:OwnerLocalReader;
  images:PendingImageSource;
  queues:Pick<Storage,'length'|'key'|'getItem'>;
}
function blocked():never {throw new Error('Owner encrypted local rescue file invalid or incomplete.');}
function b64(input:Uint8Array):string {
  let out='';
  for(let i=0;i<input.byteLength;i+=8192){
    out+=String.fromCharCode(...input.subarray(i,i+8192));
  }
  return btoa(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unb64(input:unknown):Uint8Array<ArrayBuffer> {
  if(typeof input!=='string'||!input||input.length>MAX_FILE_BYTES*2||
      !/^[A-Za-z0-9_-]+$/.test(input)||input.length%4===1)blocked();
  let bytes:Uint8Array<ArrayBuffer>;
  try {
    const decoded=atob(input.replace(/-/g,'+').replace(/_/g,'/')+
      '='.repeat((4-input.length%4)%4));
    bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
  }catch{return blocked();}
  if(b64(bytes)!==input)blocked();
  return bytes;
}
async function digest(rows:readonly SealedLocalRow[],media:readonly PhotoWire[],queueCapsule:string):Promise<string>{
  const bytes=ENC.encode(JSON.stringify({rows,media,queueCapsule}));
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
}
function strictObject(input:unknown,keys:readonly string[]):boolean{
  return !!input&&typeof input==='object'&&!Array.isArray(input)&&
    Object.keys(input).sort().join('|')===[...keys].sort().join('|');
}
function readEnvelope(input:unknown):RescueWire {
  if(!strictObject(input,['format','version','manifest','rows','media','queueCapsule']))blocked();
  const wire=input as RescueWire;
  if(wire.format!==FORMAT||wire.version!==2||
      !strictObject(wire.manifest,['rowId','keyId','revision','envelope'])||
      !ROW.test(wire.manifest.rowId)||!KID.test(wire.manifest.keyId)||
      !REV.test(wire.manifest.revision)||
      !Array.isArray(wire.rows)||!Array.isArray(wire.media)||
      typeof wire.queueCapsule!=='string'||wire.queueCapsule.length>2_200_000||
      wire.rows.length>3000||wire.media.length>500)blocked();
  const rowIds=new Set<string>(),imageIds=new Set<string>();
  for(const item of wire.rows){
    if(!strictObject(item,['collection','rowId','keyId','revision','envelope'])||
        typeof item.rowId!=='string'||!ROW.test(item.rowId)||
        rowIds.has(item.rowId))blocked();
    rowIds.add(item.rowId);
  }
  for(const item of wire.media){
    if(!strictObject(item,['rowId','keyId','revision','sealedMetadata','manifest','ciphertextBase64'])||
       !ROW.test(item.rowId)||!KID.test(item.keyId)||!REV.test(item.revision)||
       imageIds.has(item.rowId)||typeof item.ciphertextBase64!=='string')blocked();
    imageIds.add(item.rowId);
  }
  return wire;
}
function mediaFromWire(item:PhotoWire):EncryptedPendingImage {
  return {
    rowId:item.rowId,keyId:item.keyId,revision:item.revision,
    sealedMetadata:item.sealedMetadata,
    sealedMedia:{
      manifest:item.manifest,
      ciphertext:new Blob([unb64(item.ciphertextBase64)],{type:'application/octet-stream'}),
    },
  };
}
/**
 * Encrypted in-memory Blob only. Caller must separately save and reselect an
 * actual file before interpreting readback as a durable device backup.
 */
export async function buildOwnerLocalRescueFile(
  owner:Owner,root:Bytes,keyId:string,gate:OwnerLocalGate,
  sources:OwnerLocalRescueSources,
):Promise<OwnerLocalRescueResult> {
  if(!owner?.projectId||!owner?.ownerId||
     !(root instanceof Uint8Array)||root.byteLength!==32||!KID.test(keyId))blocked();
  await gate.assertReady(owner);
  const rows=await sealCurrentOwnerOfflineRows(owner,root,keyId,gate,sources.rows);
  const sealedMedia=await sealOwnerPendingImages(owner,root,keyId,gate,sources.images);
  const queueCapsule=await sealOwnerPendingQueueSnapshot(owner,root,sources.queues);
  const pending=(await decryptPendingLegacyIntents(owner,root,queueCapsule)).length;
  const media:PhotoWire[]=[];
  for(const item of sealedMedia){
    const bytes=new Uint8Array(await item.sealedMedia.ciphertext.arrayBuffer());
    media.push({
      rowId:item.rowId,keyId:item.keyId,revision:item.revision,
      sealedMetadata:item.sealedMetadata,
      manifest:item.sealedMedia.manifest,
      ciphertextBase64:b64(bytes),
    });
  }
  await gate.assertReady(owner);
  const rowId=generateOpaqueRowId(),revision=generateRevision();
  const envelope=await encryptPrivateRecord(root,{
    ...owner,payloadDomain:'offline-snapshot',
    rowId,keyId,revision,publicRouting:{purpose:PURPOSE},
  },{
    format:FORMAT,version:2,
    sha256:await digest(rows,media,queueCapsule),
    rows:rows.length,media:media.length,pending,
  });
  const wire:RescueWire={
    format:FORMAT,version:2,
    manifest:{rowId,keyId,revision,envelope},rows,media,queueCapsule,
  };
  const file=new Blob([JSON.stringify(wire)],{type:'application/octet-stream'});
  if(file.size>MAX_FILE_BYTES)blocked();
  const verified=await verifyOwnerLocalRescueFile(owner,root,file);
  if(verified.rows!==rows.length||verified.media!==media.length||verified.pending!==pending)blocked();
  await gate.assertReady(owner);
  return {file,filename:OWNER_LOCAL_RESCUE_FILENAME,
    rows:rows.length,media:media.length,pending};
}

/** Local read-only AEAD verification, not a restore operation. */
export async function verifyOwnerLocalRescueFile(
  owner:Owner,root:Bytes,file:Pick<Blob,'size'|'text'>,
):Promise<Readonly<{rows:number;media:number;pending:number}>> {
  if(!file||!Number.isSafeInteger(file.size)||file.size<1||
     file.size>MAX_FILE_BYTES||typeof file.text!=='function'||!owner?.ownerId||!owner.projectId||
     !(root instanceof Uint8Array)||root.byteLength!==32)blocked();
  try{
    const wire=readEnvelope(JSON.parse(await file.text()));
    const details=await decryptPrivateRecord(root,{
      ...owner,payloadDomain:'offline-snapshot',
      rowId:wire.manifest.rowId,keyId:wire.manifest.keyId,
      revision:wire.manifest.revision,publicRouting:{purpose:PURPOSE},
    },wire.manifest.envelope);
    const pendingIntents=await decryptPendingLegacyIntents(owner,root,wire.queueCapsule);
    if(details.format!==FORMAT||details.version!==2||
       details.rows!==wire.rows.length||details.media!==wire.media.length||
       details.pending!==pendingIntents.length||
       details.sha256!==await digest(wire.rows,wire.media,wire.queueCapsule))blocked();
    const rowSemanticIds=new Set<string>();
    for(const item of wire.rows){
      const document=await decryptOwnerOfflineRow(owner,root,item);
      const unique=item.collection+'/'+String(document.id);
      if(rowSemanticIds.has(unique))blocked();
      rowSemanticIds.add(unique);
    }
    const imageIds=new Set<string>();
    for(const item of wire.media){
      const opened=await decryptOwnerPendingImage(owner,root,mediaFromWire(item));
      if(imageIds.has(opened.localId))blocked();
      imageIds.add(opened.localId);
    }
    return {rows:wire.rows.length,media:wire.media.length,pending:pendingIntents.length};
  }catch{return blocked();}
}
