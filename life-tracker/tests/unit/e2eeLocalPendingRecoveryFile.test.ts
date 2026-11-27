import { describe, expect, it } from 'vitest';
import { generateAccountRoot } from '../../src/lib/e2ee/coreCrypto';
import {
  buildLocalPendingRecoveryFile, readLocalPendingRecoveryFile,
  LEGACY_RECOVERY_FILENAME,
} from '../../src/lib/e2ee/localPendingRecoveryFile';

const owner = { projectId: 'isolated_test_project', ownerId: 'synthetic_owner' };
const pending = {id:'message:one',userId:owner.ownerId,action:'mark_read',
  payload:{threadId:'private_thread'},enqueuedAt:'2026-11-26T01:00:00Z',attempts:0};
function store(entries: [string,string][]) {
  const m=new Map(entries);
  return {
    data:m,
    storage:{
      get length() { return m.size; },
      key:(index:number) => [...m.keys()][index] ?? null,
      getItem:(key:string) => m.get(key) ?? null,
    } as Pick<Storage,'length'|'key'|'getItem'>,
  };
}
const key='mosaic_message_action_queue:entry:'+encodeURIComponent(owner.ownerId)+
  ':'+encodeURIComponent(pending.id);

describe('offline encrypted recovery file carrier — source-only',()=>{
  it('builds self-verified file bytes without changing storage or exposing plaintext',async()=>{
    const {storage,data}=store([[key,JSON.stringify(pending)],
      ['other_user_preferences','unrelated']]);
    const original=[...data],root=generateAccountRoot();
    const output=await buildLocalPendingRecoveryFile(owner,root,storage);
    expect(output.filename).toBe(LEGACY_RECOVERY_FILENAME);
    expect(output.file.type).toBe('application/octet-stream');
    expect(output.count).toBe(1);
    const ciphertext=await output.file.text();
    expect(ciphertext).not.toContain('private_thread');
    expect(ciphertext).not.toContain(owner.ownerId);
    expect((await readLocalPendingRecoveryFile(owner,root,output.file))[0].record).toEqual(pending);
    expect([...data]).toEqual(original);
  });
  it('fails on wrong account, wrong project, wrong root, plaintext, and changed ciphertext',async()=>{
    const {storage}=store([[key,JSON.stringify(pending)]]);
    const root=generateAccountRoot();
    const {file}=await buildLocalPendingRecoveryFile(owner,root,storage);
    await expect(readLocalPendingRecoveryFile({...owner,ownerId:'stranger'},root,file)).rejects.toThrow();
    await expect(readLocalPendingRecoveryFile({...owner,projectId:'other'},root,file)).rejects.toThrow();
    await expect(readLocalPendingRecoveryFile(owner,generateAccountRoot(),file)).rejects.toThrow();
    await expect(readLocalPendingRecoveryFile(owner,root,new Blob([JSON.stringify(pending)]))).rejects.toThrow();
    const raw=await file.text();
    const altered=JSON.parse(raw);
    altered.ciphertext=altered.ciphertext.slice(0,-1)+(altered.ciphertext.endsWith('A')?'B':'A');
    await expect(readLocalPendingRecoveryFile(owner,root,new Blob([JSON.stringify(altered)]))).rejects.toThrow();
  });
  it('rejects missing, oversize and unreadable files',async()=>{
    const root=generateAccountRoot();
    await expect(readLocalPendingRecoveryFile(owner,root,
      {size:2_200_001,text:async()=>''})).rejects.toThrow();
    await expect(readLocalPendingRecoveryFile(owner,root,
      {size:1,text:async()=>{throw new Error('read denied')}})).rejects.toThrow();
    await expect(readLocalPendingRecoveryFile(owner,root,
      {size:0,text:async()=>''})).rejects.toThrow();
  });
  it('does not misrepresent a racing queue mutation as a finished file',async()=>{
    const {storage,data}=store([[key,JSON.stringify(pending)]]);
    let seen=0;
    const raced={...storage,getItem:(k:string)=>{
      const v=storage.getItem(k);
      seen++;
      if(seen===2)data.set(k,JSON.stringify({...pending,attempts:2}));
      return v;
    }};
    await expect(buildLocalPendingRecoveryFile(owner,generateAccountRoot(),raced)).rejects.toThrow();
  });
});


describe('saved pending recovery capsule exact bytes and async account stability',()=>{
  it('rejects a File-shaped object with an incorrect declared byte length',async()=>{
    const {storage}=store([[key,JSON.stringify(pending)]]);
    const secret=generateAccountRoot();
    const saved=await buildLocalPendingRecoveryFile(owner,secret,storage);
    const raw=await saved.file.text();
    await expect(readLocalPendingRecoveryFile(owner,secret,{
      size:saved.file.size+1,text:async()=>raw,
    })).rejects.toThrow();
  });
  it('seals and reopens under the original owner despite caller changes',async()=>{
    const {storage}=store([[key,JSON.stringify(pending)]]);
    const originalRoot=generateAccountRoot(),sealRoot=originalRoot.slice();
    const writer={...owner};
    const exporting=buildLocalPendingRecoveryFile(writer,sealRoot,storage);
    writer.ownerId='switched_during_export';sealRoot.fill(0);
    const exported=await exporting;
    expect(exported.count).toBe(1);
    const reader={...owner},readRoot=originalRoot.slice();
    const reading=readLocalPendingRecoveryFile(reader,readRoot,exported.file);
    reader.ownerId='switched_during_read';readRoot.fill(0);
    expect((await reading)[0].record).toEqual(pending);
  });
});
