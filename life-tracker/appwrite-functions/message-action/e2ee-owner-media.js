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
// Expose only a fixed classification to the already owner/MFA-gated synthetic
// lab. Never return Appwrite's raw message, exception type or request body.

// Appwrite SDK transport failures (e.g. undici fetch) have no numeric HTTP
// status. Map only exact internal error codes to fixed, privacy-safe classes.
// Never return exception messages, endpoint, key, stack or original media IDs.
function transportReason(error) {
  const cause=error?.cause;
  const code=typeof cause?.code==='string' ? cause.code : '';
  if(code==='ENOTFOUND'||code==='EAI_AGAIN')
    return 'storage_transport_dns';
  if(code==='ECONNREFUSED')
    return 'storage_transport_refused';
  if(['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT'].includes(code))
    return 'storage_transport_timeout';
  if(['ECONNRESET','EPIPE','UND_ERR_SOCKET'].includes(code))
    return 'storage_transport_reset';
  if(['CERT_HAS_EXPIRED','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code))
    return 'storage_transport_tls';
  if(['UND_ERR_REQ_CONTENT_LENGTH_MISMATCH','UND_ERR_INVALID_ARG'].includes(code))
    return 'storage_transport_payload';
  if(error?.message==='File not found in payload' ||
     error?.message==='Unsupported input type for InputFile.fromBuffer')
    return 'storage_sdk_input';
  if(error?.message==='fetch failed' && error instanceof TypeError)
    return 'storage_transport_unknown';
  return 'storage_write_unknown';
}
function storageWriteFailure(error) {
  const code=Number.isSafeInteger(error?.code) ? error.code : null;
  const reason=code===401 || code===403 ? 'storage_write_forbidden'
    : code===404 ? 'storage_bucket_missing'
    : code===413 ? 'storage_size_rejected'
    : code===429 ? 'storage_rate_limited'
    : code===400 || code===422 ? 'storage_request_rejected'
    : code!==null && code>=500 && code<=599 ? 'storage_service_unavailable'
    : transportReason(error);
  return result(code===413 ? 413 : 503,
    {error:'Encrypted media upload unavailable',reason});
}
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
// An error with no HTTP status may be a lost post-commit ACK. Any read
// reconciliation must stay inside the Function's synchronous budget even if
// the original Storage transport is stalled; pending read-only GETs cannot
// authorize completion after this bound expires.
async function boundedStoredChunk(storage,fileId) {
  let timeout;
  try {
    return await Promise.race([
      getStoredChunk(storage,fileId),
      new Promise((_,reject)=>{
        timeout=setTimeout(()=>reject(new Error('Bounded readback expired')),1200);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
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
  // A transient backend error can arrive after the bytes were committed.
  // One bounded retry with the *identical* file ID and ciphertext is safe;
  // a 409 must still be independently byte-read and validated.
  let writeError=null;
  for(let attempt=0;attempt<2;attempt++) {
    try {
      await storage.createFile({
        bucketId:BUCKET,fileId,
        file:InputFile.fromBuffer(ciphertext,fileId+'.bin'),
        permissions:[],
      });
      writeError=null;
      break;
    } catch(error) {
      writeError=error;
      if(attempt===0 && [502,503,504].includes(error?.code)) continue;
      break;
    }
  }
  if(writeError) {
    // A transport exception can occur after the server committed a chunk.
    // Reconcile exactly the deterministic ID and immutable ciphertext first,
    // without generating another nonce or attempting another write.
    if(writeError?.code===undefined || writeError?.code===null) {
      try {
        const existing=await boundedStoredChunk(storage,fileId);
        if(existing.length!==ciphertext.length ||
           !crypto.timingSafeEqual(existing,ciphertext))
          return result(409,{error:'Encrypted upload collision'});
        return result(200,{ok:true,status:'duplicate',
          mediaId:payload.mediaId,keyId:payload.keyId,
          chunkIndex:payload.chunkIndex,chunks:payload.chunks});
      } catch {
        // No verified persistent bytes; report the sanitized original
        // transport failure, never claim an upload succeeded.
      }
    }
    if(writeError?.code!==409)return storageWriteFailure(writeError);
    let existing;
    try{existing=await getStoredChunk(storage,fileId);}
    catch{return result(503,{error:'Encrypted upload unavailable',
      reason:'storage_readback_unavailable'});}
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
  catch{return result(503,{error:'Encrypted upload unavailable',
    reason:'storage_readback_unavailable'});}
  if(observed.length!==ciphertext.length ||
     !crypto.timingSafeEqual(observed,ciphertext))
    return result(409,{error:'Encrypted upload readback mismatch'});
  return result(200,{ok:true,status:'created',
    mediaId:payload.mediaId,keyId:payload.keyId,chunkIndex:payload.chunkIndex,
    chunks:payload.chunks});
}
module.exports={handleOwnerMedia};
