import {describe,it,expect} from 'vitest';
import {generateAccountRoot,deriveMigratedOwnerRowId} from '../../src/lib/e2ee/coreCrypto';
import {
  sealVerifiedOwnerChange,openVerifiedLocalOwnerChange,sealVerifiedOwnerPage,
} from '../../src/lib/e2ee/localOwnerPageCodec';
const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_owner'};
const session=()=>({root:generateAccountRoot(),keyId:'k_'+'a'.repeat(32),generation:1});
const revision='r_'+'b'.repeat(32);
async function example(s:ReturnType<typeof session>){
  const document={id:'sensitive_private_ID',userId:owner.ownerId,
    title:'PRIVATE PAYLOAD SENTINEL',date:'2025-02-14',memo:'secret_note',
    visibility:'private',isDeleted:false,__e2eeRevision:revision};
  const rowId=await deriveMigratedOwnerRowId(s.root,owner,'task',document.id);
  return {document,rowId,serverUpdatedAt:'2026-11-26T02:00:00.000Z'};
}
describe('source-only local AEAD verified-owner change codec',()=>{
  it('roundtrips without exposing original semantic IDs, titles or full record dates',async()=>{
    const s=session(),item=await example(s);
    const sealed=await sealVerifiedOwnerChange(owner,s,'tasks',item);
    expect(sealed.rowId).toBe(item.rowId);
    const serialized=JSON.stringify(sealed);
    for(const secret of ['PRIVATE PAYLOAD SENTINEL','sensitive_private_ID','secret_note','2025-02-14']) {
      expect(serialized).not.toContain(secret);
    }
    expect((await openVerifiedLocalOwnerChange(owner,s,'tasks',sealed))).toEqual(item);
  });
  it('rejects metadata tamper, wrong root/account/project/key, invalid ciphertext and downgrade',async()=>{
    const s=session(),item=await example(s);
    const sealed=await sealVerifiedOwnerChange(owner,s,'tasks',item);
    for(const bad of [
      {...sealed,serverUpdatedAt:'2026-11-26T02:00:01.000Z'},
      {...sealed,sourceRevision:'r_'+'c'.repeat(32)},
      {...sealed,envelope:{ title:'plaintext' }},
      {...sealed,version:0},
    ]) await expect(openVerifiedLocalOwnerChange(owner,s,'tasks',bad)).rejects.toThrow();
    await expect(openVerifiedLocalOwnerChange(owner,{...s,root:generateAccountRoot()},'tasks',sealed)).rejects.toThrow();
    await expect(openVerifiedLocalOwnerChange({...owner,ownerId:'other'},s,'tasks',sealed)).rejects.toThrow();
    await expect(openVerifiedLocalOwnerChange({...owner,projectId:'6ae9599c002ab812f9c3'},s,'tasks',sealed)).rejects.toThrow();
    await expect(openVerifiedLocalOwnerChange(owner,{...s,keyId:'k_'+'d'.repeat(32)},'tasks',sealed)).rejects.toThrow();
    await expect(openVerifiedLocalOwnerChange(owner,s,'diary',sealed)).rejects.toThrow();
  });
  it('refuses unknown/private cross-account fields, bad semantic row IDs and duplicate page entries',async()=>{
    const s=session(),item=await example(s);
    await expect(sealVerifiedOwnerChange(owner,s,'tasks',{
      ...item,document:{...item.document,secretUnclassified:'leak'},
    })).rejects.toThrow();
    await expect(sealVerifiedOwnerChange(owner,s,'tasks',{
      ...item,document:{...item.document,userId:'other'},
    })).rejects.toThrow();
    await expect(sealVerifiedOwnerChange(owner,s,'tasks',{
      ...item,rowId:'p_'+'e'.repeat(32),
    })).rejects.toThrow();
    await expect(sealVerifiedOwnerPage(owner,s,'tasks',[item,item])).rejects.toThrow();
    expect((await sealVerifiedOwnerPage(owner,s,'tasks',[item])).length).toBe(1);
  });
  it('does not allow normal Preview/Production project even if the owner root is valid',async()=>{
    const s=session(),item=await example(s);
    await expect(sealVerifiedOwnerChange({...owner,projectId:'6ae94a2100014d01f5ed'},s,'tasks',item)).rejects.toThrow();
  });
});
