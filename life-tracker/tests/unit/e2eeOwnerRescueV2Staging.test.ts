import {describe,expect,it,vi} from 'vitest';
import {generateAccountRoot,generateKeyId,deriveMigratedOwnerRowId} from '../../src/lib/e2ee/coreCrypto';
import {stageAuthenticatedScratchRescueFileV2} from '../../src/lib/e2ee/ownerRescueV2Staging';
import {SCRATCH_OWNER_V2_PROJECT,V2_OWNER_DOMAIN} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import type {UnpackedOwnerLocalRescue} from '../../src/lib/e2ee/ownerLocalRescueBundle';
const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_rescue_owner'};
const raw={id:'synthetic_row',userId:owner.ownerId,isDeleted:false,
  _deleted:true,_rev:'2-synthetic',_meta:{lwt:1795665000000},_attachments:{},
  title:'PRIVATE TITLE',visibility:'private',date:'2045-06-01'};
const valid:UnpackedOwnerLocalRescue={rows:[
  {collection:'tasks',document:raw},
],media:[],pending:[]};
const mocks=vi.hoisted(()=>({
  list:vi.fn(),preflight:vi.fn(),atomic:vi.fn(),unpack:vi.fn(),compatible:vi.fn(),
}));
vi.mock('../../src/lib/e2ee/ownerLocalRescueBundle',()=>({
  unpackVerifiedOwnerLocalRescueFile:mocks.unpack,
}));
vi.mock('../../src/lib/e2ee/ownerV2PendingIntentStore',()=>({
  listV2OwnerMigrationIntents:mocks.list,
  stageV2OwnerMigrationIntentsAtomic:mocks.atomic,
}));
vi.mock('../../src/lib/e2ee/ownerRawV2MigrationPlan',()=>({
  prepareScratchRawOwnerToV2:mocks.preflight,
}));
vi.mock('../../src/lib/e2ee/ownerRawV2DurableIntent',()=>({
  assertCompatibleScratchRawOwnerV2Intent:mocks.compatible,
}));
const saved={size:2,text:async()=>'{}'};
describe('whole rescue staging gates reject incomplete protected data',()=>{
  it.each([
    {rows:[...valid.rows,{collection:'messages' as const,document:raw}]},
    {rows:[...valid.rows,{collection:'friendships' as const,document:raw}]},
    {media:[{localId:'orphan',createdAt:'today',blob:new Blob(['PRIVATE'])}]},
    {pending:[{queue:'social' as const,record:{id:'pending',userId:owner.ownerId}}]},
    {rows:[...valid.rows,{collection:'tasks' as const,document:raw}]},
  ])('blocks social/media/outbox/duplicate without local writes',async modification=>{
    mocks.list.mockReset();mocks.atomic.mockReset();mocks.preflight.mockReset();
    mocks.unpack.mockReset().mockResolvedValue({...valid,...modification});
    await expect(stageAuthenticatedScratchRescueFileV2(
      generateAccountRoot(),owner,saved,
      generateKeyId(),1)).rejects.toThrow();
    expect(mocks.atomic).not.toHaveBeenCalled();
  });
  it('never accepts foreign or invalid encrypted account identity',async()=>{
    mocks.atomic.mockReset();mocks.unpack.mockReset();
    await expect(stageAuthenticatedScratchRescueFileV2(
      generateAccountRoot(),{...owner,projectId:'another'},saved,
      generateKeyId(),1)).rejects.toThrow();
    expect(mocks.unpack).not.toHaveBeenCalled();
    expect(mocks.atomic).not.toHaveBeenCalled();
  });
  it('never stages if saved-file authenticity verification fails',async()=>{
    mocks.atomic.mockReset();
    mocks.unpack.mockReset().mockRejectedValue(new Error('Invalid saved-file AEAD'));
    await expect(stageAuthenticatedScratchRescueFileV2(
      generateAccountRoot(),owner,saved,generateKeyId(),1)).rejects.toThrow();
    expect(mocks.atomic).not.toHaveBeenCalled();
  });
  it('passes all authenticated proposals to a single atomic store commit',async()=>{
    const root=generateAccountRoot(),kid=generateKeyId();
    const expectedId=await deriveMigratedOwnerRowId(
      root,owner,V2_OWNER_DOMAIN.tasks,raw.id);
    const fake={rowId:expectedId};
    mocks.atomic.mockReset().mockResolvedValue({
      plans:[fake],stored:1,reused:0,
    });
    mocks.unpack.mockReset().mockResolvedValue(valid);
    mocks.list.mockReset().mockResolvedValue([]);
    mocks.preflight.mockReset().mockResolvedValue(fake);
    await expect(stageAuthenticatedScratchRescueFileV2(
      root,owner,saved,kid,1)).resolves.toMatchObject({stored:1});
    expect(mocks.atomic).toHaveBeenCalledTimes(1);
    expect(mocks.atomic.mock.calls[0][2]).toEqual([fake]);
    expect(mocks.atomic.mock.calls[0][3]).toEqual([]);
  });
  it('preflights old encrypted row conflicts before any new pending intent',async()=>{
    const root=generateAccountRoot(),kid=generateKeyId();
    const newRow={...raw,id:'synthetic_new_task',_deleted:false};
    const oldId=await deriveMigratedOwnerRowId(
      root,owner,V2_OWNER_DOMAIN.tasks,raw.id);
    const newId=await deriveMigratedOwnerRowId(
      root,owner,V2_OWNER_DOMAIN.tasks,newRow.id);
    mocks.atomic.mockReset();mocks.compatible.mockReset();
    mocks.unpack.mockReset().mockResolvedValue({
      ...valid,rows:[{collection:'tasks',document:newRow},...valid.rows],
    });
    mocks.list.mockReset().mockResolvedValue([{rowId:oldId}]);
    mocks.preflight.mockReset().mockImplementation(async(
      _root:unknown,_scope:unknown,_collection:unknown,
      document:Record<string,unknown>,
    )=>({rowId:document.id===raw.id?oldId:newId}));
    mocks.compatible.mockRejectedValue(new Error('Existing encrypted row differs'));
    await expect(stageAuthenticatedScratchRescueFileV2(
      root,owner,saved,kid,1)).rejects.toThrow('Existing encrypted row differs');
    expect(mocks.compatible).toHaveBeenCalledTimes(1);
    expect(mocks.atomic).not.toHaveBeenCalled();
  });
});
