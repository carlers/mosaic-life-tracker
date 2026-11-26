import {createRequire} from 'node:module';
import {describe,expect,it} from 'vitest';
import {generateAccountRoot,generateKeyId,generateOpaqueRowId,generateRevision,encryptPrivateRecord} from '../../src/lib/e2ee/coreCrypto';
import {SCRATCH_OWNER_V2_PROJECT,OWNER_V2_COLLECTIONS,V2_ROUTING,V2_OWNER_DOMAIN,
  sealV2PrivateOwnerDocument,openV2PrivateOwnerDocument,
  type OwnerV2Collection} from '../../src/lib/e2ee/ownerPrivateV2Contract';
import {ownerPrivacyFields} from '../../src/lib/e2ee/fieldManifest';
const server=createRequire(import.meta.url)('../../appwrite-functions/message-action/e2ee-owner-v2-policy.js') as {
  validateV2PrivateOwnerRecord:(x:unknown,ownerId:string)=>boolean;
  OWNER_V2_ROUTING:Record<string,string[]>;OWNER_V2_DOMAINS:Record<string,string>;
};
const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_owner'};
const scope=(domain:typeof V2_OWNER_DOMAIN[OwnerV2Collection])=>({
  ...owner,payloadDomain:domain,rowId:generateOpaqueRowId(),keyId:generateKeyId(),
  revision:generateRevision(),
});
const task={id:'secret_id',userId:owner.ownerId,isDeleted:false,
  title:'PRIVATE MEETING',date:'2044-03-13',visibility:'private',
  reminderTime:'14:37',createdAt:'2026-11-26T02:00:00Z',updatedAt:'2026-11-26T02:00:00Z'};
describe('UNWIRED owner-private v2 client + prospective server policy',()=>{
  it('matches the exact current-dev classification for all 8 personal collections',()=>{
    expect(OWNER_V2_COLLECTIONS).toHaveLength(8);
    for(const collection of OWNER_V2_COLLECTIONS){
      const expected=Object.entries(ownerPrivacyFields[collection])
        .filter(([,v])=>v==='routing').map(([k])=>k).sort();
      expect([...V2_ROUTING[collection]].sort()).toEqual(expected);
      expect(server.OWNER_V2_ROUTING[collection].slice().sort()).toEqual(expected);
      expect(server.OWNER_V2_DOMAINS[collection]).toBe(V2_OWNER_DOMAIN[collection]);
    }
    expect(OWNER_V2_COLLECTIONS).not.toContain('messages');
    expect(OWNER_V2_COLLECTIONS).not.toContain('friendships');
  });
  it('hides original ID, date, reminder, visibility while server accepts only v2 owner metadata',async()=>{
    const root=generateAccountRoot(),ctx=scope('task');
    const record=await sealV2PrivateOwnerDocument(root,owner,ctx,'tasks',task);
    const serialized=JSON.stringify(record);
    for(const secret of [task.title,task.id,task.date,task.reminderTime,'visibility'])
      expect(serialized).not.toContain(secret);
    expect(record.routing).toEqual({
      userId:owner.ownerId,isDeleted:false,createdAt:task.createdAt,updatedAt:task.updatedAt,
    });
    expect(server.validateV2PrivateOwnerRecord(record,owner.ownerId)).toBe(true);
    expect(await openV2PrivateOwnerDocument(root,owner,ctx,'tasks',record)).toEqual(task);
  });
  it('rejects public/social, wrong owner, unknown, missing visibility, and project',async()=>{
    const root=generateAccountRoot(),ctx=scope('task');
    for(const data of [
      {...task,visibility:'public'}, {...task,visibility:'followers'},
      {...task,visibility:''},{...task,visibility:undefined},
      {...task,privateLeak:'unclassified'},{...task,userId:'wrong'},
    ])await expect(sealV2PrivateOwnerDocument(root,owner,ctx,'tasks',data)).rejects.toThrow();
    await expect(sealV2PrivateOwnerDocument(root,owner,ctx,'messages' as OwnerV2Collection,task)).rejects.toThrow();
    await expect(sealV2PrivateOwnerDocument(root,
      {...owner,projectId:'6ae94a2100014d01f5ed'},ctx,'tasks',task)).rejects.toThrow();
  });
  it('rejects v1 AES-GCM downgrade and routing/header/account tampering',async()=>{
    const root=generateAccountRoot(),ctx=scope('task');
    const record=await sealV2PrivateOwnerDocument(root,owner,ctx,'tasks',task);
    for(const altered of [
      {...record,schemaVersion:1},{...record,policy:'owner-private-v1'},
      {...record,routing:{...record.routing,date:task.date}},
      {...record,routing:{...record.routing,visibility:'private'}},
      {...record,ownerId:'intruder'},
      {...record,projectId:'6ae9599c002ab812f9c3'},
      {...record,published:{friendId:'someone'}},
      {...record,rowId:generateOpaqueRowId()},
    ]){
      expect(server.validateV2PrivateOwnerRecord(altered,owner.ownerId)).toBe(false);
      await expect(openV2PrivateOwnerDocument(root,owner,ctx,'tasks',altered as typeof record)).rejects.toThrow();
    }
    await expect(openV2PrivateOwnerDocument(generateAccountRoot(),owner,ctx,'tasks',record)).rejects.toThrow();
    const oldEnvelope=await encryptPrivateRecord(root,{...ctx,publicRouting:record.routing},{id:task.id,title:task.title,date:task.date,visibility:'private'});
    await expect(openV2PrivateOwnerDocument(root,owner,ctx,'tasks',
      {...record,envelope:oldEnvelope})).rejects.toThrow();
  });
  it('seals new activity fields (sport, day, stats) before any server boundary',async()=>{
    const root=generateAccountRoot(),ctx=scope('activity');
    const doc={id:'activity_hidden',userId:owner.ownerId,isDeleted:false,
      title:'HIDDEN WORKOUT',sport:'private_sport',localDate:'2044-03-13',
      completedAt:'2044-03-13T10:00:00Z',distanceMeters:5000,elapsedSeconds:1800,
      fingerprint:'private_fingerprint',
      createdAt:'2026-11-26T02:00:00Z',updatedAt:'2026-11-26T02:00:00Z'};
    const record=await sealV2PrivateOwnerDocument(root,owner,ctx,'activities',doc);
    for(const secret of [doc.title,doc.sport,doc.localDate,doc.fingerprint,doc.id])
      expect(JSON.stringify(record)).not.toContain(secret);
    expect(server.validateV2PrivateOwnerRecord(record,owner.ownerId)).toBe(true);
    expect(await openV2PrivateOwnerDocument(root,owner,ctx,'activities',record)).toEqual(doc);
  });
});

