import {afterEach,describe,expect,it,vi} from 'vitest';
import {generateAccountRoot,generateKeyId} from '../../src/lib/e2ee/coreCrypto';
import {sealPrivateMedia,openPrivateMedia} from '../../src/lib/e2ee/privateMediaCodec';

const owner={projectId:'synthetic_scratch',ownerId:'synthetic_media_cleanup'};
const source=()=>new Blob([Uint8Array.from({length:145_000},(_,i)=>i%251)],
  {type:'image/png'});
afterEach(()=>vi.restoreAllMocks());

describe('dormant encrypted photo transient plaintext buffers',()=>{
  it('erases each source chunk even when AES-GCM encryption rejects later',async()=>{
    const photo=source(),originalSlice=photo.slice.bind(photo);
    const chunks:ArrayBuffer[]=[];
    vi.spyOn(photo,'slice').mockImplementation((start,end,type)=>{
      const part=originalSlice(start,end,type);
      const bytes=part.arrayBuffer.bind(part);
      vi.spyOn(part,'arrayBuffer').mockImplementation(async()=>{
        const data=await bytes();
        chunks.push(data);
        return data;
      });
      return part;
    });
    const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);
    let calls=0;
    vi.spyOn(crypto.subtle,'encrypt').mockImplementation(async(...args)=>{
      if(++calls===3)throw new Error('synthetic interrupted AES-GCM');
      return encrypt(...args);
    });
    await expect(sealPrivateMedia(generateAccountRoot(),owner,generateKeyId(),photo))
      .rejects.toThrow('synthetic interrupted AES-GCM');
    expect(chunks).toHaveLength(2);
    for(const buffer of chunks)
      expect(new Uint8Array(buffer)).toEqual(new Uint8Array(buffer.byteLength));
  });
  it('erases every decrypted photo and MIME buffer after creating a valid Blob',async()=>{
    const original=source(),root=generateAccountRoot(),keyId=generateKeyId();
    const sealed=await sealPrivateMedia(root,owner,keyId,original);
    const decrypt=crypto.subtle.decrypt.bind(crypto.subtle);
    const buffers:ArrayBuffer[]=[];
    vi.spyOn(crypto.subtle,'decrypt').mockImplementation(async(...args)=>{
      const bytes=await decrypt(...args);
      buffers.push(bytes);
      return bytes;
    });
    const opened=await openPrivateMedia(root,owner,sealed.manifest,sealed.ciphertext);
    expect(await opened.arrayBuffer()).toEqual(await original.arrayBuffer());
    expect(buffers).toHaveLength(sealed.manifest.chunks+1);
    for(const buffer of buffers)
      expect(new Uint8Array(buffer)).toEqual(new Uint8Array(buffer.byteLength));
  });
  it('erases earlier decrypted photo chunks when a subsequent chunk is tampered',async()=>{
    const root=generateAccountRoot(),keyId=generateKeyId();
    const sealed=await sealPrivateMedia(root,owner,keyId,source());
    const damaged=new Uint8Array(await sealed.ciphertext.arrayBuffer());
    // Tamper the second chunk; the first chunk has already decrypted.
    damaged[65_536+16+17]^=0x40;
    const decrypt=crypto.subtle.decrypt.bind(crypto.subtle);
    const buffers:ArrayBuffer[]=[];
    vi.spyOn(crypto.subtle,'decrypt').mockImplementation(async(...args)=>{
      const bytes=await decrypt(...args);
      buffers.push(bytes);
      return bytes;
    });
    await expect(openPrivateMedia(root,owner,sealed.manifest,new Blob([damaged])))
      .rejects.toThrow();
    expect(buffers.length).toBeGreaterThanOrEqual(2);
    for(const buffer of buffers)
      expect(new Uint8Array(buffer)).toEqual(new Uint8Array(buffer.byteLength));
  });
});
