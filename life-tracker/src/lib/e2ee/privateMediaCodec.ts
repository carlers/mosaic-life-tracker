/**
 * M2 staged browser-side AES-256-GCM media codec (#1662/#2084).
 *
 * The ciphertext Blob is suitable ONLY for a future vetted encrypted-media
 * bucket. It is NOT uploaded here. No normal task/diary image references are
 * changed. File size/chunk count remain visible; MIME is AEAD-encrypted.
 *
 * Each random 128-bit media ID derives a distinct AES key from the owner root.
 * The 64-bit random nonce prefix and disjoint per-chunk counters guarantee
 * unique nonces within one file. Fresh media IDs are mandatory on re-encrypt.
 */
import type { Bytes, Owner } from './coreCrypto';

const DOMAIN='mosaic-e2ee/media/v1';
const CHUNK=65536;
const LIMIT=12*1024*1024;
const TAG=16;
const MAX_CHUNKS=Math.ceil(LIMIT/CHUNK);
const enc=new TextEncoder();
const dec=new TextDecoder('utf-8',{fatal:true});
const ID=/^m_[a-f0-9]{32}$/;
const KEY=/^k_[a-f0-9]{32}$/;
const ALLOWED_MIME=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif']);

export type EncryptedMediaManifest=Readonly<{
  v:1;alg:'A256GCM';mediaId:string;keyId:string;
  noncePrefix:string;plainBytes:number;chunkBytes:65536;chunks:number;
  encryptedMime:string;
}>;
export type EncryptedMedia=Readonly<{manifest:EncryptedMediaManifest;ciphertext:Blob}>;

