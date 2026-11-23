/**
 * Synthetic M2 encrypted media transport through caller/MFA-guarded Function.
 * The bucket itself has ZERO browser permissions; send ONLY AES-GCM chunks.
 * This is not normal Mosaic photo sync, not an offline media outbox, and
 * does not authorize M2 rollout. Retry with the SAME EncryptedMedia object
 * (media ID, key ID, nonces, ciphertext) after an uncertain response.
 */
import type { Owner } from './coreCrypto';
import type { CryptoSession, FullyAuthenticatedSessionGate } from './accountRootLifecycle';
import type { EncryptedOwnerRpc } from './ownerCiphertextTransport';
import {
  openPrivateMedia, type EncryptedMedia, type EncryptedMediaManifest,
} from './privateMediaCodec';

export type MediaTransferPhase = 'upload' | 'ack' | 'readback' | 'decrypt';
/** Diagnostic metadata only; never expose the raw remote error message. */
export class MediaTransferError extends Error {
  readonly phase:MediaTransferPhase;
  readonly code?:number;
  readonly timedOut:boolean;
  constructor(phase:MediaTransferPhase,cause:unknown) {
    super('Encrypted media '+phase+' failed.');
    this.name='MediaTransferError';
    this.phase=phase;
    const code=cause && typeof cause==='object' && 'code' in cause
      ? (cause as {code?:unknown}).code : undefined;
    this.code=typeof code==='number' && Number.isSafeInteger(code) &&
      code>=400 && code<=599 ? code : undefined;
    this.timedOut=cause instanceof Error &&
      /^Message action timed out after [0-9]+ms$/.test(cause.message);
  }
}