describe('M2 owner v2 AEAD transcript snapshots across asynchronous crypto',()=>{
  it('seals one immutable original owner/doc/context despite caller mutation in flight',async()=>{
    const root=generateAccountRoot(),originalRoot=root.slice();
    const originalOwner={...owner};
    const originalCtx=scope('task');
    const originalDoc={...task};
    const changingOwner={...originalOwner};
    const changingCtx={...originalCtx};
    const changingDoc={...originalDoc};
    const pending=sealV2PrivateOwnerDocument(
      root,changingOwner,changingCtx,'tasks',changingDoc);
    root.fill(0);
    changingOwner.ownerId='mutated_owner';
    changingCtx.ownerId='mutated_owner';
    changingCtx.rowId=generateOpaqueRowId();
    changingCtx.revision=generateRevision();
    changingDoc.id='mutated_id';
    changingDoc.title='mutated title';
    changingDoc.date='2045-01-01';
    changingDoc.userId='mutated_owner';
    const record=await pending;
    expect(record.ownerId).toBe(originalOwner.ownerId);
    expect(record.rowId).toBe(originalCtx.rowId);
    expect(record.envelope.revision).toBe(originalCtx.revision);
    expect(record.routing.userId).toBe(originalOwner.ownerId);
    expect(JSON.stringify(record)).not.toContain('mutated_id');
    expect(await openV2PrivateOwnerDocument(
      originalRoot,originalOwner,originalCtx,'tasks',record)).toEqual(originalDoc);
  });
  it('opens one immutable ciphertext and routing despite caller mutation in flight',async()=>{
    const root=generateAccountRoot(),ctx=scope('task');
    const existing=await sealV2PrivateOwnerDocument(root,owner,ctx,'tasks',task);
    const input=structuredClone(existing);
    const mutableOwner={...owner},mutableCtx={...ctx};
    const pending=openV2PrivateOwnerDocument(
      root,mutableOwner,mutableCtx,'tasks',input);
    root.fill(0);
    mutableOwner.ownerId='foreign_owner';
    mutableCtx.ownerId='foreign_owner';
    mutableCtx.rowId=generateOpaqueRowId();
    (input as unknown as {routing:{userId:string};envelope:{ct:string}})
      .routing.userId='foreign_owner';
    (input as unknown as {envelope:{ct:string}}).envelope.ct='tampered';
    expect(await pending).toEqual(task);
  });
});
