import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, type MockStorage } from '../helpers/invoke-handler';

const owner='synthetic_m2_owner';
const mediaId='m_'+'a'.repeat(32), keyId='k_'+'b'.repeat(32);
const bytes=Buffer.alloc(65552,17);
const encoded=bytes.toString('base64url');
const sample={
  mediaId,keyId,chunkIndex:0,chunks:2,ciphertext:encoded,
};
function storage(content:Buffer=bytes):MockStorage {
  return {
    listFiles:vi.fn(),deleteFile:vi.fn(),
    createFile:vi.fn(async()=>({$id:'opaque'})),
    getFileDownload:vi.fn(async()=>content),
  };
}
async function request(
  operation:string,extra:Record<string,unknown>={},
  media:MockStorage=storage(),inputOwner=owner,
) {
  return invoke({
    userId:inputOwner,body:{
      action:'e2ee_owner_v1',operation,...extra,
    },
    mockDb:makeMockDb(),mockStorage:media,
  });
}
describe('M2 isolated owner/MFA encrypted photo-chunk Function',()=>{
  beforeEach(()=>{
    vi.stubEnv('APPWRITE_FUNCTION_PROJECT_ID','6b00671500279e901846');
    vi.stubEnv('APPWRITE_FUNCTION_API_ENDPOINT','http://127.0.0.1/v1');
    vi.stubEnv('MOSAIC_E2EE_OWNER_ENABLED','true');
    vi.stubEnv('MOSAIC_E2EE_OWNER_ALLOWED_OWNER_IDS',owner);
  });
  afterEach(()=>vi.unstubAllEnvs());

  it('writes only encrypted binary with zero browser permissions, read-verifying bytes',async()=>{
    const m=storage();
    const response=await request('media_put_chunk',sample,m);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok:true,status:'created',mediaId,keyId,chunkIndex:0,chunks:2,
    });
    expect(m.createFile).toHaveBeenCalledOnce();
    const args=vi.mocked(m.createFile!).mock.calls[0][0] as Record<string,unknown>;
    expect(args).toMatchObject({bucketId:'private_owner_media_v1',permissions:[]});
    expect(args.fileId).toMatch(/^em_[a-f0-9]{32}$/);
    expect(JSON.stringify(args)).not.toContain(owner);
    expect(JSON.stringify(args)).not.toContain(mediaId);
    expect(m.getFileDownload).toHaveBeenCalledWith({
      bucketId:'private_owner_media_v1',fileId:args.fileId,
    });
    const downloaded=await request('media_get_chunk',{
      mediaId,keyId,chunkIndex:0,chunks:2,
    },m);
    expect(downloaded.status).toBe(200);
    expect(downloaded.body.ciphertext).toBe(encoded);
  });

  it('treats identical duplicate ciphertext as idempotent, rejects collisions',async()=>{
    const m=storage();
    vi.mocked(m.createFile!).mockRejectedValue(Object.assign(new Error('duplicate'),{code:409}));
    const identical=await request('media_put_chunk',sample,m);
    expect(identical.status).toBe(200);
    expect(identical.body.status).toBe('duplicate');
    vi.mocked(m.getFileDownload!).mockResolvedValue(Buffer.alloc(65552,18));
    const changed=await request('media_put_chunk',sample,m);
    expect(changed.status).toBe(409);
    expect(changed.body.error).toMatch(/collision/);
    vi.mocked(m.getFileDownload!).mockRejectedValue(new Error('unavailable'));
    expect((await request('media_put_chunk',sample,m)).status).toBe(409);
  });

  it('never acknowledges a write without matching authoritative ciphertext readback',async()=>{
    const m=storage(Buffer.alloc(65552,91));
    expect((await request('media_put_chunk',sample,m)).status).toBe(409);
    vi.mocked(m.getFileDownload!).mockRejectedValue(new Error('readback network loss'));
    expect((await request('media_put_chunk',sample,m)).status).toBe(503);
    vi.mocked(m.createFile!).mockRejectedValue(new Error('storage down'));
    expect((await request('media_put_chunk',sample,m)).status).toBe(503);
  });

  it('rejects wrong project, disabled flag, wrong owner and incomplete MFA BEFORE storage writes',async()=>{
    const m=storage();
    for(const [env,value] of [
      ['APPWRITE_FUNCTION_PROJECT_ID','6ae94a2100014d01f5ed'],
      ['MOSAIC_E2EE_OWNER_ENABLED','false'],
    ] as const) {
      vi.stubEnv(env,value);
      expect((await request('media_put_chunk',sample,m)).status).toBe(404);
      vi.stubEnv(env,env==='APPWRITE_FUNCTION_PROJECT_ID'?
        '6b00671500279e901846':'true');
    }
    expect((await request('media_put_chunk',sample,m,'other')).status).toBe(403);
    const denied=await invoke({
      userId:owner,pilotSessionRejected:true,body:{
        action:'e2ee_owner_v1',operation:'media_put_chunk',...sample,
      },mockDb:makeMockDb(),mockStorage:m,
    });
    expect(denied.status).toBe(401);
    expect(m.createFile).not.toHaveBeenCalled();
    expect(m.getFileDownload).not.toHaveBeenCalled();
  });

  it('rejects cleartext, unknown fields, invalid chunk ranges and incomplete intermediate chunks',async()=>{
    const m=storage();
    for(const bad of [
      {...sample,ciphertext:'private journal photo'},
      {...sample,ciphertext:'AA'},
      {...sample,ciphertext:'AAAA'},
      {...sample,ciphertext:'AAA_='},
      {...sample,ciphertext:Buffer.alloc(17,9).toString('base64url')},
      {...sample,chunks:193},
      {...sample,chunks:0},
      {...sample,chunkIndex:2},
      {...sample,mediaId:'plain-photo-id'},
      {...sample,keyId:'plain-key'},
      {...sample,plaintext:'do not expose'},
      {...sample,ciphertext:encoded+'AAAAAAAAAAAA'},
    ]) {
      expect((await request('media_put_chunk',bad,m)).status).toBe(400);
    }
    const badRead=await request('media_get_chunk',{
      mediaId,keyId,chunkIndex:0,chunks:1,plaintext:'secret',
    },m);
    expect(badRead.status).toBe(400);
    expect(m.createFile).not.toHaveBeenCalled();
    expect(m.getFileDownload).not.toHaveBeenCalled();
  });
});
