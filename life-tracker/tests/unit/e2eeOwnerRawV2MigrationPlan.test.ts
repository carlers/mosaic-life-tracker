import {describe,expect,it} from 'vitest';
import {
  generateAccountRoot,generateKeyId,generateRevision,
} from '../../src/lib/e2ee/coreCrypto';
import {prepareScratchRawOwnerToV2} from '../../src/lib/e2ee/ownerRawV2MigrationPlan';
import {
  openV2PrivateOwnerDocument,V2_OWNER_DOMAIN,
  SCRATCH_OWNER_V2_PROJECT,type OwnerV2Collection,
} from '../../src/lib/e2ee/ownerPrivateV2Contract';

const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_raw_owner'};
const root=()=>generateAccountRoot();
const raw=(doc:Record<string,unknown>,deleted=false)=>({
  ...doc,userId:owner.ownerId,isDeleted:false,
  _deleted:deleted,_rev:'3-synthetic-local-revision',
  _meta:{lwt:1795663000000},_attachments:{},
});
const cases:readonly [OwnerV2Collection,Record<string,unknown>][]=[
  ['tasks',{id:'synthetic_task',title:'VERY PRIVATE TASK',date:'2045-04-19',
    visibility:'private',reminderTime:'04:29'}],
  ['categories',{id:'synthetic_category',name:'VERY PRIVATE CATEGORY',
    visibility:'private'}],
  ['diary',{id:'synthetic_diary',content:'VERY PRIVATE DIARY',date:'2045-04-19',
    visibility:'private'}],
  ['bucketList',{id:'synthetic_bucket',title:'VERY PRIVATE WISH'}],
  ['bucketTaskLinks',{id:'synthetic_bucket_link',taskId:'private_task',
    bucketListId:'private_bucket'}],
  ['settings',{id:'synthetic_setting',key:'PRIVATE_KEY',value:'PRIVATE_VALUE'}],
  ['activities',{id:'synthetic_activity',title:'VERY PRIVATE WORKOUT',
    localDate:'2045-04-19',distanceMeters:1134}],
  ['activityTaskLinks',{id:'synthetic_activity_link',
    activityId:'private_activity',taskId:'private_task'}],
];
async function open(rootKey:ReturnType<typeof root>,
  collection:OwnerV2Collection,plan:Awaited<ReturnType<typeof prepareScratchRawOwnerToV2>>){
  const context={...owner,rowId:plan.rowId,keyId:plan.record.envelope.kid,
    revision:plan.record.envelope.revision,
    payloadDomain:V2_OWNER_DOMAIN[collection]};
  return openV2PrivateOwnerDocument(rootKey,owner,context,collection,plan.record);
}
describe('dormant raw RxDB owner to v2 ciphertext migration plan',()=>{
  it.each(cases)('authenticates %s content without plaintext routing',async(collection,doc)=>{
    const key=root(),kid=generateKeyId();
    const intent=await prepareScratchRawOwnerToV2(key,owner,collection,raw(doc),kid,1);
    expect(intent.projectId).toBe(SCRATCH_OWNER_V2_PROJECT);
    expect(intent.collection).toBe(collection);
    expect(intent.expectedRevision).toBeNull();
    expect(intent.expectedGeneration).toBe(1);
    expect(intent.opId).toMatch(/^o_[a-f0-9]{32}$/);
    expect(intent.rowId).toMatch(/^p_[a-f0-9]{32}$/);
    const opened=await open(key,collection,intent);
    expect(opened).toEqual({...doc,userId:owner.ownerId,isDeleted:false});
    const publicBytes=JSON.stringify(intent);
    expect(publicBytes).not.toContain(String(doc.id));
    for(const word of Object.values(doc).filter(v=>typeof v==='string'&&v!=='private'))
      expect(publicBytes).not.toContain(word);
    expect(publicBytes).not.toContain('_rev');
    expect(publicBytes).not.toContain('_meta');
    expect(publicBytes).not.toContain('_deleted');
  });
  it('preserves physically removed RxDB rows as encrypted v2 tombstones',async()=>{
    const key=root(),kid=generateKeyId();
    const doc=raw({id:'physical_tombstone',title:'DO NOT REVIVE',
      date:'2045-04-19',visibility:'private'},true);
    const plan=await prepareScratchRawOwnerToV2(key,owner,'tasks',doc,kid,3);
    expect(plan.record.routing.isDeleted).toBe(true);
    const opened=await open(key,'tasks',plan);
    expect(opened.isDeleted).toBe(true);
    expect(opened.title).toBe('DO NOT REVIVE');
    expect(JSON.stringify(plan)).not.toContain('physical_tombstone');
    expect(JSON.stringify(plan)).not.toContain('DO NOT REVIVE');
    expect(JSON.stringify(plan)).not.toContain('2045-04-19');
  });
  it('derives stable opaque owner identity but never regenerates a pending operation as a retry',async()=>{
    const key=root(),kid=generateKeyId(),doc=raw(cases[0][1]);
    const one=await prepareScratchRawOwnerToV2(key,owner,'tasks',doc,kid,1);
    const two=await prepareScratchRawOwnerToV2(key,owner,'tasks',doc,kid,1);
    expect(one.rowId).toBe(two.rowId);
    expect(one.opId).not.toBe(two.opId);
    expect(one.record.envelope.revision).not.toBe(two.record.envelope.revision);
    expect(one.record.envelope.ct).not.toBe(two.record.envelope.ct);
    await expect(open(root(),'tasks',one)).rejects.toThrow();
  });
  it('fails closed on unknown fields and malformed internal revision/deletion state',async()=>{
    const key=root(),kid=generateKeyId(),original=raw(cases[0][1]);
    const invalid=[
      {...original,privatePlaintext:'bad'},
      {...original,_deleted:'true'},
      {...original,_rev:''},
      {...original,_meta:{}},
      {...original,_attachments:null},
      {...original,userId:'someone_else'},
      {...original,isDeleted:'yes'},
      {...original,visibility:'public'},
      {...original,date:undefined},
      {...original,unrecognized:{nested:{private:'value'}}},
    ];
    for(const candidate of invalid)
      await expect(prepareScratchRawOwnerToV2(key,owner,'tasks',candidate,kid,1))
        .rejects.toThrow();
    await expect(prepareScratchRawOwnerToV2(key,{...owner,projectId:'other'},
      'tasks',original,kid,1)).rejects.toThrow();
    await expect(prepareScratchRawOwnerToV2(key,owner,'tasks',original,kid,0))
      .rejects.toThrow();
    await expect(prepareScratchRawOwnerToV2(key,owner,'tasks',original,'bad',1))
      .rejects.toThrow();
  });
  it('snapshots mutable inputs before asynchronous local cryptography',async()=>{
    const key=root(),kid=generateKeyId();
    const original=raw(cases[0][1]),expected={...original};
    const changedOwner={...owner};
    const mutableKey=key.slice();
    const preparing=prepareScratchRawOwnerToV2(mutableKey,changedOwner,
      'tasks',original,kid,4);
    original.title='CHANGED AFTER START';
    changedOwner.ownerId='another_owner';
    mutableKey.fill(0);
    const plan=await preparing;
    const opened=await open(key,'tasks',plan);
    expect(opened.title).toBe(expected.title);
    expect(plan.ownerId).toBe(owner.ownerId);
  });
});
