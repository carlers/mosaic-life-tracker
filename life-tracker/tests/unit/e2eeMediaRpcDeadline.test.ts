import { describe, expect, it, vi } from 'vitest';

const send=vi.hoisted(()=>vi.fn(async()=>({ok:true})));
vi.mock('../../src/lib/appAction',()=>({sendAppAction:send}));
vi.mock('../../src/lib/appwriteConfig',()=>({
  APPWRITE_PROJECT_ID:'6b00671500279e901846',
  APPWRITE_ENDPOINT:'https://129-221-244-67.sslip.io/v1',
}));
import { createScratchOwnerRpc } from '../../src/lib/e2ee/ownerCiphertextTransport';

describe('isolated media Function RPC deadlines',()=>{
  it('extends only encrypted media actions, never ordinary owner data',async()=>{
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_owner'};
    const rpc=createScratchOwnerRpc(owner);
    await rpc.send('media_put_chunk',{chunkIndex:0});
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({
      action:'e2ee_owner_v1',operation:'media_put_chunk',
      ownerId:owner.ownerId,projectId:owner.projectId,
    }),28_000);
    await rpc.send('media_get_chunk',{chunkIndex:0});
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({operation:'media_get_chunk'}),28_000);
    await rpc.send('get',{collection:'tasks'});
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({operation:'get'}),15_000);
    expect(send).toHaveBeenCalledTimes(3);
  });
});
