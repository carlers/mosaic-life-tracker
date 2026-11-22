'use strict';
/**
 * M2 encrypted owner media chunk transport — isolated synthetic Scratch ONLY.
 * Zero client read/create permissions on private_owner_media_v1. The server
 * sees ciphertext and size but never the account root, MIME, plaintext or
 * semantic app identifiers. Each 64-KiB AES-GCM chunk has an immutable,
 * caller-derived opaque file ID. Replays must be byte-identical.
 *
 * This is not a normal RxDB photo-sync path or old-PWA writer fence.
 */
const crypto = require('node:crypto');
const { InputFile } = require('node-appwrite/file');
const BUCKET = 'private_owner_media_v1';
const MAX_CHUNKS = 192;
const CHUNK_PLUS_TAG = 65536 + 16;
const RE = {
  media: /^m_[a-f0-9]{32}$/,
  key: /^k_[a-f0-9]{32}$/,
};
const result = (status,body)=>({status,body});
function exact(o,keys) {
  return !!o && typeof o==='object' && !Array.isArray(o) &&
    Object.keys(o).length===keys.length &&
    keys.every(k=>Object.prototype.hasOwnProperty.call(o,k));
}
function validate(payload,write=false) {
  if (!payload || !RE.media.test(payload.mediaId) ||
      !RE.key.test(payload.keyId) ||
      !Number.isSafeInteger(payload.chunkIndex) ||
      !Number.isSafeInteger(payload.chunks) || payload.chunks<1 ||
      payload.chunks>MAX_CHUNKS || payload.chunkIndex<0 ||
      payload.chunkIndex>=payload.chunks) return null;
  const allowed = write
    ? ['action','operation','projectId','ownerId','mediaId','keyId','chunkIndex','chunks','ciphertext']
    : ['action','operation','projectId','ownerId','mediaId','keyId','chunkIndex','chunks'];
  for(const key of Object.keys(payload)) {
    if(!allowed.includes(key))return null;
  }
  if(!write)return {ciphertext:null};
  if(typeof payload.ciphertext!=='string' ||
     payload.ciphertext.length<23 || payload.ciphertext.length>87404 ||
     !/^[A-Za-z0-9_-]+$/.test(payload.ciphertext) ||
     payload.ciphertext.length%4===1)return null;
  let ciphertext;
  try {
    ciphertext=Buffer.from(payload.ciphertext,'base64url');
    if(ciphertext.toString('base64url')!==payload.ciphertext ||
       ciphertext.length<17 || ciphertext.length>CHUNK_PLUS_TAG ||
       (payload.chunkIndex < payload.chunks-1 &&
         ciphertext.length!==CHUNK_PLUS_TAG))return null;
  }catch{return null;}
  return {ciphertext};
}
function opaqueFileId(ownerId,mediaId,keyId,chunkIndex) {
  return 'em_'+crypto.createHash('sha256')
    .update('mosaic-e2ee-owner-media-v1\0')
    .update(JSON.stringify([ownerId,mediaId,keyId,chunkIndex]))
    .digest('hex').slice(0,32);
}
function readBuffer(value) {
  if(Buffer.isBuffer(value))return value;
  if(value instanceof ArrayBuffer)return Buffer.from(value);
  if(value && ArrayBuffer.isView(value))
    return Buffer.from(value.buffer,value.byteOffset,value.byteLength);
  throw new Error('Invalid encrypted media download.');
}
async function getStoredChunk(storage,fileId) {
  const output=await storage.getFileDownload({
    bucketId:BUCKET,fileId,
  });
  const buffer=readBuffer(output);
  if(buffer.length<17 || buffer.length>CHUNK_PLUS_TAG)throw new Error('Invalid encrypted chunk');
  return buffer;
}
async function handleOwnerMedia(storage,ownerId,payload) {
  const isPut=payload?.operation==='media_put_chunk';
  const isGet=payload?.operation==='media_get_chunk';
  if(!isPut&&!isGet)return result(400,{error:'Unavailable'});
  const checked=validate(payload,isPut);
  if(!checked || !storage || typeof storage.getFileDownload!=='function' ||
     (isPut&&typeof storage.createFile!=='function'))
    return result(400,{error:'Invalid encrypted media intent'});
  const fileId=opaqueFileId(ownerId,payload.mediaId,payload.keyId,payload.chunkIndex);
  if(isGet) {
    try {
      const stored=await getStoredChunk(storage,fileId);
      if(payload.chunkIndex<payload.chunks-1 &&
         stored.length!==CHUNK_PLUS_TAG)
        return result(409,{error:'Invalid encrypted chunk'});
      return result(200,{ok:true,mediaId:payload.mediaId,keyId:payload.keyId,
        chunkIndex:payload.chunkIndex,chunks:payload.chunks,
        ciphertext:stored.toString('base64url')});
    }catch {
      return result(404,{error:'Encrypted media chunk unavailable'});
    }
  }
  const ciphertext=checked.ciphertext;
  try {
    await storage.createFile({
      bucketId:BUCKET,fileId,
      file:InputFile.fromBuffer(ciphertext,fileId+'.bin'),
      permissions:[],
    });
  }catch(error) {
    // A lost ACK must NOT permit a different ciphertext under the same ID.
    if(error?.code!==409)return result(503,{error:'Encrypted upload unavailable'});
    let existing;
    try{existing=await getStoredChunk(storage,fileId);}
    catch{return result(409,{error:'Encrypted upload collision'});}
    if(existing.length!==ciphertext.length ||
       !crypto.timingSafeEqual(existing,ciphertext))
      return result(409,{error:'Encrypted upload collision'});
    return result(200,{ok:true,status:'duplicate',
      mediaId:payload.mediaId,keyId:payload.keyId,chunkIndex:payload.chunkIndex,
      chunks:payload.chunks});
  }
  // An upload ACK alone is not a commit: read the independent immutable bytes.
  let observed;
  try{observed=await getStoredChunk(storage,fileId);}
  catch{return result(503,{error:'Encrypted upload readback unavailable'});}
  if(observed.length!==ciphertext.length ||
     !crypto.timingSafeEqual(observed,ciphertext))
    return result(409,{error:'Encrypted upload readback mismatch'});
  return result(200,{ok:true,status:'created',
    mediaId:payload.mediaId,keyId:payload.keyId,chunkIndex:payload.chunkIndex,
    chunks:payload.chunks});
}
module.exports={handleOwnerMedia};
