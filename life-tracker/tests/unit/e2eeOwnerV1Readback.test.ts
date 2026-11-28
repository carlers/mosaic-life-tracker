import {describe,expect,it} from 'vitest';
import {
  generateAccountRoot,generateKeyId,generateOpaqueRowId,
  generateRevision,encryptPrivateRecord,
} from '../../src/lib/e2ee/coreCrypto';
import {
  readVerifiedScratchOwnerV1,OWNER_V1_COLLECTIONS,OWNER_V1_SCRATCH_PROJECT,
  type OwnerV1Record,type OwnerV1Collection,
} from '../../src/lib/e2ee/ownerLegacyV1Readback';
import {openV2PrivateOwnerDocument} from '../../src/lib/e2ee/ownerPrivateV2Contract';
const owner={projectId:OWNER_V1_SCRATCH_PROJECT,ownerId:'synthetic_owner'};
const mapping:Record<OwnerV1Collection,string>={
  tasks:'task',categories:'category',diary:'diary',
  bucketList:'bucket-list',bucketTaskLinks:'bucket-task-link',settings:'settings-private',
};
const routing:Record<OwnerV1Collection,Record<string,string|number|boolean|null>>={
  tasks:{userId:owner.ownerId,date:'2042-03-05',visibility:'private',
    createdAt:'2042-03-05',updatedAt:'2042-03-05',reminderTime:'07:45',isDeleted:false},
  categories:{userId:owner.ownerId,visibility:'private',
    updatedAt:'2042-03-05',isDeleted:false},
  diary:{userId:owner.ownerId,date:'2042-03-05',visibility:'private',
    createdAt:'2042-03-05',updatedAt:'2042-03-05',isDeleted:true},
  bucketList:{userId:owner.ownerId,createdAt:'2042-03-05',updatedAt:'2042-03-05',isDeleted:false},
  bucketTaskLinks:{userId:owner.ownerId,createdAt:'2042-03-05',updatedAt:'2042-03-05',isDeleted:true},
  settings:{userId:owner.ownerId,updatedAt:'2042-03-05',isDeleted:false},
};
async function original(c:OwnerV1Collection){
  const root=generateAccountRoot(),scope={...owner,
    payloadDomain:mapping[c] as 'task',rowId:generateOpaqueRowId(),
    keyId:generateKeyId(),revision:generateRevision(),publicRouting:routing[c]};
  const secret={id:'historical_'+c,content:'SYNTHETIC HISTORICAL SECRET'};
  const envelope=await encryptPrivateRecord(root,scope,secret);
  const record:OwnerV1Record={
    projectId:owner.projectId,ownerId:owner.ownerId,rowId:scope.rowId,
    collection:c,domain:scope.payloadDomain,routing:routing[c],published:{},envelope,
  };
  return {root,scope,record,secret};
}
describe('historical six-domain Scratch owner v1 read-only compat',()=>{
  it('authenticates all six original routing layouts, without using the new privacy manifest',async()=>{
    for(const c of OWNER_V1_COLLECTIONS){
      const {root,record,secret}=await original(c);
      const result=await readVerifiedScratchOwnerV1(root,owner,record);
      expect(result).toMatchObject({...routing[c],...secret});
    }
  });
  it('supports original server GET wrapper and enforces routing-vs-deleted consistency',async()=>{
    const {root,record}=await original('diary');
    const server={...record,deleted:true,updatedAt:'2026-11-26T02:00:00Z'};
    expect(await readVerifiedScratchOwnerV1(root,owner,server)).toHaveProperty('isDeleted',true);
    await expect(readVerifiedScratchOwnerV1(root,owner,{...server,deleted:false})).rejects.toThrow();
  });
  it('rejects v1 metadata substitution, wrong owner/root and forbidden public disclosure',async()=>{
    const {root,record}=await original('tasks');
    const cases=[
      {...record,routing:{...record.routing,date:'2042-03-06'}},
      {...record,routing:{...record.routing,visibility:'public'}},
      {...record,routing:{...record.routing,visibility:'followers'}},
      {...record,routing:{...record.routing,privateNote:'plaintext'}},
      {...record,ownerId:'different'},
      {...record,projectId:'6ae94a2100014d01f5ed'},
      {...record,collection:'messages',domain:'chat-message'},
      {...record,published:{title:'plaintext'}},
      {...record,policy:'owner-private-v2',schemaVersion:2},
    ];
    for(const data of cases)await expect(readVerifiedScratchOwnerV1(root,owner,
      data as OwnerV1Record)).rejects.toThrow();
    await expect(readVerifiedScratchOwnerV1(generateAccountRoot(),owner,record))
      .rejects.toThrow();
    await expect(readVerifiedScratchOwnerV1(root,{...owner,ownerId:'another'},record))
      .rejects.toThrow();
  });
  it('never silently downgrades a v2 decoder to historical v1 without schema proof',async()=>{
    const {root,scope,record}=await original('tasks');
    await expect(openV2PrivateOwnerDocument(root,owner,scope,'tasks',
      record as unknown as Parameters<typeof openV2PrivateOwnerDocument>[4]))
      .rejects.toThrow();
  });
});
