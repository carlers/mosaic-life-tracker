import {describe,expect,it} from 'vitest';
import {
  decryptDiary,decryptPrivateRecord,deriveMigratedOwnerRowId,encryptDiary,
  encryptPrivateRecord,unwrapRootFromRecovery,wrapRootForDevice,wrapRootForRecovery,
} from '../../src/lib/e2ee/coreCrypto';

const owner={projectId:'synthetic_crypto_project',ownerId:'synthetic_crypto_root_owner'};
const keyId='k_'+'a'.repeat(32);
const context={...owner,rowId:'p_'+'b'.repeat(32),
  keyId,revision:'r_'+'c'.repeat(32)};
const privateContext={...context,payloadDomain:'task' as const};
async function assertRootCopyErased(operation:(root:Uint8Array)=>Promise<unknown>){
  const root=Uint8Array.from({length:32},(_,index)=>index+1);
  const original=Array.from(root);
  let copy:Uint8Array|undefined;
  Object.defineProperty(root,'slice',{value:()=>{
    copy=Uint8Array.prototype.slice.call(root);
    return copy;
  }});
  await expect(operation(root)).rejects.toThrow();
  expect(copy).toBeInstanceOf(Uint8Array);
  expect(copy?Array.from(copy):null).toEqual(Array(32).fill(0));
  expect(Array.from(root)).toEqual(original);
}

describe('dormant core encryption invocation-key copies are erased on rejection',()=>{
  it('clears derived stable row-ID root if domain validation fails',async()=>{
    await assertRootCopyErased(root=>
      deriveMigratedOwnerRowId(root,owner,
        'unsupported-domain' as Parameters<typeof deriveMigratedOwnerRowId>[2],
        'source-document'));
  });
  it('clears Diary seal root after malformed plaintext',async()=>{
    await assertRootCopyErased(root=>
      encryptDiary(root,context,{content:'PRIVATE',emoji:4} as unknown as
        Parameters<typeof encryptDiary>[2]));
  });
  it('clears Diary open root after malformed envelope',async()=>{
    await assertRootCopyErased(root=>decryptDiary(root,context,null));
  });
  it('clears both account-root and independent recovery-key copies on rejected key ID',async()=>{
    const secret=Uint8Array.from({length:32},(_,i)=>64+i);
    const baseline=Array.from(secret);
    let capturedSecret:Uint8Array|undefined;
    Object.defineProperty(secret,'slice',{value:()=>{
      capturedSecret=Uint8Array.prototype.slice.call(secret);
      return capturedSecret;
    }});
    await assertRootCopyErased(root=>wrapRootForRecovery(root,secret,owner,'invalid'));
    expect(capturedSecret?Array.from(capturedSecret):null).toEqual(Array(32).fill(0));
    expect(Array.from(secret)).toEqual(baseline);
  });
  it('clears independent recovery-key copy after malformed envelope',async()=>{
    await assertRootCopyErased(secret=>unwrapRootFromRecovery(secret,owner,null));
  });
  it('clears account-root device-wrapper copy after rejected key ID',async()=>{
    await assertRootCopyErased(root=>
      wrapRootForDevice(root,null as unknown as CryptoKey,owner,'invalid'));
  });
  it('clears private-record seal root after invalid payload',async()=>{
    await assertRootCopyErased(root=>
      encryptPrivateRecord(root,privateContext,null as unknown as Record<string,unknown>));
  });
  it('clears private-record open root after missing envelope',async()=>{
    await assertRootCopyErased(root=>
      decryptPrivateRecord(root,privateContext,null));
  });
});
