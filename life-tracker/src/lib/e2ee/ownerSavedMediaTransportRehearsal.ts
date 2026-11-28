/**
 * Dormant synthetic encrypted-media transport rehearsal, not an upload API.
 * No network, Storage SDK, ACK, deletion, or normal sync integration.
 * Real delivery needs an independently reviewed server contract and epoch fence.
 */
import type {Bytes,Owner} from './coreCrypto';
import {type EncryptedPendingImage,decryptOwnerPendingImage} from './ownerPendingImageRescue';
import {readStagedOwnerEncryptedMedia} from './ownerSavedMediaIntentStore';
import {SCRATCH_OWNER_V2_PROJECT} from './ownerPrivateV2Contract';

type Selector=Readonly<{rowId:string;mediaId:string;keyId:string;revision:string}>;
export type SyntheticMediaPort=Readonly<{
  put:(item:EncryptedPendingImage)=>Promise<unknown>;
  get:(selector:Selector)=>Promise<unknown>;
}>;
type Gate=Readonly<{assertReady:(owner:Owner,keyId:string)=>Promise<void>}>;
function denied():never {
  throw new Error('Synthetic encrypted media readback incomplete; original intent retained.');
}
function exact(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.getPrototypeOf(value)===Object.prototype&&
    Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
}
function response(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!exact(value,['status','body'])||value.status!==200||!exact(value.body,keys))denied();
  return value.body;
}
function sameHeader(a:EncryptedPendingImage,b:EncryptedPendingImage){
  return a.rowId===b.rowId&&a.keyId===b.keyId&&a.revision===b.revision&&
    JSON.stringify(a.sealedMetadata)===JSON.stringify(b.sealedMetadata)&&
    JSON.stringify(a.sealedMedia.manifest)===JSON.stringify(b.sealedMedia.manifest);
}
async function sameImage(a:EncryptedPendingImage,b:EncryptedPendingImage){
  if(!sameHeader(a,b)||!(b.sealedMedia.ciphertext instanceof Blob)||
    b.sealedMedia.ciphertext.type!=='application/octet-stream'||
    a.sealedMedia.ciphertext.size!==b.sealedMedia.ciphertext.size)return false;
  const left=new Uint8Array(await a.sealedMedia.ciphertext.arrayBuffer());
  const right=new Uint8Array(await b.sealedMedia.ciphertext.arrayBuffer());
  return left.every((v,i)=>v===right[i]);
}
function parseImage(value:unknown):EncryptedPendingImage{
  if(!exact(value,['rowId','revision','keyId','sealedMetadata','sealedMedia'])||
    !exact(value.sealedMedia,['manifest','ciphertext'])||
    !(value.sealedMedia.ciphertext instanceof Blob))denied();
  return value as unknown as EncryptedPendingImage;
}
/** Only accepts an already durable local intent; a successful PUT alone is
 * never evidence of readback. The media queue does not persist a root
 * generation; the external gate must independently verify current root/MFA.
 * No durable server receipt, CAS, real network or migration ACK is implied.
 */
export async function rehearseSavedEncryptedMedia(
  root:Bytes,owner:Owner,rowId:string,keyId:string,port:SyntheticMediaPort,gate:Gate,
):Promise<Readonly<{status:'readback-verified-not-acknowledged';mediaId:string}>>{
  if(!(root instanceof Uint8Array)||root.byteLength!==32||
    owner?.projectId!==SCRATCH_OWNER_V2_PROJECT||typeof owner.ownerId!=='string'||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(owner.ownerId)||
    typeof rowId!=='string'||!/^p_[a-f0-9]{32}$/.test(rowId)||
    typeof keyId!=='string'||!/^k_[a-f0-9]{32}$/.test(keyId)||
    typeof port?.put!=='function'||typeof port?.get!=='function'||
    typeof gate?.assertReady!=='function')denied();
  const scope:Owner=Object.freeze({projectId:owner.projectId,ownerId:owner.ownerId});
  const secret=root.slice();
  const read=async()=>{
    const matches=(await readStagedOwnerEncryptedMedia(secret,scope))
      .filter(entry=>entry.encrypted.rowId===rowId);
    if(matches.length!==1||matches[0].encrypted.keyId!==keyId)denied();
    return matches[0].encrypted;
  };
  try{
    await gate.assertReady(scope,keyId);
    const saved=await read();
    const selector:Selector={rowId,keyId,revision:saved.revision,
      mediaId:saved.sealedMedia.manifest.mediaId};
    await gate.assertReady(scope,keyId);
    const submitted=response(await port.put(structuredClone(saved)),['ok','mediaId','status']);
    if(submitted.ok!==true||submitted.mediaId!==selector.mediaId||
      (submitted.status!=='created'&&submitted.status!=='duplicate'))denied();
    await gate.assertReady(scope,keyId);
    const returned=response(await port.get({...selector}),['ok','item']);
    if(returned.ok!==true)denied();
    const received=parseImage(structuredClone(returned.item));
    if(!await sameImage(saved,received))denied();
    await decryptOwnerPendingImage(scope,secret,received);
    if(!await sameImage(saved,await read()))denied();
    await gate.assertReady(scope,keyId);
    return {status:'readback-verified-not-acknowledged',mediaId:selector.mediaId};
  }finally{secret.fill(0);}
}
