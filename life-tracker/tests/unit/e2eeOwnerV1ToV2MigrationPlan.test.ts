import {describe,expect,it} from 'vitest';
import {
  generateAccountRoot,generateKeyId,generateOpaqueRowId,generateRevision,
  encryptPrivateRecord,
} from '../../src/lib/e2ee/coreCrypto';
import {
  prepareScratchOwnerV1ToV2,verifyScratchOwnerV1ToV2,
} from '../../src/lib/e2ee/ownerV1ToV2MigrationPlan';
import {type OwnerV1Record} from '../../src/lib/e2ee/ownerLegacyV1Readback';

const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_migration_owner'};
async function original() {
  const root=generateAccountRoot(),ctx={...owner,payloadDomain:'task' as const,
    rowId:generateOpaqueRowId(),keyId:generateKeyId(),
    revision:generateRevision(),publicRouting:{
      userId:owner.ownerId,isDeleted:false,visibility:'private',date:'2042-02-14',
      reminderTime:'06:25',createdAt:'2026-11-26T00:00:00Z',
      updatedAt:'2026-11-26T00:00:00Z',
    }};
  const content={id:'historical_source_id',title:'SECRET OLD TASK',
    completed:false,categoryId:'private_c',order:1,tags:'private_label'};
  const envelope=await encryptPrivateRecord(root,ctx,content);
  const legacy:OwnerV1Record={
    projectId:owner.projectId,ownerId:owner.ownerId,
    rowId:ctx.rowId,collection:'tasks',domain:'task',
    routing:ctx.publicRouting,published:{},envelope,
  };
  return {root,legacy,content};
}
describe('synthetic local-only authenticated V1 to V2 migration',()=>{
  it('seals v1 private dates/reminders, preserves full exact decrypted content',async()=>{
    const {root,legacy,content}=await original();
    const plan=await prepareScratchOwnerV1ToV2(root,owner,legacy,1);
    expect(plan.collection).toBe('tasks');
    expect(plan.rowId).toMatch(/^p_[a-f0-9]{32}$/);
    expect(plan.opId).toMatch(/^o_[a-f0-9]{32}$/);
    expect(plan.expectedRevision).toBeNull();
    const serialized=JSON.stringify(plan);
    for(const secret of [content.title,content.id,legacy.routing.date,
      legacy.routing.reminderTime,'visibility','private_label'])
      expect(serialized).not.toContain(secret);
    await expect(verifyScratchOwnerV1ToV2(root,owner,legacy,plan,plan.record))
      .resolves.toBeUndefined();
  });
  it('deterministically addresses migration destination but never invents stable operation/nonce',async()=>{
    const {root,legacy}=await original();
    const a=await prepareScratchOwnerV1ToV2(root,owner,legacy,1);
    const b=await prepareScratchOwnerV1ToV2(root,owner,legacy,1);
    expect(a.rowId).toBe(b.rowId);
    expect(a.opId).not.toBe(b.opId);
    expect(a.record.envelope.revision).not.toBe(b.record.envelope.revision);
    expect(a.record.envelope.ct).not.toBe(b.record.envelope.ct);
  });
  it('rejects incorrect owner, key, epoch, v1 routing tamper and v2 readback swaps',async()=>{
    const {root,legacy}=await original();
    const plan=await prepareScratchOwnerV1ToV2(root,owner,legacy,1);
    await expect(prepareScratchOwnerV1ToV2(root,owner,legacy,0)).rejects.toThrow();
    await expect(prepareScratchOwnerV1ToV2(root,{...owner,ownerId:'other'},legacy,1))
      .rejects.toThrow();
    await expect(prepareScratchOwnerV1ToV2(root,owner,{...legacy,routing:{
      ...legacy.routing,date:'2042-02-15',
    }},1)).rejects.toThrow();
    await expect(verifyScratchOwnerV1ToV2(root,owner,legacy,plan,{
      ...plan.record,rowId:generateOpaqueRowId(),
    })).rejects.toThrow();
    await expect(verifyScratchOwnerV1ToV2(root,owner,legacy,{
      ...plan,expectedGeneration:0,
    },plan.record)).rejects.toThrow();
    await expect(verifyScratchOwnerV1ToV2(generateAccountRoot(),owner,legacy,
      plan,plan.record)).rejects.toThrow();
  });
  it('rejects unclassified historical fields, never silently truncates v1 data',async()=>{
    const {root,legacy}=await original();
    const c={...owner,payloadDomain:'task' as const,rowId:legacy.rowId,
      keyId:legacy.envelope.kid,revision:legacy.envelope.revision,
      publicRouting:legacy.routing};
    const envelope=await encryptPrivateRecord(root,c,{
      id:'old_id',title:'SECRET',unclassifiedHistoricalField:'not represented in dev',
    });
    await expect(prepareScratchOwnerV1ToV2(root,owner,{...legacy,envelope},1))
      .rejects.toThrow();
  });
});
