import {describe,expect,it} from 'vitest';
import {
  buildScratchCurrentOriginRescueFile,
  ownerRescueReaderFromRxDb,
  stageSelectedScratchOwnerRescueFile,
} from '../../src/lib/e2ee/ownerCurrentOriginRescueBridge';
import {LOCAL_OWNER_COLLECTIONS} from '../../src/lib/e2ee/ownerOfflineRowSnapshot';

const project='6b00671500279e901846';
const owner={projectId:project,ownerId:'synthetic_bridge_owner'};
const root=new Uint8Array(32).fill(57),keyId='k_'+'b'.repeat(32);
const gate={assertReady:async()=>{}};

describe('actual-current-origin Scratch rescue bridge stays fail closed',()=>{
  it('rejects foreign project/owner, invalid root and missing gate before reading',async()=>{
    await expect(buildScratchCurrentOriginRescueFile(
      root,{...owner,projectId:'6ae94a2100014d01f5ed'},
      keyId,gate)).rejects.toThrow('incomplete');
    await expect(buildScratchCurrentOriginRescueFile(
      root,{...owner,ownerId:123} as never,keyId,gate))
      .rejects.toThrow('incomplete');
    await expect(buildScratchCurrentOriginRescueFile(
      new Uint8Array(31),owner,keyId,gate)).rejects.toThrow('incomplete');
    await expect(buildScratchCurrentOriginRescueFile(
      root,owner,keyId,null as never)).rejects.toThrow('incomplete');
    await expect(stageSelectedScratchOwnerRescueFile(
      root,{...owner,projectId:'6ae9599c002ab812f9c3'},
      null as never,keyId,1,gate)).rejects.toThrow('incomplete');
  });
  it('requires every actual RxDB collection and a storageInstance',()=>{
    const incomplete=Object.fromEntries(
      LOCAL_OWNER_COLLECTIONS.slice(0,-1).map(name=>[
        name,{storageInstance:{schema:{primaryKey:'id'},query:async()=>({documents:[]})}},
      ])
    );
    expect(()=>ownerRescueReaderFromRxDb(incomplete as never))
      .toThrow('incomplete');
    const complete=Object.fromEntries(
      LOCAL_OWNER_COLLECTIONS.map(name=>[
        name,{storageInstance:{schema:{primaryKey:'id'},query:async()=>({documents:[]})}},
      ])
    );
    expect(typeof ownerRescueReaderFromRxDb(complete as never).readAll)
      .toBe('function');
  });
  it('cannot stage a local-memory Blob, missing File or a misnamed File',async()=>{
    await expect(stageSelectedScratchOwnerRescueFile(
      root,owner,new Blob(['{}']) as never,keyId,1,gate))
      .rejects.toThrow('incomplete');
    await expect(stageSelectedScratchOwnerRescueFile(
      root,owner,null as never,keyId,1,gate))
      .rejects.toThrow('incomplete');
  });
});
