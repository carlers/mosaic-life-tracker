import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_TABLES, MOSAIC_BUCKET } from '../../infrastructure/mosaic-backend.mjs';
import {
  inspectScratchLegacyWriterFloor, LEGACY_PRIVATE_TABLES,
  LEGACY_MEDIA_BUCKET,
} from '../../scripts/inspect-e2ee-scratch-legacy-writer-floor.mjs';

const PROJECT = '6b00671500279e901846';
const PATH = '/tablesdb/life_tracker/tables/';
const FILES = '/storage/buckets/task_images/files';
const BUCKET = '/storage/buckets/task_images';
const clone = (obj: unknown) => structuredClone(obj);

function fixtures() {
  const lookup: Record<string,unknown> = {};
  for (const id of LEGACY_PRIVATE_TABLES) {
    const table=MOSAIC_TABLES.find((row:{id:string})=>row.id===id);
    if(!table)throw new Error('missing manifest');
    lookup[PATH+id]={...clone(table),$id:id,$permissions:['create("users")']};
    lookup[PATH+id+'/rows']={total:0,rows:[]};
  }
  lookup[BUCKET]={...clone(MOSAIC_BUCKET),$id:LEGACY_MEDIA_BUCKET,
    $permissions:['create("users")']};
  lookup[FILES]={total:0,files:[]};
  return lookup;
}
function requester(entries:Record<string,unknown>) {
  return vi.fn(async (method:string,path:string)=>{
    if(method!=='GET' || !Object.hasOwn(entries,path))throw new Error('unexpected or mutating request');
    return clone(entries[path]);
  });
}
describe('isolated Scratch M2 legacy plaintext writer floor (read-only)',()=>{
  it('lists exactly six private TablesDB domains and legacy plaintext media for gate inventory',()=>{
    expect([...LEGACY_PRIVATE_TABLES]).toEqual([
      'tasks','categories','diary','settings','bucket_list_items','bucket_task_links',
    ]);
    expect(LEGACY_MEDIA_BUCKET).toBe('task_images');
  });

  it('denies all normal Preview/TEST/Production or missing project before requests',async()=>{
    const request=requester(fixtures());
    for(const projectId of [
      '6ae94a2100014d01f5ed','6ae1bf2e00034572451b',
      '6ae9599c002ab812f9c3','',null,undefined,
    ]) {
      await expect(inspectScratchLegacyWriterFloor({projectId,request}))
        .rejects.toThrow('project');
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('confirms exact empty source and reports legacy browser create grants as OPEN',async()=>{
    const request=requester(fixtures());
    const outcome=await inspectScratchLegacyWriterFloor({projectId:PROJECT,request});
    expect(outcome).toEqual({
      projectId:PROJECT,complete:true,mutationCount:0,
      tables:[...LEGACY_PRIVATE_TABLES].map(tableId=>({
        tableId,state:'browser-create-open',
      })),
      media:{bucketId:'task_images',state:'browser-create-open'},
      accountScopedAcl:'not-verified',
      existingClientRowPermissions:'not-verified',
      atomicWriterFence:'not-verified',
      cutover:'not-authorized',
    });
    expect(request.mock.calls).toHaveLength(14);
    expect(request.mock.calls.every(([method])=>method==='GET')).toBe(true);
  });

  it('handles previously sealed allowlisted table/bucket metadata idempotently but never calls PUT',async()=>{
    const f=fixtures();
    for (const id of LEGACY_PRIVATE_TABLES) {
      (f[PATH+id] as Record<string,unknown>).$permissions=[];
    }
    (f[BUCKET] as Record<string,unknown>).$permissions=[];
    const request=requester(f);
    const result=await inspectScratchLegacyWriterFloor({projectId:PROJECT,request});
    expect(result.tables.every(({state})=>state==='table-create-closed')).toBe(true);
    expect(result.media.state).toBe('bucket-create-closed');
    expect(request.mock.calls.every(([method])=>method==='GET')).toBe(true);
  });

  it('blocks any plaintext record, missing count, unsafe ACL or drift BEFORE media can pass',async()=>{
    for(const issue of [
      ['row-present',(f:Record<string,unknown>)=>{
        f[PATH+'tasks'+'/rows']={total:1,rows:[]};
      }],
      ['row-hidden',(f:Record<string,unknown>)=>{
        f[PATH+'tasks'+'/rows']={rows:[]};
      }],
      ['broad-permissions',(f:Record<string,unknown>)=>{
        (f[PATH+'categories'] as Record<string,unknown>).$permissions=['read("users")'];
      }],
      ['schema-drift',(f:Record<string,unknown>)=>{
        (f[PATH+'categories'] as Record<string,unknown>).rowSecurity=false;
      }],
      ['index-injection',(f:Record<string,unknown>)=>{
        const t=f[PATH+'tasks'] as {indexes:unknown[]};
        t.indexes.push({key:'new_exposure',type:'key',attributes:['title']});
      }],
      ['column-removed',(f:Record<string,unknown>)=>{
        const t=f[PATH+'diary'] as {columns:unknown[]};
        t.columns.pop();
      }],
      ['bucket-creatable-all',(f:Record<string,unknown>)=>{
        (f[BUCKET] as Record<string,unknown>).$permissions=['create("any")'];
      }],
      ['files-present',(f:Record<string,unknown>)=>{
        f[FILES]={total:1,files:[]};
      }],
      ['file-hidden',(f:Record<string,unknown>)=>{
        f[FILES]={files:[]};
      }],
      ['media-encryption-off',(f:Record<string,unknown>)=>{
        (f[BUCKET] as Record<string,unknown>).encryption=false;
      }],
    ] as const) {
      const [name,change]=issue;
      const f=fixtures();
      change(f);
      const request=requester(f);
      await expect(inspectScratchLegacyWriterFloor({projectId:PROJECT,request}))
        .rejects.toThrow('preflight blocked');
      expect(request.mock.calls.every(([method])=>method==='GET')).toBe(true);
      expect(request).toHaveBeenCalled();
      if(name==='row-present' || name==='row-hidden') {
        expect(request.mock.calls.map(x=>x[1])).not.toContain(BUCKET);
      }
    }
  });

  it('rejects unknown live metadata rather than substituting empty arrays or counts',async()=>{
    const f=fixtures();
    delete f[PATH+'tasks'];
    const request=requester(f);
    await expect(inspectScratchLegacyWriterFloor({projectId:PROJECT,request}))
      .rejects.toThrow();
    expect(request.mock.calls.every(([method])=>method==='GET')).toBe(true);
  });
});
