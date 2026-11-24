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
    // An unreadable existing chunk is unresolved, not a proven collision.
    expect(await request('media_put_chunk',sample,m)).toMatchObject({
      status:503,body:{reason:'storage_readback_unavailable'},
    });
  });

  it('never acknowledges a write without matching authoritative ciphertext readback',async()=>{
    const m=storage(Buffer.alloc(65552,91));
    expect((await request('media_put_chunk',sample,m)).status).toBe(409);
    vi.mocked(m.getFileDownload!).mockRejectedValue(new Error('readback network loss'));
    expect((await request('media_put_chunk',sample,m)).status).toBe(503);
    vi.mocked(m.createFile!).mockRejectedValue(new Error('storage down'));
    vi.mocked(m.getFileDownload!).mockRejectedValueOnce(new Error('missing file'));
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
  it('classifies native Storage upload failures without exposing exception details',async()=>{
    const m=storage();
    for(const [code,reason,status] of [
      [403,'storage_write_forbidden',503],
      [404,'storage_bucket_missing',503],
      [413,'storage_size_rejected',413],
      [429,'storage_rate_limited',503],
      [400,'storage_request_rejected',503],
      [500,'storage_service_unavailable',503],
    ] as const) {
      vi.mocked(m.createFile!).mockRejectedValueOnce(
        Object.assign(new Error('SECRET storage account/key'),{code}));
      const response=await request('media_put_chunk',sample,m);
      expect(response.status).toBe(status);
      expect(response.body.reason).toBe(reason);
      expect(JSON.stringify(response.body)).not.toContain('SECRET');
    }
    vi.mocked(m.createFile!).mockRejectedValueOnce(new Error('SECRET unknown'));
    vi.mocked(m.getFileDownload!).mockRejectedValueOnce(new Error('missing file'));
    const unknown=await request('media_put_chunk',sample,m);
    expect(unknown).toMatchObject({status:503,
      body:{reason:'storage_write_unknown'}});
    expect(JSON.stringify(unknown.body)).not.toContain('SECRET');
  });

  it('allows only fixed native rejection types, never the raw exception',async()=>{
    const m=storage();
    for(const [type,reason] of [
      ['general_argument_invalid','storage_request_argument'],
      ['storage_file_empty','storage_request_empty'],
      ['storage_file_type_unsupported','storage_request_extension'],
      ['storage_invalid_file_size','storage_request_size'],
      ['storage_invalid_content_range','storage_request_range'],
      ['storage_invalid_appwrite_id','storage_request_id'],
      ['storage_device_not_found','storage_request_device'],
      ['SECRET unknown','storage_request_rejected'],
      ['constructor','storage_request_rejected'],
    ] as const) {
      vi.mocked(m.createFile!).mockRejectedValueOnce(Object.assign(new Error('SECRET raw details'),{code:400,type}));
      const response=await request('media_put_chunk',sample,m);
      expect(response).toMatchObject({status:503,body:{reason}});
      expect(JSON.stringify(response.body)).not.toContain('SECRET');
    }
    expect(m.getFileDownload).not.toHaveBeenCalled();
  });

  it('bounds a stalled exact-ID read after an ambiguous transport failure',async()=>{
    const m=storage();
    vi.mocked(m.createFile!).mockRejectedValueOnce(
      Object.assign(new TypeError('fetch failed'),{
        cause:Object.assign(new Error('SECRET transport'),{code:'UND_ERR_SOCKET'}),
      }));
    vi.mocked(m.getFileDownload!).mockImplementationOnce(
      ()=>new Promise(()=>{}));
    const start=Date.now();
    const response=await request('media_put_chunk',sample,m);
    expect(response).toMatchObject({status:503,body:{reason:'storage_transport_reset'}});
    expect(Date.now()-start).toBeLessThan(2500);
    expect(JSON.stringify(response.body)).not.toContain('SECRET');
    expect(m.createFile).toHaveBeenCalledOnce();
  });

  it('classifies blocked redirects and does not reveal location or keys',async()=>{
    const m=storage();
    vi.mocked(m.createFile!).mockRejectedValueOnce(Object.assign(
      new TypeError('fetch failed'),{cause:{code:'MOSAIC_STORAGE_REDIRECT_BLOCKED'}}));
    vi.mocked(m.getFileDownload!).mockRejectedValueOnce(new Error('absent'));
    const response=await request('media_put_chunk',sample,m);
    expect(response).toMatchObject({status:503,body:{reason:'storage_transport_redirect_blocked'}});
    expect(JSON.stringify(response.body)).not.toContain('http');
  });

  it('classifies nested network failures without exposing raw endpoint or error text',async()=>{
    const m=storage();
    for(const [code,reason] of [
      ['ENETUNREACH','storage_transport_unreachable'],
      ['ECONNREFUSED','storage_transport_refused'],
      ['UND_ERR_CONNECT_TIMEOUT','storage_transport_timeout'],
    ] as const) {
      vi.mocked(m.createFile!).mockRejectedValueOnce(Object.assign(
        new TypeError('fetch failed'),{
          cause:new AggregateError([
            Object.assign(new Error('PRIVATE endpoint and credentials'),{code}),
          ],'SECRET networking context'),
        }));
      vi.mocked(m.getFileDownload!).mockRejectedValueOnce(new Error('not found'));
      const response=await request('media_put_chunk',sample,m);
      expect(response).toMatchObject({status:503,body:{reason}});
      expect(JSON.stringify(response.body)).not.toContain('SECRET');
      expect(JSON.stringify(response.body)).not.toContain('PRIVATE');
    }
  });

  it('reconciles a lost SDK ACK by independently reading the identical ciphertext',async()=>{
    const m=storage();
    vi.mocked(m.createFile!).mockRejectedValue(new TypeError('fetch failed'));
    const response=await request('media_put_chunk',sample,m);
    expect(response).toMatchObject({status:200,body:{status:'duplicate'}});
    expect(m.createFile).toHaveBeenCalledTimes(1);
    expect(m.getFileDownload).toHaveBeenCalledOnce();
    vi.mocked(m.getFileDownload!).mockResolvedValue(Buffer.alloc(65552,19));
    const mismatch=await request('media_put_chunk',sample,m);
    expect(mismatch.status).toBe(409);
  });

  it('classifies no-HTTP SDK transport errors without exposing causes or secrets',async()=>{
    const cases=[
      ['ENOTFOUND','storage_transport_dns'],
      ['EAI_AGAIN','storage_transport_dns'],
      ['ECONNREFUSED','storage_transport_refused'],
      ['ETIMEDOUT','storage_transport_timeout'],
      ['UND_ERR_CONNECT_TIMEOUT','storage_transport_timeout'],
      ['ECONNRESET','storage_transport_reset'],
      ['UND_ERR_SOCKET','storage_transport_reset'],
      ['ERR_TLS_CERT_ALTNAME_INVALID','storage_transport_tls'],
      ['UND_ERR_REQ_CONTENT_LENGTH_MISMATCH','storage_transport_payload'],
    ] as const;
    for(const [native,expected] of cases) {
      const m=storage();
      vi.mocked(m.createFile!).mockRejectedValueOnce(
        Object.assign(new TypeError('fetch failed'),{
          cause:Object.assign(new Error('SECRET account session'),{code:native}),
        }));
      vi.mocked(m.getFileDownload!).mockRejectedValueOnce(
        Object.assign(new Error('not found'),{code:404}));
      const result=await request('media_put_chunk',sample,m);
      expect(result).toMatchObject({status:503,body:{reason:expected}});
      expect(JSON.stringify(result.body)).not.toContain('SECRET');
      expect(JSON.stringify(result.body)).not.toContain(native);
    }
    const m=storage();
    vi.mocked(m.createFile!).mockRejectedValueOnce(new TypeError('fetch failed'));
    vi.mocked(m.getFileDownload!).mockRejectedValueOnce(new Error('not found'));
    expect(await request('media_put_chunk',sample,m)).toMatchObject({
      status:503,body:{reason:'storage_transport_unknown'},
    });
    vi.mocked(m.createFile!).mockRejectedValueOnce(new Error('File not found in payload'));
    vi.mocked(m.getFileDownload!).mockRejectedValueOnce(new Error('missing file'));
    expect(await request('media_put_chunk',sample,m)).toMatchObject({
      status:503,body:{reason:'storage_sdk_input'},
    });
  });

  it('retries a transient Storage write only once with identical ciphertext and file ID',async()=>{
    const m=storage();
    vi.mocked(m.createFile!).mockRejectedValueOnce(
      Object.assign(new Error('temporary'),{code:503}));
    const response=await request('media_put_chunk',sample,m);
    expect(response).toMatchObject({status:200,body:{status:'created'}});
    expect(m.createFile).toHaveBeenCalledTimes(2);
    const [first,second]=vi.mocked(m.createFile!).mock.calls;
    expect(first[0].fileId).toBe(second[0].fileId);
    expect(first[0].bucketId).toBe(second[0].bucketId);
    expect(first[0].permissions).toEqual([]);
    expect(second[0].permissions).toEqual([]);
    // If the first response was lost after a commit, retry receives 409.
    const lost=storage();
    vi.mocked(lost.createFile!).mockRejectedValueOnce(
      Object.assign(new Error('lost response'),{code:503}));
    vi.mocked(lost.createFile!).mockRejectedValueOnce(
      Object.assign(new Error('already exists'),{code:409}));
    const duplicate=await request('media_put_chunk',sample,lost);
    expect(duplicate).toMatchObject({status:200,body:{status:'duplicate'}});
    expect(lost.getFileDownload).toHaveBeenCalledOnce();
    const persistent=storage();
    vi.mocked(persistent.createFile!).mockRejectedValue(
      Object.assign(new Error('storage unavailable'),{code:503}));
    expect(await request('media_put_chunk',sample,persistent)).toMatchObject({
      status:503,body:{reason:'storage_service_unavailable'}});
    expect(persistent.createFile).toHaveBeenCalledTimes(2);
  });

});
