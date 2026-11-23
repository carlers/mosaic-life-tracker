import {describe,expect,it,vi} from 'vitest';
import {migrateTaskRequestsBackend} from '../../scripts/migrate-task-requests.mjs';
import {MOSAIC_TABLES} from '../../infrastructure/mosaic-backend.mjs';
const table=MOSAIC_TABLES.find(row=>row.id==='task_requests')!;
const fields=MOSAIC_TABLES.find(row=>row.id==='messages')!.columns
  .filter(col=>['task_request_id','task_request_event'].includes(col.key));
function found(){return Object.assign(new Error('missing'),{status:404});}
describe('task request additive migration',()=>{
  it('creates only a server-owned table and 2 optional message fields',async()=>{
    const created=new Map<string,any>();
    const request=vi.fn(async(method:string,path:string,data?:any)=>{
      if(method==='GET'){
        if(path.endsWith('/task_requests'))throw found();
        if(path.endsWith('/messages'))return {$id:'messages'};
        const val=created.get(path);
        if(val)return val;
        throw found();
      }
      if(method==='POST' && path.endsWith('/tables'))return data;
      if(method==='POST' && path.includes('/messages/columns/varchar')){
        const key=data.key;
        created.set(path.replace(/\/varchar$/,'/'+key),{...data,type:'varchar',status:'available'});
        return {};
      }
      throw Error('Unexpected '+method+' '+path);
    });
    const result=await migrateTaskRequestsBackend({request,sleep:async()=>{}});
    expect(result).toEqual({table:'task_requests',created:true,messageColumnsAdded:2});
    const posts=request.mock.calls.filter(([method])=>method==='POST');
    expect(posts).toHaveLength(3);
    expect(posts[0][2]).toMatchObject({tableId:'task_requests',rowSecurity:true,permissions:[]});
    expect(posts[0][2].indexes).toEqual(table.indexes);
  });
  it('verifies existing table permissions and message columns without changes',async()=>{
    const request=vi.fn(async(method:string,path:string)=>{
      expect(method).toBe('GET');
      if(path.endsWith('/task_requests'))return {
        $id:'task_requests',rowSecurity:true,enabled:true,$permissions:[],
        columns:table.columns,indexes:table.indexes,
      };
      if(path.endsWith('/messages'))return {$id:'messages'};
      const field=fields.find(col=>path.endsWith('/'+col.key));
      if(field)return {...field,status:'available'};
      throw Error('Unexpected path '+path);
    });
    expect((await migrateTaskRequestsBackend({request})).messageColumnsAdded).toBe(0);
    expect(request.mock.calls.some(([m])=>m==='POST')).toBe(false);
  });
  it('fails closed when an existing request table grants client access',async()=>{
    const request=vi.fn(async(method:string,path:string)=>{
      if(method==='GET' && path.endsWith('/task_requests'))return {
        $id:'task_requests',rowSecurity:true,enabled:true,$permissions:['create("users")'],
      };
      throw Error('Unexpected');
    });
    await expect(migrateTaskRequestsBackend({request})).rejects.toThrow(/Incompatible/);
  });
});
