import {describe,expect,it,vi} from 'vitest';
import {generateAccountRoot,generateKeyId} from '../../src/lib/e2ee/coreCrypto';
import {stageVerifiedScratchRescueOwnerV2} from '../../src/lib/e2ee/ownerRescueV2Staging';
import {SCRATCH_OWNER_V2_PROJECT} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import type {UnpackedOwnerLocalRescue} from '../../src/lib/e2ee/ownerLocalRescueBundle';
const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_rescue_owner'};
const raw={id:'synthetic_row',userId:owner.ownerId,isDeleted:false,
  _deleted:true,_rev:'2-synthetic',_meta:{lwt:1795665000000},_attachments:{},
  title:'PRIVATE TITLE',visibility:'private',date:'2045-06-01'};
const valid:UnpackedOwnerLocalRescue={rows:[
  {collection:'tasks',document:raw},
],media:[],pending:[]};
const mocks=vi.hoisted(()=>({
  list:vi.fn(),preflight:vi.fn(),stage:vi.fn(),
}));
vi.mock('../../src/lib/e2ee/ownerV2PendingIntentStore',()=>({
  listV2OwnerMigrationIntents:mocks.list,
}));
vi.mock('../../src/lib/e2ee/ownerRawV2MigrationPlan',()=>({
  prepareScratchRawOwnerToV2:mocks.preflight,
}));
vi.mock('../../src/lib/e2ee/ownerRawV2DurableIntent',()=>({
  prepareAndStageScratchRawOwnerV2:mocks.stage,
}));
describe('whole rescue staging gates reject incomplete protected data',()=>{
  it.each([
    {rows:[...valid.rows,{collection:'messages' as const,document:raw}]},
    {rows:[...valid.rows,{collection:'friendships' as const,document:raw}]},
    {media:[{localId:'orphan',createdAt:'today',blob:new Blob(['PRIVATE'])}]},
    {pending:[{queue:'social' as const,record:{id:'pending',userId:owner.ownerId}}]},
    {rows:[...valid.rows,{collection:'tasks' as const,document:raw}]},
  ])('blocks social/media/outbox/duplicate without local writes',async modification=>{
    mocks.list.mockReset();mocks.stage.mockReset();mocks.preflight.mockReset();
    await expect(stageVerifiedScratchRescueOwnerV2(
      generateAccountRoot(),owner,{...valid,...modification},
      generateKeyId(),1)).rejects.toThrow();
    expect(mocks.stage).not.toHaveBeenCalled();
  });
  it('never accepts foreign or invalid encrypted account identity',async()=>{
    mocks.stage.mockReset();
    await expect(stageVerifiedScratchRescueOwnerV2(
      generateAccountRoot(),{...owner,projectId:'another'},valid,
      generateKeyId(),1)).rejects.toThrow();
    expect(mocks.stage).not.toHaveBeenCalled();
  });
});
