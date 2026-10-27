import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
const f=vi.hoisted(()=>({rows:{} as Record<string,Array<Record<string,unknown>>>,photo:vi.fn(),duringRead:()=>{}}));
vi.mock('../../src/db/database',()=>({getDatabase:()=>Object.fromEntries(
  ['tasks','categories','diary','settings','portableSettings','friendships','bucketList','bucketTaskLinks'].map(name=>[name,{
    find:({selector}:{selector:Record<string,unknown>})=>({exec:async()=>{
      f.duringRead();
      return (f.rows[name]??[]).filter(row=>Object.entries(selector).every(([key,value])=>row[key]===value))
        .map(row=>({toJSON:()=>({...row})}));
    }}),
  }]))}));
vi.mock('../../src/lib/coreBackendConfig',()=>({CORE_BACKEND:{driver:'supabase'}}));
vi.mock('../../src/lib/backendCapabilities',()=>({MOSAIC_FEATURE_PROFILE:'personal'}));
vi.mock('../../src/lib/supabaseMedia',()=>({currentSupabaseMediaOwner:()=> 'owner',fetchSupabasePhoto:f.photo}));
vi.mock('../../src/lib/sdk',()=>({guardedStorage:{}}));
import { exportUserData } from '../../src/lib/exportData';
import { scopeAccountWork } from '../../src/lib/accountWorkScope';
const user={id:'owner',email:'owner@example.org',name:'Owner'};
describe('complete local owner backup snapshot',()=>{
  beforeEach(()=>{
    scopeAccountWork('owner');f.rows={};f.duringRead=()=>{};f.photo.mockReset();
  });
  it('retains tombstones, exact original IDs, pending drafts and portable preference deletions in JSON',async()=>{
    f.rows.tasks=[{id:'original_task',userId:'owner',isDeleted:true,title:'Deleted history',image:'photo'},
      {id:'offline_draft',userId:'owner',isDeleted:false,title:'Unsynced draft'},
      {id:'foreign',userId:'other',isDeleted:false,title:'Must not export'}];
    f.rows.settings=[{id:'local',userId:'owner',key:'theme',value:'dark',isDeleted:false}];
    f.rows.portableSettings=[{id:'portable',userId:'owner',key:'theme',value:'light',isDeleted:true}];
    f.rows.bucketTaskLinks=[{id:'original_link',userId:'owner',isDeleted:true,bucketListId:'old_goal',taskId:'original_task'}];
    const result=await exportUserData(user,{includeImages:false});
    const payload=JSON.parse(await result.blob.text());
    expect(payload.version).toBe(5);
    expect(payload.history).toMatchObject({tombstonesIncluded:true,scope:'current-local-owner-snapshot'});
    expect(payload.data.tasks).toEqual(f.rows.tasks.slice(0,2));
    expect(payload.data.settings).toEqual(f.rows.portableSettings);
    expect(payload.data.bucketTaskLinks).toEqual(f.rows.bucketTaskLinks);
    expect(payload.images.referenced).toEqual(['photo']);
  });
  it('bundles exact cached media bytes referenced by deletion history and discloses unavailable bytes',async()=>{
    const bytes=new Uint8Array([82,73,70,70,0,1,2,3]);
    f.rows.tasks=[{id:'deleted',userId:'owner',isDeleted:true,image:'photo'},
      {id:'draft',userId:'owner',isDeleted:false,image:'missing'}];
    f.photo.mockImplementation(async(id:string)=>id==='photo'?new Blob([bytes],{type:'image/webp'}):null);
    const result=await exportUserData(user,{includeImages:true});
    const files=unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    expect(files['images/photo.webp']).toEqual(bytes);
    const payload=JSON.parse(new TextDecoder().decode(files['manifest.json']));
    expect(payload.images.missingImages).toEqual(['missing']);
    expect(payload.data.tasks[0].isDeleted).toBe(true);
  });
  it('cancels an export if the account changes during collection or media reads',async()=>{
    f.duringRead=()=>{scopeAccountWork('other');};
    await expect(exportUserData(user,{includeImages:false})).rejects.toThrow('Account changed');
    scopeAccountWork('owner');f.duringRead=()=>{};
    f.rows.tasks=[{id:'task',userId:'owner',isDeleted:false,image:'photo'}];
    f.photo.mockImplementation(async()=>{scopeAccountWork('other');return new Blob(['x']);});
    await expect(exportUserData(user,{includeImages:true})).rejects.toThrow('Account changed');
  });
});
