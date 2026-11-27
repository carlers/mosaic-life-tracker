import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  encryptDiary,decryptDiary,encryptPrivateRecord,decryptPrivateRecord,
  generateAccountRoot,generateIndependentRecoverySecret,generateKeyId,
  generateOpaqueRowId,generateRevision,
  formatEmergencyRecoveryKey,parseEmergencyRecoveryKey,
} from '../../src/lib/e2ee/coreCrypto';
afterEach(()=>vi.restoreAllMocks());

describe('dormant root recovery formatting and plaintext ephemeral buffers',()=>{
  it('uses the original secret for both printable key and checksum despite post-call mutation',async()=>{
    const secret=generateIndependentRecoverySecret(),expected=secret.slice();
    const formatting=formatEmergencyRecoveryKey(secret);
    secret.fill(0);
    const printable=await formatting;
    expect(Array.from(await parseEmergencyRecoveryKey(printable)))
      .toEqual(Array.from(expected));
  });
  it('erases the temporary recovery formatting copy without changing the source secret',async()=>{
    const secret=generateIndependentRecoverySecret(),expected=Array.from(secret);
    let copy:Uint8Array|undefined;
    Object.defineProperty(secret,'slice',{value:()=>{
      copy=Uint8Array.prototype.slice.call(secret);
      return copy;
    }});
    const printable=await formatEmergencyRecoveryKey(secret);
    expect(copy?Array.from(copy):null).toEqual(Array(32).fill(0));
    expect(Array.from(secret)).toEqual(expected);
    expect(Array.from(await parseEmergencyRecoveryKey(printable))).toEqual(expected);
  });
  it('erases a decoded recovery secret if its checksum is wrong',async()=>{
    const secret=generateIndependentRecoverySecret();
    const printable=await formatEmergencyRecoveryKey(secret);
    const parts=printable.split('-');
    parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
    const digest=crypto.subtle.digest.bind(crypto.subtle);
    let decoded:Uint8Array|undefined;
    vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm,data)=>{
      if(data instanceof Uint8Array&&data.length===32)decoded=data;
      return digest(algorithm,data);
    });
    await expect(parseEmergencyRecoveryKey(parts.join('-'))).rejects.toThrow();
    expect(decoded).toBeDefined();
    expect(decoded?Array.from(decoded):null).toEqual(Array(32).fill(0));
  });
  it('erases decrypted JSON plaintext buffers after independent object decoding',async()=>{
    const root=generateAccountRoot(),owner={
      projectId:'synthetic_crypto_project',ownerId:'synthetic_plaintext_owner',
    },c={...owner,rowId:generateOpaqueRowId(),keyId:generateKeyId(),
      revision:generateRevision()};
    const payload={content:'SYNTHETIC SENSITIVE DIARY',emoji:'🔒'};
    const diary=await encryptDiary(root,c,payload);
    const record=await encryptPrivateRecord(root,{...c,payloadDomain:'diary'},payload);
    const decrypt=crypto.subtle.decrypt.bind(crypto.subtle);
    const plaintextBuffers:ArrayBuffer[]=[];
    vi.spyOn(crypto.subtle,'decrypt').mockImplementation(async(algorithm,key,data)=>{
      const result=await decrypt(algorithm,key,data);
      plaintextBuffers.push(result);
      return result;
    });
    expect(await decryptDiary(root,c,diary)).toEqual(payload);
    expect(await decryptPrivateRecord(root,{...c,payloadDomain:'diary'},record)).toEqual(payload);
    expect(plaintextBuffers).toHaveLength(2);
    for(const buffer of plaintextBuffers)
      expect(Array.from(new Uint8Array(buffer))).toEqual(Array(buffer.byteLength).fill(0));
  });
});
