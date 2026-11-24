import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock=vi.hoisted(()=>({ createRow:vi.fn(),createFile:vi.fn(),auth:vi.fn() }));
vi.mock('../../src/lib/sdk',()=>({
  scratchLegacyAclProbe:{createRow:mock.createRow,createFile:mock.createFile},
}));
vi.mock('../../src/lib/appwriteConfig',()=>({
  APPWRITE_PROJECT_ID:'6b00671500279e901846',
  APPWRITE_ENDPOINT:'https://129-221-244-67.sslip.io/v1',
}));
import { probeLegacyDirectWriters } from '../../src/lib/e2ee/legacyDirectWriterProbe';

const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_owner'};
const gate={assertReady:mock.auth};
const denial=(code:number)=>Object.assign(new Error('PRIVATE raw Appwrite response'),{code});

describe('isolated M2 old direct browser SDK writer denial (synthetic only)',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mock.auth.mockResolvedValue(undefined);
    mock.createRow.mockRejectedValue(denial(403));
    mock.createFile.mockRejectedValue(denial(401));
  });

  it('requires explicit owner Scratch identity before ANY network call',async()=>{
    for(const projectId of [
      '6ae94a2100014d01f5ed','6ae9599c002ab812f9c3','',undefined,
    ]) {
      const value=await probeLegacyDirectWriters(
        {...owner,projectId:projectId as string},gate);
      expect(value.outcome).toBe('inconclusive');
    }
    expect(mock.createRow).not.toHaveBeenCalled();
    expect(mock.createFile).not.toHaveBeenCalled();
    expect(mock.auth).not.toHaveBeenCalled();
  });

  it('reports 7/7 only after all six valid private row shapes and old bucket reject 401/403',async()=>{
    const value=await probeLegacyDirectWriters(owner,gate);
    expect(value).toEqual({outcome:'denied',checked:7,total:7,target:null,status:null});
    const requests=mock.createRow.mock.calls.map(([x])=>x);
    expect(requests.map(x=>x.tableId)).toEqual([
      'tasks','categories','diary','settings','bucket_list_items','bucket_task_links',
    ]);
    for(const x of requests){
      expect(x.databaseId).toBe('life_tracker');
      expect(x.data.user_id).toBe(owner.ownerId);
      expect(x.rowId).toMatch(/^m2canary_[a-f0-9]{24}$/);
      expect(x.permissions).toEqual([]);
    }
    expect(mock.createFile).toHaveBeenCalledOnce();
    expect(mock.createFile.mock.calls[0][0]).toMatchObject({
      bucketId:'task_images',permissions:[],
      fileId:expect.stringMatching(/^m2canary_[a-f0-9]{24}$/),
    });
    expect(mock.auth).toHaveBeenCalledTimes(7);
  });

  it('halts immediately on a successful forbidden row create',async()=>{
    mock.createRow.mockResolvedValueOnce({$id:'unexpected'});
    expect(await probeLegacyDirectWriters(owner,gate)).toMatchObject({
      outcome:'unsafe',checked:0,target:'tasks',status:null,
    });
    expect(mock.createRow).toHaveBeenCalledOnce();
    expect(mock.createFile).not.toHaveBeenCalled();
  });

  it('does not mistake 400,409,500 or offline for a permission-denial pass',async()=>{
    for(const code of [400,409,500]){
      vi.clearAllMocks();
      mock.auth.mockResolvedValue(undefined);
      mock.createRow.mockRejectedValueOnce(denial(code));
      const value=await probeLegacyDirectWriters(owner,gate);
      expect(value).toMatchObject({
        outcome:'inconclusive',target:'tasks',checked:0,status:code,
      });
      expect(mock.createFile).not.toHaveBeenCalled();
    }
    vi.clearAllMocks();
    mock.auth.mockResolvedValue(undefined);
    mock.createRow.mockRejectedValueOnce(new Error('NETWORK WITH PRIVATE DATA'));
    expect(await probeLegacyDirectWriters(owner,gate)).toMatchObject({
      outcome:'inconclusive',target:'tasks',checked:0,status:null,
    });
  });

  it('fails closed on last bucket success or ambiguous failure, never treating it as 7/7',async()=>{
    mock.createFile.mockResolvedValueOnce({$id:'unexpected'});
    expect(await probeLegacyDirectWriters(owner,gate)).toMatchObject({
      outcome:'unsafe',target:'task_images',checked:6,
    });
    vi.clearAllMocks();
    mock.auth.mockResolvedValue(undefined);
    mock.createRow.mockRejectedValue(denial(401));
    mock.createFile.mockRejectedValueOnce(denial(422));
    expect(await probeLegacyDirectWriters(owner,gate)).toMatchObject({
      outcome:'inconclusive',target:'task_images',checked:6,status:422,
    });
  });

  it('stops before a direct SDK request if the owner auth gate fails',async()=>{
    mock.auth.mockRejectedValueOnce(new Error('synthetic MFA not ready'));
    await expect(probeLegacyDirectWriters(owner,gate))
      .rejects.toThrow('synthetic MFA not ready');
    expect(mock.createRow).not.toHaveBeenCalled();
    expect(mock.createFile).not.toHaveBeenCalled();
  });
});
