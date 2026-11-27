import {describe,expect,it} from 'vitest';
import {
  decryptOwnerDocument,encryptOwnerDocument,
} from '../../src/lib/e2ee/ownerRecordCodec';
import {
  generateAccountRoot,generateKeyId,generateOpaqueRowId,generateRevision,
} from '../../src/lib/e2ee/coreCrypto';

const owner={projectId:'synthetic_scratch',ownerId:'synthetic_owner'};
function context(domain:'task'|'social-private'){
  return {...owner,payloadDomain:domain,rowId:generateOpaqueRowId(),
    keyId:generateKeyId(),revision:generateRevision()};
}
describe('dormant generic E2EE codec snapshots metadata through awaited AEAD',()=>{
  it('keeps private owner scope, routing and nested plaintext bound to original inputs',async()=>{
    const root=generateAccountRoot(),c=context('task');
    const originalContext={...c};
    const doc={id:'synthetic_task',title:'SENSITIVE ORIGINAL',
      tags:['original_tag'],date:'2045-01-01',userId:owner.ownerId,
      isDeleted:false,updatedAt:'2045-01-01'};
    const expected=structuredClone(doc);
    const pending=encryptOwnerDocument(root,'tasks',c,doc);
    c.ownerId='forged_owner';
    c.projectId='forged_project';
    c.rowId=generateOpaqueRowId();
    doc.title='MUTATED TITLE';
    doc.tags.push('late_secret');
    doc.userId='forged_owner';
    const sealed=await pending;
    expect(sealed.ownerId).toBe(owner.ownerId);
    expect(sealed.projectId).toBe(owner.projectId);
    expect(sealed.rowId).toBe(originalContext.rowId);
    expect(sealed.routing.userId).toBe(owner.ownerId);
    expect(await decryptOwnerDocument(root,'tasks',originalContext,sealed))
      .toEqual(expected);
  });
  it('ignores untrusted server routing and published fields mutated during decryption',async()=>{
    const root=generateAccountRoot(),c=context('social-private');
    const doc={id:'synthetic_friend',userId:owner.ownerId,
      friendId:'synthetic_recipient',friendDisplayName:'VERIFIED FRIEND',
      isDeleted:false,status:'accepted',acceptedAt:'2045-05-01'};
    const sealed=await encryptOwnerDocument(root,'friendships',c,doc,true);
    const remote=structuredClone(sealed);
    const stable=structuredClone(c);
    const opening=decryptOwnerDocument(root,'friendships',c,remote,true);
    remote.routing.userId='attacker_owner';
    remote.routing.friendId='attacker_recipient';
    remote.published.friendDisplayName='ATTACKER REPLACEMENT';
    remote.envelope.ct='AAAA';
    c.rowId=generateOpaqueRowId();
    c.ownerId='attacker_owner';
    const result=await opening;
    expect(result).toEqual(doc);
    expect(result.userId).toBe(stable.ownerId);
    expect(result.friendDisplayName).toBe('VERIFIED FRIEND');
  });
  it('rejects changed authenticated AAD rather than silently accepting server substitutions',async()=>{
    const root=generateAccountRoot(),c=context('social-private');
    const doc={id:'synthetic_friend',userId:owner.ownerId,
      friendId:'synthetic_recipient',friendDisplayName:'trusted display',
      isDeleted:false,status:'accepted'};
    const sealed=await encryptOwnerDocument(root,'friendships',c,doc,true);
    await expect(decryptOwnerDocument(root,'friendships',c,{
      ...sealed,routing:{...sealed.routing,friendId:'attacker_recipient'},
    },true)).rejects.toThrow();
    await expect(decryptOwnerDocument(root,'friendships',c,{
      ...sealed,published:{...sealed.published,friendDisplayName:'attacker'},
    },true)).rejects.toThrow();
  });
});
