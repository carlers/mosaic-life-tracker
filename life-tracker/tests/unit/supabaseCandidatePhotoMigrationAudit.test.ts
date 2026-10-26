import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { FrozenPersonalSnapshot, FrozenPersonalRow } from '../../supabase-poc/appwritePersonalSourceRead';
import type { AppwriteHistoryReadback } from '../../supabase-poc/appwriteOwnerHistoryRead';
import {
  verifyHistoricalOwnerPhotoCoverage, type OriginalMediaObject,
  type RestoredMediaObject,
} from '../../supabase-poc/candidatePhotoMigrationAudit';
import { joinFrozenAppwriteOwnerSources } from '../../supabase-poc/appwriteFrozenPersonalJoin';

const id = {
  legacyUserId: 'source_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const when = '2026-10-26T00:00:00Z';
const deployment = 'https://sgp.cloud.appwrite.io/v1|project|database|cloud';
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
function rowHash(rows: readonly unknown[]) {
  const h = createHash('sha256');
  for (const row of rows) {
    const s = JSON.stringify(row);
    h.update(Buffer.byteLength(s,'utf8').toString(10) + ':');
    h.update(s,'utf8');
  }
  return h.digest('hex');
}
const row = (rowId:string,columns:FrozenPersonalRow['columns'],isDeleted=false):
    FrozenPersonalRow => ({
  id:rowId, userId:id.legacyUserId, isDeleted, columns,
  serverCreatedAt:when,serverUpdatedAt:when,originalPermissions:[],
});
const taskHistory = [
  {id:'task_1',userId:id.legacyUserId,isDeleted:false},
  {id:'task_2',userId:id.legacyUserId,isDeleted:true},
];
const bucket = {id:'goal_1',userId:id.legacyUserId,isDeleted:false,title:'Dream',
  description:'',achieved:false,achievedAt:'',createdAt:when,updatedAt:when};
const link = {id:'link_1',userId:id.legacyUserId,isDeleted:false,
  taskId:'task_1',bucketListId:'goal_1',createdAt:when,updatedAt:when};
const digest = (s:string) => createHash('sha256').update(s).digest('hex');
function fixture() {
  const rows: FrozenPersonalSnapshot['rows'] = {
    tasks: [
      row('task_1',{ title:'Morning', image:'photo_task' }),
      row('task_2',{ title:'Old', image:null },true),
    ],
    categories:[row('cat_1',{name:'Private'})],
    diary:[row('diary_1',{date:'2026-10-26',
      photos:'["photo_diary","photo_task"]'},true)],
    settings:[row('pref_1',{key:'profileImageId',value:'orphan_blob'})],
  };
  const fingerprintSha256 = {
    tasks:rowHash(rows.tasks),categories:rowHash(rows.categories),
    diary:rowHash(rows.diary),settings:rowHash(rows.settings),
  };
  const originalOwnerCounts={tasks:2,categories:1,diary:1,settings:1};
  const sourceOwnerCounts={tasks:2,buckets:1,links:1};
  const personal:FrozenPersonalSnapshot={
    identity:{...id},sourceDeploymentId:deployment,leaseId:'frozen_1',
    generation:'epoch_1',originalOwnerCounts,sourceOwnerCounts,
    fingerprintSha256,rows,completeSourceArchive:false,providerCutoverEligible:false,
    scanSha256:hash({deployment,owner:id.legacyUserId,generation:'epoch_1',
      originalOwnerCounts,sourceOwnerCounts,fingerprintSha256}),
  };
  const history:AppwriteHistoryReadback={
    owner:{...id},sourceDeploymentId:deployment,leaseId:'frozen_1',
    generation:'epoch_1',tasks:structuredClone(taskHistory),
    buckets:[{...bucket}],links:[{...link}],
    expectedCounts:{tasks:2,buckets:1,links:1},
    fingerprints:{tasks:rowHash(taskHistory),buckets:rowHash([bucket]),links:rowHash([link])},
  };
  const originalStorage:OriginalMediaObject[]=[
    {ownerLegacyId:id.legacyUserId,fileId:'photo_task',bytes:8,sha256:digest('task')},
    {ownerLegacyId:id.legacyUserId,fileId:'photo_diary',bytes:9,sha256:digest('diary')},
    {ownerLegacyId:id.legacyUserId,fileId:'orphan_blob',bytes:10,sha256:digest('orphan')},
  ];
  const restoredStorage:RestoredMediaObject[]=originalStorage.map(o=>({
    path:id.supabaseUserId+'/'+o.fileId+'.webp',bytes:o.bytes,sha256:o.sha256,
  }));
  const sortId = <T>(items:T[],key:(x:T)=>string):T[] =>
    [...items].sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
  const originalManifest = () => hash(sortId(originalStorage,x=>x.fileId));
  const restoredManifest = () => hash(sortId(restoredStorage,x=>x.path));
  const run = () => verifyHistoricalOwnerPhotoCoverage({
    personal,history,
    expectedSevenDomainScanSha256:joinFrozenAppwriteOwnerSources({personal,history}).sevenDomainScanSha256,
    originalStorage,originalStorageCount:originalStorage.length,
    originalStorageManifestSha256:originalManifest(),
    restoredStorage,restoredStorageCount:restoredStorage.length,
    restoredStorageManifestSha256:restoredManifest(),
  });
  return {personal,history,originalStorage,restoredStorage,run,
    originalManifest,restoredManifest};
}
describe('complete owner task/Diary source photo refs vs Storage byte archives',()=>{
  it('preserves duplicate usages, deleted Diary refs, and orphan original files',()=>{
    const x=fixture(),proof=x.run();
    expect(proof).toMatchObject({
      referenceOccurrences:3,uniqueReferencedObjects:2,
      preservedSourceObjects:3,byteMatchedRestoredObjects:3,
      sourceObjectsWithoutReferences:1,unresolvedMissingReferences:0,
      unresolvedUnrepresentableReferences:0,unrepresentableSourceObjects:0,
      ownerMediaReferencesFullyRecovered:true,
      fullEncryptedSourceAuthenticated:false,providerCutoverEligible:false,
    });
    expect(proof.originalStorageManifestSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('does not misreport a referenced source-missing photo as recovered',()=>{
    const x=fixture();
    x.originalStorage.splice(1,1);
    x.restoredStorage.splice(1,1);
    expect(x.run()).toMatchObject({
      unresolvedMissingReferences:1,ownerMediaReferencesFullyRecovered:false,
    });
  });
  it('quarantines unrepresentable old photo IDs without shortening/relabeling them',()=>{
    const x=fixture(),long='l'.repeat(70);
    x.personal.rows.tasks[0].columns.image=long;
    x.personal.fingerprintSha256.tasks=rowHash(x.personal.rows.tasks);
    x.personal.scanSha256=hash({
      deployment,owner:id.legacyUserId,generation:'epoch_1',
      originalOwnerCounts:x.personal.originalOwnerCounts,
      sourceOwnerCounts:x.personal.sourceOwnerCounts,
      fingerprintSha256:x.personal.fingerprintSha256,
    });
    x.originalStorage.push({ownerLegacyId:id.legacyUserId,fileId:long,
      bytes:5,sha256:digest('legacy')});
    expect(x.run()).toMatchObject({
      unrepresentableSourceObjects:1,unresolvedUnrepresentableReferences:1,
      unresolvedMissingReferences:0,ownerMediaReferencesFullyRecovered:false,
    });
    expect(x.restoredStorage).toHaveLength(3);
    expect(x.personal.rows.tasks[0].columns.image).toBe(long);
  });
  it('rejects missing, added or byte-changed restored private objects',()=>{
    const missing=fixture();missing.restoredStorage.pop();
    expect(()=>missing.run()).toThrow(/Missing or changed/);
    const extra=fixture();extra.restoredStorage.push({
      path:id.supabaseUserId+'/extra.webp',bytes:5,sha256:digest('extra'),
    });
    expect(()=>extra.run()).toThrow(/Extra/);
    const changed=fixture();changed.restoredStorage[0].sha256=digest('tampered');
    expect(()=>changed.run()).toThrow(/Missing or changed/);
  });
  it('rejects wrong owner source or target path and duplicate file IDs',()=>{
    const a=fixture();a.originalStorage[0].ownerLegacyId='another';
    expect(()=>a.run()).toThrow(/Foreign/);
    const b=fixture();b.restoredStorage[0].path='22222222-2222-4222-8222-222222222222/photo_task.webp';
    expect(()=>b.run()).toThrow(/Foreign owner/);
    const c=fixture();c.originalStorage.push({...c.originalStorage[0]});
    expect(()=>c.run()).toThrow(/duplicate/i);
    const d=fixture();d.restoredStorage.push({...d.restoredStorage[0]});
    expect(()=>d.run()).toThrow(/Duplicate/);
  });
  it('rejects original or restored signed manifest digests/count drift',()=>{
    const x=fixture();
    expect(()=>verifyHistoricalOwnerPhotoCoverage({
      personal:x.personal,history:x.history,
      expectedSevenDomainScanSha256:joinFrozenAppwriteOwnerSources(x).sevenDomainScanSha256,
      originalStorage:x.originalStorage,originalStorageCount:2,
      originalStorageManifestSha256:x.originalManifest(),
      restoredStorage:x.restoredStorage,restoredStorageCount:3,
      restoredStorageManifestSha256:x.restoredManifest(),
    })).toThrow(/inventory count/);
    const y=fixture();
    y.originalStorage[0].sha256=digest('tamper');
    expect(()=>verifyHistoricalOwnerPhotoCoverage({
      personal:y.personal,history:y.history,
      expectedSevenDomainScanSha256:joinFrozenAppwriteOwnerSources(y).sevenDomainScanSha256,
      originalStorage:y.originalStorage,originalStorageCount:3,
      originalStorageManifestSha256:'0'.repeat(64),
      restoredStorage:y.restoredStorage,restoredStorageCount:3,
      restoredStorageManifestSha256:y.restoredManifest(),
    })).toThrow(/separately pinned source manifest/);
  });
  it('rejects changed task/Diary references after the frozen seven-domain scan',()=>{
    const x=fixture();x.personal.rows.tasks[0].columns.image='altered';
    expect(()=>x.run()).toThrow(/content changed after signed readback/);
    const y=fixture();y.personal.rows.diary[0].columns.photos='[]';
    expect(()=>y.run()).toThrow(/content changed after signed readback/);
  });
  it('rejects malformed Diary JSON, duplicate IDs and extra historical arrays',()=>{
    for(const photos of ['not-json','["photo_task","photo_task"]',
      '["a","b","c","d","e","f"]','{"photos":["photo_task"]}']) {
      const x=fixture();x.personal.rows.diary[0].columns.photos=photos;
      x.personal.fingerprintSha256.diary=rowHash(x.personal.rows.diary);
      x.personal.scanSha256=hash({
        deployment,owner:id.legacyUserId,generation:'epoch_1',
        originalOwnerCounts:x.personal.originalOwnerCounts,
        sourceOwnerCounts:x.personal.sourceOwnerCounts,
        fingerprintSha256:x.personal.fingerprintSha256,
      });
      expect(()=>x.run()).toThrow(/historical Diary photo/);
    }
  });
  it('refuses changed source owner, lease or seven-domain proof',()=>{
    const x=fixture();x.history.owner.legacyUserId='foreign';
    expect(()=>x.run()).toThrow(/identity mapping/);
    const y=fixture();y.history.generation='mismatch';
    expect(()=>y.run()).toThrow(/frozen lease mismatch/);
  });
});