function invalid():never {throw new Error('Encrypted media is unavailable or invalid.');}
function checkContext(root:Bytes,owner:Owner,keyId:string,mediaId:string):void {
  if(!(root instanceof Uint8Array)||root.byteLength!==32 ||
     !owner?.projectId||!owner?.ownerId||owner.projectId.length>100 ||
     owner.ownerId.length>255||!KEY.test(keyId)||!ID.test(mediaId)) invalid();
}
function bytes(n:number):Bytes {
  const x=new Uint8Array(n);crypto.getRandomValues(x);return x;
}
function b64(x:Uint8Array):string {
  let result='';
  for(const byte of x)result+=String.fromCharCode(byte);
  return btoa(result).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function parseB64(value:unknown,n?:number):Bytes {
  if(typeof value!=='string'||value.length<2||value.length>256 ||
    !/^[A-Za-z0-9_-]+$/.test(value)||value.length%4===1)invalid();
  try{
    const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/')+
      '='.repeat((4-value.length%4)%4));
    const result=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)result[i]=binary.charCodeAt(i);
    if((n!==undefined&&result.length!==n)||b64(result)!==value)invalid();
    return result;
  }catch{return invalid();}
}
function fields(...values:(string|number)[]):Bytes {
  const parts=values.map(v=>enc.encode(String(v)));
  const total=parts.reduce((sum,p)=>sum+4+p.byteLength,0);
  if(total>8192)invalid();
  const out=new Uint8Array(total);
  const view=new DataView(out.buffer);
  let offset=0;
  for(const part of parts){
    view.setUint32(offset,part.length,false);offset+=4;
    out.set(part,offset);offset+=part.length;
  }
  return out;
}
function nonce(prefix:Bytes,index:number):Bytes {
  if(prefix.length!==8||!Number.isSafeInteger(index)||index<0||index>0xffffffff)invalid();
  const n=new Uint8Array(12);
  n.set(prefix,0);new DataView(n.buffer).setUint32(8,index,false);
  return n;
}
function context(owner:Owner,manifest:EncryptedMediaManifest,kind:string,index:number):Bytes {
  return fields(DOMAIN,'media-aad',owner.projectId,owner.ownerId,
    manifest.mediaId,manifest.keyId,manifest.v,manifest.alg,
    manifest.plainBytes,manifest.chunkBytes,manifest.chunks,kind,index);
}
async function keyFor(root:Bytes,owner:Owner,keyId:string,mediaId:string):Promise<CryptoKey> {
  checkContext(root,owner,keyId,mediaId);
  const imported=await crypto.subtle.importKey('raw',root,'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({
    name:'HKDF',hash:'SHA-256',salt:enc.encode(DOMAIN+'/salt'),
    info:fields(DOMAIN,'media-key',owner.projectId,owner.ownerId,keyId,mediaId),
  },imported,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function validManifest(manifest:EncryptedMediaManifest,blob:Blob):Bytes {
  if(!manifest || Object.keys(manifest).length!==9 ||
     manifest.v!==1||manifest.alg!=='A256GCM'||
     !ID.test(manifest.mediaId)||!KEY.test(manifest.keyId)||
     manifest.chunkBytes!==CHUNK||
     !Number.isSafeInteger(manifest.plainBytes)||
     manifest.plainBytes<1||manifest.plainBytes>LIMIT||
     !Number.isSafeInteger(manifest.chunks)||
     manifest.chunks<1||manifest.chunks>MAX_CHUNKS||
     manifest.chunks!==Math.ceil(manifest.plainBytes/CHUNK)||
     blob.size!==manifest.plainBytes+TAG*manifest.chunks)invalid();
  return parseB64(manifest.noncePrefix,8);
}

/** Seal compressed image bytes before any cloud upload is allowed. */
export async function sealPrivateMedia(
  root:Bytes,owner:Owner,keyId:string,source:Blob,
):Promise<EncryptedMedia> {
  if(!(source instanceof Blob)||!Number.isSafeInteger(source.size)||
     source.size<1||source.size>LIMIT||!ALLOWED_MIME.has(source.type))invalid();
  const mediaId='m_'+Array.from(bytes(16),v=>v.toString(16).padStart(2,'0')).join('');
  checkContext(root,owner,keyId,mediaId);
  // Retain one account/root identity across every awaited HKDF and chunk read.
  // Otherwise the derived key and each chunk's AAD could bind different owners.
  const pinnedRoot=root.slice();
  root=pinnedRoot;
  owner=Object.freeze({projectId:owner.projectId,ownerId:owner.ownerId});
  try {
  const prefix=bytes(8);
  const manifestBase={
    v:1 as const,alg:'A256GCM' as const,mediaId,keyId,
    noncePrefix:b64(prefix),plainBytes:source.size,
    chunkBytes:CHUNK as 65536,chunks:Math.ceil(source.size/CHUNK),
  };
  const key=await keyFor(root,owner,keyId,mediaId);
  const manifest=manifestBase as EncryptedMediaManifest;
  const encryptedMime=new Uint8Array(await crypto.subtle.encrypt({
    name:'AES-GCM',iv:nonce(prefix,0xffffffff),
    additionalData:context(owner,manifest,'mime',0xffffffff),tagLength:128,
  },key,enc.encode(source.type)));
  const encryptedParts:BlobPart[]=[];
  for(let i=0;i<manifest.chunks;i++){
    const plain=new Uint8Array(await source.slice(i*CHUNK,(i+1)*CHUNK).arrayBuffer());
    try {
      const sealed=await crypto.subtle.encrypt({
        name:'AES-GCM',iv:nonce(prefix,i),
        additionalData:context(owner,manifest,'chunk',i),tagLength:128,
      },key,plain);
      encryptedParts.push(sealed);
    } finally {
      // Failed WebCrypto encryptions must not retain the original photo chunk.
      plain.fill(0);
    }
  }
  return {
    manifest:{...manifestBase,encryptedMime:b64(encryptedMime)},
    ciphertext:new Blob(encryptedParts,{type:'application/octet-stream'}),
  };
  } finally { pinnedRoot.fill(0); }
}

/** Reject truncation, reordering, wrong account/key, altered manifest or bytes. */
export async function openPrivateMedia(
  root:Bytes,owner:Owner,manifest:EncryptedMediaManifest,ciphertext:Blob,
):Promise<Blob> {
  if(!(ciphertext instanceof Blob))invalid();
  // A server-returned manifest is mutable caller input, not a trusted snapshot.
  try{manifest=structuredClone(manifest);}catch{return invalid();}
  const prefix=validManifest(manifest,ciphertext);
  checkContext(root,owner,manifest.keyId,manifest.mediaId);
  const pinnedRoot=root.slice();
  root=pinnedRoot;
  owner=Object.freeze({projectId:owner.projectId,ownerId:owner.ownerId});
  try {
  const key=await keyFor(root,owner,manifest.keyId,manifest.mediaId);
  let mime:string;
  try{
    const sealed=parseB64(manifest.encryptedMime);
    const result=new Uint8Array(await crypto.subtle.decrypt({
      name:'AES-GCM',iv:nonce(prefix,0xffffffff),
      additionalData:context(owner,manifest,'mime',0xffffffff),tagLength:128,
    },key,sealed));
    try {
      mime=dec.decode(result);
      if(!ALLOWED_MIME.has(mime))invalid();
    } finally {
      result.fill(0);
    }
  }catch{return invalid();}
  const parts:BlobPart[]=[];
  const plaintextChunks:Uint8Array<ArrayBuffer>[]=[];
  try {
  let offset=0;
  for(let i=0;i<manifest.chunks;i++){
    const n=Math.min(CHUNK,manifest.plainBytes-i*CHUNK);
    const sealed=new Uint8Array(await ciphertext.slice(offset,offset+n+TAG).arrayBuffer());
    if(sealed.byteLength!==n+TAG)invalid();
    let plain:Uint8Array<ArrayBuffer>;
    try{
      plain=new Uint8Array(await crypto.subtle.decrypt({
        name:'AES-GCM',iv:nonce(prefix,i),
        additionalData:context(owner,manifest,'chunk',i),tagLength:128,
      },key,sealed));
    }catch{return invalid();}
    // Retain each decoded buffer until Blob has synchronously snapshotted
    // its bytes. Never return a Blob backed by a zeroized mutable buffer.
    plaintextChunks.push(plain);
    if(plain.byteLength!==n)invalid();
    parts.push(plain);
    offset+=n+TAG;
  }
  if(offset!==ciphertext.size)invalid();
  return new Blob(parts,{type:mime});
  } finally {
    // Blob constructor copies its parts. Erase all intermediate plaintext
    // on success, invalid length, or a later failed/tampered ciphertext chunk.
    for(const chunk of plaintextChunks)chunk.fill(0);
  }
  } finally { pinnedRoot.fill(0); }
}
