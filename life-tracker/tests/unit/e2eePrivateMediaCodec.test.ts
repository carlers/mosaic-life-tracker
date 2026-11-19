import { describe, expect, it } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import { sealPrivateMedia, openPrivateMedia } from '../../src/lib/e2ee/privateMediaCodec';
const owner={projectId:'scratch',ownerId:'synthetic_owner'};
const blob=(size:number)=>new Blob([new Uint8Array(
  Array.from({length:size},(_,i)=>i*19%251))],{type:'image/png'});

describe('M2 source-only encrypted media AEAD codec',()=>{
  it('encrypts and authenticates multiple chunks without exposing MIME or plaintext',async()=>{
    const root=generateAccountRoot(),keyId=generateKeyId();
    const input=blob(146_000);
    const sealed=await sealPrivateMedia(root,owner,keyId,input);
    expect(sealed.manifest.chunks).toBe(3);
    expect(sealed.manifest.mediaId).toMatch(/^m_[a-f0-9]{32}$/);
    expect(sealed.manifest.encryptedMime).not.toContain('image/png');
    expect(sealed.ciphertext.type).toBe('application/octet-stream');
    const result=await openPrivateMedia(root,owner,sealed.manifest,sealed.ciphertext);
    expect(result.type).toBe('image/png');
    expect(new Uint8Array(await result.arrayBuffer()))
      .toEqual(new Uint8Array(await input.arrayBuffer()));
    expect(new Uint8Array(await sealed.ciphertext.arrayBuffer()).slice(0,100))
      .not.toEqual(new Uint8Array(await input.arrayBuffer()).slice(0,100));
  });
  it('uses independent random media IDs/nonces for repeated identical content',async()=>{
    const root=generateAccountRoot(),kid=generateKeyId();
    const x=await sealPrivateMedia(root,owner,kid,blob(100));
    const y=await sealPrivateMedia(root,owner,kid,blob(100));
    expect(x.manifest.mediaId).not.toBe(y.manifest.mediaId);
    expect(x.manifest.noncePrefix).not.toBe(y.manifest.noncePrefix);
    expect(new Uint8Array(await x.ciphertext.arrayBuffer()))
      .not.toEqual(new Uint8Array(await y.ciphertext.arrayBuffer()));
  });
  it('rejects wrong owner, project, data key or altered encrypted metadata',async()=>{
    const root=generateAccountRoot();
    const sealed=await sealPrivateMedia(root,owner,generateKeyId(),blob(130000));
    for(const scope of [{...owner,ownerId:'other'},{...owner,projectId:'other'}]){
      await expect(openPrivateMedia(root,scope,sealed.manifest,sealed.ciphertext)).rejects.toThrow();
    }
    await expect(openPrivateMedia(generateAccountRoot(),owner,
      sealed.manifest,sealed.ciphertext)).rejects.toThrow();
    await expect(openPrivateMedia(root,owner,{...sealed.manifest,
      plainBytes:sealed.manifest.plainBytes+1},sealed.ciphertext)).rejects.toThrow();
    await expect(openPrivateMedia(root,owner,{...sealed.manifest,
      mediaId:'m_'+'0'.repeat(32)},sealed.ciphertext)).rejects.toThrow();
    await expect(openPrivateMedia(root,owner,{...sealed.manifest,
      encryptedMime:'AAAA'},sealed.ciphertext)).rejects.toThrow();
  });
  it('rejects altered ciphertext, extra bytes, truncation and swapped chunks',async()=>{
    const root=generateAccountRoot(),kid=generateKeyId();
    const sealed=await sealPrivateMedia(root,owner,kid,blob(145000));
    const original=new Uint8Array(await sealed.ciphertext.arrayBuffer());
    const changed=original.slice();changed[120]^=0x80;
    await expect(openPrivateMedia(root,owner,sealed.manifest,new Blob([changed])))
      .rejects.toThrow();
    await expect(openPrivateMedia(root,owner,sealed.manifest,
      new Blob([original.slice(0,-1)]))).rejects.toThrow();
    await expect(openPrivateMedia(root,owner,sealed.manifest,
      new Blob([original,new Uint8Array([0])]))).rejects.toThrow();
    const chunkSize=65536+16;
    const reordered=new Uint8Array(original.byteLength);
    reordered.set(original.slice(chunkSize,chunkSize*2),0);
    reordered.set(original.slice(0,chunkSize),chunkSize);
    reordered.set(original.slice(chunkSize*2),chunkSize*2);
    await expect(openPrivateMedia(root,owner,sealed.manifest,new Blob([reordered])))
      .rejects.toThrow();
  });
  it('rejects unsafe MIME, empty/oversize files and malformed manifest',async()=>{
    const root=generateAccountRoot(),kid=generateKeyId();
    for(const source of [new Blob([],{type:'image/png'}),
      new Blob(['<svg onload="alert(1)"/>'],{type:'image/svg+xml'}),
      new Blob(['private script'],{type:'text/html'}),
      new Blob([new Uint8Array(12*1024*1024+1)],{type:'image/png'})]) {
      await expect(sealPrivateMedia(root,owner,kid,source)).rejects.toThrow();
    }
    const sealed=await sealPrivateMedia(root,owner,kid,blob(12));
    await expect(openPrivateMedia(root,owner,{...sealed.manifest,
      chunks:2},sealed.ciphertext)).rejects.toThrow();
    await expect(openPrivateMedia(root,owner,{...sealed.manifest,
      noncePrefix:'AAAAAAAA'},sealed.ciphertext)).rejects.toThrow();
  });
});
