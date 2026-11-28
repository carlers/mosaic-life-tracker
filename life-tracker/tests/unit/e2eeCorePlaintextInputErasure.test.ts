import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  encryptDiary,encryptPrivateRecord,decryptDiary,decryptPrivateRecord,
  wrapRootForRecovery,unwrapRootFromRecovery,
  generateAccountRoot,generateIndependentRecoverySecret,
  generateKeyId,generateOpaqueRowId,generateRevision,
} from '../../src/lib/e2ee/coreCrypto';

const owner={projectId:'synthetic_scratch',ownerId:'synthetic_crypto_erase_owner'};
const context={...owner,rowId:generateOpaqueRowId(),
  keyId:generateKeyId(),revision:generateRevision()};
afterEach(()=>vi.restoreAllMocks());

describe('dormant core AES-GCM encryption erases temporary plaintext inputs',()=>{
  it('clears encoded Diary and record JSON after successful WebCrypto encryption',async()=>{
    const root=generateAccountRoot(),originalRoot=Array.from(root);
    const original=crypto.subtle.encrypt.bind(crypto.subtle);
    const raw:Uint8Array[]=[];
    vi.spyOn(crypto.subtle,'encrypt').mockImplementation(async(algorithm,key,data)=>{
      if(data instanceof Uint8Array)raw.push(data);
      return original(algorithm,key,data);
    });
    const diary={content:'SYNTHETIC SECRET JOURNAL',emoji:'🌙'};
    const sealedDiary=await encryptDiary(root,context,diary);
    const record={title:'SYNTHETIC SECRET TASK'};
    const sealedRecord=await encryptPrivateRecord(root,
      {...context,payloadDomain:'task'},record);
    expect(await decryptDiary(root,context,sealedDiary)).toEqual(diary);
    expect(await decryptPrivateRecord(root,{...context,payloadDomain:'task'},sealedRecord))
      .toEqual(record);
    expect(raw).toHaveLength(2);
    for(const bytes of raw)expect(Array.from(bytes)).toEqual(Array(bytes.length).fill(0));
    expect(Array.from(root)).toEqual(originalRoot);
  });
  it('clears encoding bytes even when WebCrypto encryption fails',async()=>{
    const root=generateAccountRoot(),original=Array.from(root);
    let originalPlaintext:Uint8Array|undefined;
    vi.spyOn(crypto.subtle,'encrypt').mockImplementation(async(_algorithm,_key,data)=>{
      if(data instanceof Uint8Array)originalPlaintext=data;
      throw new Error('synthetic AES-GCM failure');
    });
    await expect(encryptPrivateRecord(root,{...context,payloadDomain:'task'},
      {title:'SECRET REJECTED'})).rejects.toThrow('synthetic AES-GCM failure');
    expect(originalPlaintext).toBeInstanceOf(Uint8Array);
    expect(originalPlaintext?Array.from(originalPlaintext):null)
      .toEqual(Array(originalPlaintext?.length??0).fill(0));
    expect(Array.from(root)).toEqual(original);
  });
  it('keeps the real account root intact after wrapping with an independent key',async()=>{
    const root=generateAccountRoot(),expected=Array.from(root);
    const recovery=generateIndependentRecoverySecret(),kid=generateKeyId();
    const envelope=await wrapRootForRecovery(root,recovery,owner,kid);
    expect(Array.from(await unwrapRootFromRecovery(recovery,owner,envelope)))
      .toEqual(expected);
    expect(Array.from(root)).toEqual(expected);
  });
});