const SCRATCH='6b00671500279e901846';
const CHUNK=65536, TAG=16, MAX_CHUNKS=192;
const ID=/^m_[a-f0-9]{32}$/;
const KEY=/^k_[a-f0-9]{32}$/;
const enc=(bytes:Uint8Array) => {
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
function decode(encoded:unknown, expected:number):Uint8Array {
  if(typeof encoded!=='string' || encoded.length<2 ||
     encoded.length>87404 || encoded.length%4===1 ||
     !/^[A-Za-z0-9_-]+$/.test(encoded))throw new Error('Encrypted media readback invalid.');
  let bytes:Uint8Array;
  try {
    const binary=atob(encoded.replace(/-/g,'+').replace(/_/g,'/')+
      '='.repeat((4-encoded.length%4)%4));
    bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  }catch{throw new Error('Encrypted media readback invalid.');}
  if(bytes.length!==expected || enc(bytes)!==encoded)
    throw new Error('Encrypted media readback invalid.');
  return bytes;
}
function check(owner:Owner,session:CryptoSession,manifest:EncryptedMediaManifest) {
  if(owner?.projectId!==SCRATCH || !owner.ownerId ||
     !(session?.root instanceof Uint8Array) || session.root.length!==32 ||
     !manifest || manifest.v!==1 || manifest.alg!=='A256GCM' ||
     !ID.test(manifest.mediaId) || !KEY.test(manifest.keyId) ||
     manifest.keyId!==session.keyId || manifest.chunkBytes!==CHUNK ||
     !Number.isSafeInteger(manifest.plainBytes) || manifest.plainBytes<1 ||
     manifest.plainBytes>12*1024*1024 ||
     !Number.isSafeInteger(manifest.chunks) || manifest.chunks<1 ||
     manifest.chunks>MAX_CHUNKS ||
     manifest.chunks!==Math.ceil(manifest.plainBytes/CHUNK))
    throw new Error('Encrypted media unavailable.');
}
function partLength(manifest:EncryptedMediaManifest,index:number):number {
  return Math.min(CHUNK,manifest.plainBytes-index*CHUNK)+TAG;
}
function verifyResponse(data:Record<string,unknown>,manifest:EncryptedMediaManifest,index:number) {
  if(data.ok!==true || data.mediaId!==manifest.mediaId ||
     data.keyId!==manifest.keyId || data.chunkIndex!==index ||
     data.chunks!==manifest.chunks)
    throw new Error('Encrypted media readback invalid.');
}
function same(a:Uint8Array,b:Uint8Array):boolean {
  return a.length===b.length && a.every((value,index)=>value===b[index]);
}
async function downloadChunk(
  owner:Owner,manifest:EncryptedMediaManifest,index:number,rpc:EncryptedOwnerRpc,
  gate:FullyAuthenticatedSessionGate,
):Promise<Uint8Array> {
  await gate.assertReady(owner);
  try {
    const data=await rpc.send('media_get_chunk',{
      mediaId:manifest.mediaId,keyId:manifest.keyId,
      chunkIndex:index,chunks:manifest.chunks,
    });
    verifyResponse(data,manifest,index);
    return decode(data.ciphertext,partLength(manifest,index));
  } catch (cause) { throw new MediaTransferError('readback',cause); }
}

export async function uploadEncryptedOwnerMedia(
  owner:Owner,session:CryptoSession,media:EncryptedMedia,
  rpc:EncryptedOwnerRpc,gate:FullyAuthenticatedSessionGate,
  progress?: (completed:number,total:number)=>void,
):Promise<EncryptedMediaManifest> {
  check(owner,session,media.manifest);
  if(!(media.ciphertext instanceof Blob) ||
     media.ciphertext.size!==media.manifest.plainBytes+TAG*media.manifest.chunks)
    throw new Error('Encrypted media unavailable.');
  // Authenticate the complete local ciphertext before any remote action.
  await openPrivateMedia(session.root,owner,media.manifest,media.ciphertext);
  let offset=0;
  for(let index=0;index<media.manifest.chunks;index++) {
    const n=partLength(media.manifest,index);
    const bytes=new Uint8Array(await media.ciphertext.slice(offset,offset+n).arrayBuffer());
    if(bytes.length!==n)throw new Error('Encrypted media unavailable.');
    await gate.assertReady(owner);
    let ack:Record<string,unknown>;
    try {
      ack=await rpc.send('media_put_chunk',{
        mediaId:media.manifest.mediaId,keyId:media.manifest.keyId,
        chunkIndex:index,chunks:media.manifest.chunks,ciphertext:enc(bytes),
      });
    } catch (cause) { throw new MediaTransferError('upload',cause); }
    try {
      verifyResponse(ack,media.manifest,index);
      if(ack.status!=='created' && ack.status!=='duplicate')
        throw new Error('Unexpected encrypted-media ACK.');
    } catch (cause) { throw new MediaTransferError('ack',cause); }
    // ACK alone cannot authorize completion, including duplicate/lost-ACK.
    const observed=await downloadChunk(owner,media.manifest,index,rpc,gate);
    if(!same(bytes,observed))
      throw new MediaTransferError('readback',new Error('Mismatch'));
    offset+=n;
    progress?.(index+1,media.manifest.chunks);
  }
  if(offset!==media.ciphertext.size)throw new Error('Encrypted media unavailable.');
  return media.manifest;
}
export async function downloadEncryptedOwnerMedia(
  owner:Owner,session:CryptoSession,manifest:EncryptedMediaManifest,
  rpc:EncryptedOwnerRpc,gate:FullyAuthenticatedSessionGate,
  progress?: (completed:number,total:number)=>void,
):Promise<Blob> {
  check(owner,session,manifest);
  const parts:Uint8Array<ArrayBuffer>[]=[];
  for(let index=0;index<manifest.chunks;index++) {
    parts.push(new Uint8Array(await downloadChunk(owner,manifest,index,rpc,gate)));
    progress?.(index+1,manifest.chunks);
  }
  try {
    return await openPrivateMedia(session.root,owner,manifest,
      new Blob(parts,{type:'application/octet-stream'}));
  } catch (cause) { throw new MediaTransferError('decrypt',cause); }
}
