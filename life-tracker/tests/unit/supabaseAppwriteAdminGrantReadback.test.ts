import { describe, expect, it, vi } from 'vitest';
import { MOSAIC_DATABASE, MOSAIC_BUCKET } from '../../infrastructure/mosaic-backend.mjs';
import { inspectAppwriteAdminSourceGrants } from '../../scripts/appwrite-source-grant-readback.mjs';

const owner='signed_owner';
const tables=['tasks','categories','diary','settings','bucket_list_items','bucket_task_links'];
const READ=['read("user:signed_owner")'];
const record=(id:string,userId=owner,permissions=[...READ]) =>
  ({$id:id,user_id:userId,$permissions:permissions});
const table=(id:string,permissions:string[]=[]) =>
  ({$id:id,rowSecurity:true,enabled:true,$permissions:permissions});
const allFiles=[
  {$id:'file_1',$permissions:[...READ]},
  {$id:'foreign_file',$permissions:['read("user:another")']},
];
const functions=[
  {$id:'dr-backup',enabled:true,scopes:['rows.read','files.read']},
  {$id:'message-action',enabled:false,scopes:['rows.write','files.write']},
];

function fixture() {
  const rows:Record<string,ReturnType<typeof record>[]> = Object.fromEntries(
    tables.map(id=>[id,[record(id+'_1')]]),
  );
  const schema:Record<string,ReturnType<typeof table>> = Object.fromEntries(
    tables.map(id=>[id,table(id)]),
  );
  let bucket={$id:MOSAIC_BUCKET.id, enabled:true,fileSecurity:true,$permissions:[] as string[]};
  let files=structuredClone(allFiles);
  const handlers=structuredClone(functions);
  let getterCount=0;
  const calls:Array<{method:string,path:string}>=[];
  const request=vi.fn(async (method:string,path:string)=>{
    calls.push({method,path});
    getterCount++;
    if(method!=='GET') throw new Error('Unexpected mutation');
    const parsed=new URL(path,'https://mock.appwrite.invalid');
    const name=parsed.pathname.split('/');
    if(name[1]==='tablesdb' && name[2]===MOSAIC_DATABASE.id && name[3]==='tables' &&
       tables.includes(name[4]) && !name[5])
      return structuredClone(schema[name[4]]);
    if(name[1]==='storage' && name[2]==='buckets' &&
       name[3]===MOSAIC_BUCKET.id && !name[4])
      return structuredClone(bucket);
    const source = name[1]==='tablesdb' && name[3]==='tables' &&
      name[5]==='rows' && name[6]===undefined ? rows[name[4]] :
      name[1]==='storage' && name[2]==='buckets' && name[4]==='files' ?
        files : name[1]==='functions' ? handlers : undefined;
    if(!source) throw new Error('Unknown backend endpoint '+parsed.pathname);
    const queries=parsed.searchParams.getAll('queries[]').map(q=>JSON.parse(q)) as
      Array<{method:string;attribute?:string;values?:unknown[]}>;
    const equals=queries.find(q=>q.method==='equal' && q.attribute==='user_id')?.values?.[0];
    const after=queries.find(q=>q.method==='cursorAfter')?.values?.[0];
    const limit=queries.find(q=>q.method==='limit')?.values?.[0] as number;
    if(!Number.isSafeInteger(limit) || limit<1) throw new Error('Missing bound');
    const collected=[...source].filter(item=>
      (equals===undefined || ('user_id' in item && item.user_id===equals)) &&
      (after===undefined || String(item.$id)>String(after)));
    const full=[...source].filter(item=>
      equals===undefined || ('user_id' in item && item.user_id===equals));
    const key=name[5]==='rows'?'rows':name[4]==='files'?'files':'functions';
    return {[key]:structuredClone(collected.slice(0,limit)),total:full.length};
  });
  const ownerCounts=Object.fromEntries([...tables.map(id=>[id,1]),[MOSAIC_BUCKET.id,1]]);
  const options={
    request,ownerId:owner,endpoint:'https://sgp.cloud.appwrite.io/v1',
    projectId:'reviewed-scratch-project',databaseId:MOSAIC_DATABASE.id,
    bucketId:MOSAIC_BUCKET.id,deploymentId:'reviewed-scratch-only',
    ownerCounts,expectedOwnerFileIds:['file_1'],expectedFunctionCount:2,
  };
  return {rows,schema,files,functions:handlers,calls,options,request,
    mutateBucket:(permissions:string[])=>{bucket={...bucket,$permissions:permissions}},
    mutateFiles:(next:typeof files)=>{files=next},
    mutateFunction:(enabled:boolean)=>{handlers[1].enabled=enabled},
    getRequestCount:()=>getterCount,
  };
}
describe('read-only actual Appwrite admin ACL inventory collector (#1027)',()=>{
  it('reads every owner row and global Storage/Functions twice with GET only',async()=>{
    const h=fixture();
    const snapshot=await inspectAppwriteAdminSourceGrants(h.options);
    expect(snapshot.ownerLegacyId).toBe(owner);
    expect(snapshot.tableGrants).toHaveLength(6);
    expect(snapshot.tableGrants[0].ownerRows[0].permissions).toEqual(READ);
    expect(snapshot.completeBucketObjectCount).toBe(2);
    expect(snapshot.unattributedBucketFileCount).toBe(1);
    expect(snapshot.photoBucket.ownerFiles).toHaveLength(1);
    expect(snapshot.functionGrants).toHaveLength(2);
    expect(snapshot.adminGrantSnapshotSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot).toMatchObject({
      ownerFileMembershipIndependentlyAuthenticated:false,
      authenticatedSourceLeaseIssued:false,privilegedWriterKeysRevoked:false,
      providerCutoverEligible:false,signedOldClientDenials:[],
    });
    expect(h.calls).toHaveLength(30);
    expect(h.calls.every(x=>x.method==='GET')).toBe(true);
    expect(h.calls.filter(x=>x.path.includes('/rows?')).every(x=>x.path.includes('ttl=0')))
      .toBe(true);
    expect(h.calls.filter(x=>!x.path.includes('/rows?')).every(x=>!x.path.includes('ttl=0')))
      .toBe(true);
  });
  it('captures surviving write ACL and enabled Function rights instead of falsely blessing them',async()=>{
    const h=fixture();
    h.schema.tasks.$permissions=['create("users")'];
    h.rows.tasks[0].$permissions=['update("user:signed_owner")'];
    h.mutateBucket(['create("users")']);
    h.mutateFunction(true);
    const snapshot=await inspectAppwriteAdminSourceGrants(h.options);
    expect(snapshot.tableGrants[0].permissions).toContain('create("users")');
    expect(snapshot.tableGrants[0].ownerRows[0].permissions).toContain('update("user:signed_owner")');
    expect(snapshot.photoBucket.permissions).toContain('create("users")');
    expect(snapshot.functionGrants.find((x:{id:string})=>x.id==='message-action')?.enabled).toBe(true);
    expect(snapshot.providerCutoverEligible).toBe(false);
  });
  it('supports keyset owner pagination, including signed tombstone metadata',async()=>{
    const h=fixture();
    h.rows.tasks.push(record('tasks_2'));
    h.options.ownerCounts.tasks=2;
    const data=await inspectAppwriteAdminSourceGrants({...h.options,pageSize:1});
    expect(data.tableGrants[0].ownerRows.map((x:{id:string})=>x.id))
      .toEqual(['tasks_1','tasks_2']);
    const pages=h.calls.filter(x=>x.path.includes('/tasks/rows?'));
    expect(pages).toHaveLength(4);
    expect(pages[1].path).toContain('cursorAfter');
    expect(h.calls.every(x=>x.method==='GET')).toBe(true);
  });
  it('rejects independently witnessed row omissions and foreign owner records',async()=>{
    const incomplete=fixture();
    incomplete.options.ownerCounts.tasks=2;
    await expect(inspectAppwriteAdminSourceGrants(incomplete.options))
      .rejects.toThrow(/independent complete owner row count/);
    const foreign=fixture();
    foreign.rows.tasks[0].user_id='foreign';
    await expect(inspectAppwriteAdminSourceGrants(foreign.options))
      .rejects.toThrow(/independent complete owner row count|foreign owner/i);
    const duplicate=fixture();
    duplicate.rows.tasks.push({...duplicate.rows.tasks[0]});
    duplicate.options.ownerCounts.tasks=2;
    await expect(inspectAppwriteAdminSourceGrants(duplicate.options))
      .rejects.toThrow(/duplicate|unsorted/);
  });
  it('rejects changed row ACLs across complete double-pass scan even when count unchanged',async()=>{
    const h=fixture();
    const original=h.request.getMockImplementation()!;
    let times=0;
    h.request.mockImplementation(async(method,path)=>{
      if(path==='/tablesdb/life_tracker/tables/tasks' && ++times===2)
        h.rows.tasks[0].$permissions=['delete("user:signed_owner")'];
      return original(method,path);
    });
    await expect(inspectAppwriteAdminSourceGrants(h.options))
      .rejects.toThrow(/changed between full passes/);
  });
  it('refuses missing owner files, mismatched source file witnesses and duplicate IDs',async()=>{
    const missing=fixture();
    missing.options.expectedOwnerFileIds=['not_found'];
    await expect(inspectAppwriteAdminSourceGrants(missing.options))
      .rejects.toThrow(/owner file missing/);
    const dup=fixture();
    dup.options.expectedOwnerFileIds=['file_1','file_1'];
    dup.options.ownerCounts[MOSAIC_BUCKET.id]=2;
    await expect(inspectAppwriteAdminSourceGrants(dup.options))
      .rejects.toThrow(/duplicate/);
    const empty=fixture();
    empty.options.expectedOwnerFileIds=[];
    await expect(inspectAppwriteAdminSourceGrants(empty.options))
      .rejects.toThrow(/counted owner inventory/);
  });
  it('rejects missing Functions, malformed Function scope metadata and changed Function state',async()=>{
    const missing=fixture();
    missing.options.expectedFunctionCount=3;
    await expect(inspectAppwriteAdminSourceGrants(missing.options))
      .rejects.toThrow(/independent privileged Function count/);
    const malformed=fixture();
    malformed.functions[0].scopes=[null] as never;
    await expect(inspectAppwriteAdminSourceGrants(malformed.options))
      .rejects.toThrow(/Function execution scope inventory/);
    const drifting=fixture();
    const original=drifting.request.getMockImplementation()!;
    let times=0;
    drifting.request.mockImplementation(async(method,path)=>{
      if(path.startsWith('/functions?') && ++times===2)
        drifting.mutateFunction(true);
      return original(method,path);
    });
    await expect(inspectAppwriteAdminSourceGrants(drifting.options))
      .rejects.toThrow(/changed between full passes/);
  });
  it('denies unknown endpoint, invalid signed owner, unsupported target and non-GET request',async()=>{
    const h=fixture();
    await expect(inspectAppwriteAdminSourceGrants({
      ...h.options,endpoint:'http://untrusted.example/v1',
    })).rejects.toThrow(/missing source target/);
    await expect(inspectAppwriteAdminSourceGrants({
      ...h.options,ownerId:'_bad',
    })).rejects.toThrow(/missing source target/);
    await expect(inspectAppwriteAdminSourceGrants({
      ...h.options,databaseId:'other',
    })).rejects.toThrow(/missing source target/);
    expect(h.request).not.toHaveBeenCalled();
    const notFound=fixture();
    notFound.request.mockRejectedValue(new Error('secrets and backend URL must not print'));
    await expect(inspectAppwriteAdminSourceGrants(notFound.options))
      .rejects.toThrow(/request denied or failed/);
  });
});
