import { describe, expect, it, vi } from 'vitest';
import { generateAccountRoot, generateKeyId } from '../../src/lib/e2ee/coreCrypto';
import { sealPrivateMedia } from '../../src/lib/e2ee/privateMediaCodec';
import {
  uploadEncryptedOwnerMedia, downloadEncryptedOwnerMedia,
} from '../../src/lib/e2ee/ownerEncryptedMediaTransport';
import type { EncryptedOwnerRpc } from '../../src/lib/e2ee/ownerCiphertextTransport';

const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_owner'};
const gate={assertReady:vi.fn(async()=>{})};
function key(){return {root:generateAccountRoot(),keyId:generateKeyId(),generation:1};}
const blob=(bytes=65537)=>new Blob([new Uint8Array(bytes).fill(201)],{type:'image/png'});

function rpcForCipher(cipher:Uint8Array[]) {
  let calls=0;
  const rpc:EncryptedOwnerRpc={send:vi.fn(async(operation,payload={})=>{
    const index=payload.chunkIndex as number;
    if(operation==='media_put_chunk') {
      expect(payload.mediaId).toMatch(/^m_[a-f0-9]{32}$/);
      expect(payload.keyId).toMatch(/^k_[a-f0-9]{32}$/);
      expect(payload.ciphertext).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(JSON.stringify(payload)).not.toContain('image/png');
      calls++;
      return {ok:true,status:'created',mediaId:payload.mediaId,
        keyId:payload.keyId,chunkIndex:index,chunks:payload.chunks};
    }
    if(operation==='media_get_chunk') {
      const raw=cipher[index];
      let text='';
      for(const byte of raw)text+=String.fromCharCode(byte);
      return {ok:true,mediaId:payload.mediaId,keyId:payload.keyId,
        chunkIndex:index,chunks:payload.chunks,
        ciphertext:btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
    }
    throw new Error('unexpected media operation');
  })};
  return {rpc,putCount:()=>calls};
}

describe('M2 isolated owner encrypted media upload/download',()=>{
  it('uploads only 64 KiB encrypted chunks and round-trips bytes under owner/key-bound AEAD',async()=>{
    const session=key(),input=blob();
    const encrypted=await sealPrivateMedia(session.root,owner,session.keyId,input);
    const encryptedBytes=new Uint8Array(await encrypted.ciphertext.arrayBuffer());
    const parts=[
      encryptedBytes.slice(0,65552),
      encryptedBytes.slice(65552),
    ];
    const {rpc,putCount}=rpcForCipher(parts);
    const progress=vi.fn();
    const manifest=await uploadEncryptedOwnerMedia(owner,session,encrypted,rpc,gate,progress);
    expect(manifest).toEqual(encrypted.manifest);
    expect(manifest.chunks).toBe(2);
    expect(putCount()).toBe(2);
    expect(progress).toHaveBeenCalledWith(1,2);
    expect(progress).toHaveBeenCalledWith(2,2);
    const downloaded=await downloadEncryptedOwnerMedia(owner,session,manifest,rpc,gate);
    expect(downloaded.type).toBe('image/png');
    expect(new Uint8Array(await downloaded.arrayBuffer()))
      .toEqual(new Uint8Array(await input.arrayBuffer()));
    expect(JSON.stringify(vi.mocked(rpc.send).mock.calls))
      .not.toContain('synthetic_owner');
  });

  it('retries identical ciphertext after lost upload ACK; no nonce rotation/re-encryption',async()=>{
    const session=key();
    const encrypted=await sealPrivateMedia(session.root,owner,session.keyId,blob(100));
    const ciphertext=new Uint8Array(await encrypted.ciphertext.arrayBuffer());
    const send=vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async(op:string,payload:Record<string,unknown>)=>{
        if(op==='media_put_chunk')return {
          ok:true,status:'duplicate',
          mediaId:payload.mediaId,keyId:payload.keyId,
          chunkIndex:payload.chunkIndex,chunks:payload.chunks,
        };
        if(op==='media_get_chunk'){
          let text='';
          for(const byte of ciphertext)text+=String.fromCharCode(byte);
          return {ok:true,mediaId:payload.mediaId,keyId:payload.keyId,
            chunkIndex:payload.chunkIndex,chunks:payload.chunks,
            ciphertext:btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
        }
        throw new Error('bad');
      });
    const rpc:EncryptedOwnerRpc={send};
    await expect(uploadEncryptedOwnerMedia(owner,session,encrypted,rpc,gate))
      .rejects.toThrow('offline');
    await expect(uploadEncryptedOwnerMedia(owner,session,encrypted,rpc,gate))
      .resolves.toEqual(encrypted.manifest);
    expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);
  });

  it('fails closed on foreign account, wrong key, altered server bytes or missing ACK',async()=>{
    const session=key(),encrypted=await sealPrivateMedia(
      session.root,owner,session.keyId,blob(25));
    const badRpc:EncryptedOwnerRpc={send:vi.fn(async op=>{
      if(op==='media_put_chunk')return {
        ok:true,status:'created',mediaId:encrypted.manifest.mediaId,
        keyId:encrypted.manifest.keyId,chunkIndex:0,chunks:1,
      };
      return {ok:true,mediaId:encrypted.manifest.mediaId,
        keyId:encrypted.manifest.keyId,chunkIndex:0,chunks:1,
        ciphertext:'AAAAAAAAAAAAAAAAAAAAAAAA'};
    })};
    await expect(uploadEncryptedOwnerMedia(owner,session,encrypted,badRpc,gate))
      .rejects.toThrow('readback');
    await expect(downloadEncryptedOwnerMedia(owner,session,
      encrypted.manifest,badRpc,gate)).rejects.toThrow();
    const wrongOwner={...owner,ownerId:'foreign'};
    await expect(uploadEncryptedOwnerMedia(wrongOwner,session,encrypted,badRpc,gate))
      .rejects.toThrow();
    await expect(uploadEncryptedOwnerMedia({...owner,projectId:'6ae94a2100014d01f5ed'},
      session,encrypted,badRpc,gate)).rejects.toThrow('unavailable');
    await expect(uploadEncryptedOwnerMedia(owner,{...session,keyId:generateKeyId()},
      encrypted,badRpc,gate)).rejects.toThrow('unavailable');
    const unavailable:EncryptedOwnerRpc={send:vi.fn(async()=>({ok:true}))};
    await expect(uploadEncryptedOwnerMedia(owner,session,encrypted,unavailable,gate))
      .rejects.toThrow();
  });
});
