import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {invoke,makeMockDb,type MockDb} from '../helpers/invoke-handler';
const req=createRequire(import.meta.url);
const {requestIdFor,acceptedTaskIdFor,eventMessageIdFor}=req('../../appwrite-functions/message-action/task-requests.js');
const {createHash}=req('node:crypto');
const a='test_sender',b='test_recipient';
const fId=(left:string,right:string)=>'fr_'+createHash('sha256').update(left+'|'+right).digest('hex').slice(0,32);
const friendshipTime='2026-11-20T00:00:00.000Z';
const proposed={action:'task_requests',operation:'send',recipientId:b,
  operationId:'operation_1',title:'Send math homework',note:'No private memo',suggestedDate:'2026-11-24'};
describe('consent-based task requests (server Function)',()=>{
  let db:MockDb,rows:Map<string,Record<string,any>>, friends:boolean, consent:boolean;
  beforeEach(()=>{
    db=makeMockDb();rows=new Map();friends=true;consent=true;
    db.getRow.mockImplementation(async({tableId,rowId}:{tableId:string,rowId:string})=>{
      if(tableId==='friendships'&&[fId(a,b),fId(b,a)].includes(rowId))
        return {status:friends?'accepted':'blocked',deleted:false,updated_at:friendshipTime};
      if(tableId==='categories'&&rowId==='category_valid')
        return {$id:rowId,user_id:b,deleted:false,started_on:'',retired_on:''};
      if(tableId==='settings'&&rowId.includes('allowTaskRequestsFromFriends'))
        return {user_id:b,key:'allowTaskRequestsFromFriends',deleted:false,value:String(consent)};
      const existing=rows.get(tableId+'/'+rowId);
      if(existing)return existing;
      throw Object.assign(new Error('Not found'),{code:404});
    });
    db.listRows.mockResolvedValue({rows:[]});
    db.createRow.mockImplementation(async({tableId,rowId,data,permissions}:any)=>{
      const row={$id:rowId,$updatedAt:data.updated_at||data.created_at,...data,$permissions:permissions};
      rows.set(tableId+'/'+rowId,row);
      return row;
    });
    db.updateRow.mockImplementation(async({tableId,rowId,data}:any)=>{
      const row=rows.get(tableId+'/'+rowId);
      if(!row)throw Object.assign(new Error('Not found'),{code:404});
      const next={...row,...data,$updatedAt:data.updated_at||row.$updatedAt};
      rows.set(tableId+'/'+rowId,next);
      return next;
    });
  });
  const send=()=>invoke({userId:a,mockDb:db,body:proposed});
  it('uses stable safe IDs and does not expose recipient-owned task identifiers',()=>{
    expect(requestIdFor(a,'operation_1')).toMatch(/^treq_[a-f0-9]{30}$/);
    expect(acceptedTaskIdFor('treq_demo')).toMatch(/^rtask_[a-f0-9]{30}$/);
    expect(eventMessageIdFor('treq_demo','created')).toMatch(/^msg_[a-f0-9]{30}$/);
  });
  it('atomically creates a pending server-only request and bilateral immutable messages',async()=>{
    const result=await send();
    expect(result.status).toBe(200);
    const requestId=requestIdFor(a,'operation_1');
    expect(result.body.item).toMatchObject({id:requestId,title:proposed.title,status:'pending',recipientId:b});
    expect(result.body.item).not.toHaveProperty('acceptedTaskId');
    expect(db.createRow).toHaveBeenCalledTimes(3);
    expect(db.createRow).toHaveBeenCalledWith(expect.objectContaining({
      tableId:'task_requests',rowId:requestId,transactionId:'tx',permissions:[]}));
    expect(db.createRow.mock.calls.filter(([params]:any[])=>params.tableId==='messages'))
      .toHaveLength(2);
    for(const [params] of db.createRow.mock.calls){
      expect(params.transactionId).toBe('tx');
      if(params.tableId==='messages'){
        expect(params.permissions).toHaveLength(1);
        expect(params.permissions[0]).toMatch(/^read\(/);
        expect(params.data).toMatchObject({task_request_id:requestId,task_request_event:'created'});
        expect(params.data).not.toHaveProperty('memo');
      }
    }
    expect(db.updateTransaction).toHaveBeenCalledWith({transactionId:'tx',commit:true});
  });
  it('replays the same operation without another write',async()=>{
    expect((await send()).status).toBe(200);
    const prior=db.createRow.mock.calls.length;
    const replay=await send();
    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);
    expect(db.createRow).toHaveBeenCalledTimes(prior);
  });
  it('refuses non-friends, opted-out recipients, self-sends and forged operation IDs',async()=>{
    friends=false;
    expect((await send()).status).toBe(403);
    friends=true;consent=false;
    expect((await send()).status).toBe(403);
    expect((await invoke({userId:a,mockDb:db,body:{...proposed,recipientId:a}})).status).toBe(400);
    expect((await invoke({userId:a,mockDb:db,body:{...proposed,operationId:'bad-id'}})).status).toBe(400);
    expect(db.createRow).not.toHaveBeenCalled();
  });
  it('accepts once into a private recipient-owned row without sender disclosure',async()=>{
    const created=await send();
    const requestId=created.body.item.id,revision=created.body.item.revision;
    const body={action:'task_requests',operation:'accept',requestId,
      operationId:'accept_1',expectedRevision:revision,
      categoryId:'category_valid',date:'2026-11-24',ownerLocalDate:new Date().toISOString().slice(0,10)};
    expect((await invoke({userId:a,mockDb:db,body})).status).toBe(403);
    const response=await invoke({userId:b,mockDb:db,body});
    expect(response.status).toBe(200);
    expect(response.body.item.status).toBe('accepted');
    expect(JSON.stringify(response.body)).not.toContain(acceptedTaskIdFor(requestId));
    const task=rows.get('tasks/'+acceptedTaskIdFor(requestId));
    expect(task).toMatchObject({user_id:b,title:proposed.title,visibility:'private',
      category_id:'category_valid',is_completed:false,date:'2026-11-24'});
    expect(task?.$permissions).toEqual(['read("user:'+b+'")']);
    expect((await invoke({userId:b,mockDb:db,body})).body.duplicate).toBe(true);
    expect(db.createRow.mock.calls.filter(([x]:any[])=>x.tableId==='tasks')).toHaveLength(1);
    const senderRead=await invoke({userId:a,mockDb:db,body:{action:'task_requests',operation:'get',requestId}});
    expect(JSON.stringify(senderRead.body)).not.toContain(acceptedTaskIdFor(requestId));
  });
  it('refuses revoked friendship and stale revisions before any acceptance mutation',async()=>{
    const created=await send(),requestId=created.body.item.id;
    const body={action:'task_requests',operation:'accept',requestId,operationId:'a1',
      expectedRevision:'stale',categoryId:'category_valid',date:'',ownerLocalDate:new Date().toISOString().slice(0,10)};
    expect((await invoke({userId:b,mockDb:db,body})).status).toBe(409);
    friends=false;
    expect((await invoke({userId:b,mockDb:db,body:{...body,expectedRevision:created.body.item.revision}})).status).toBe(403);
    expect(db.createRow.mock.calls.filter(([x]:any[])=>x.tableId==='tasks')).toHaveLength(0);
  });
  it('denies ordinary unsend and reactions on canonical request chat events',async()=>{
    await send();
    const eventId=eventMessageIdFor(requestIdFor(a,'operation_1'),'created');
    const unsend=await invoke({userId:a,mockDb:db,body:{action:'unsend',messageId:eventId,recipientId:b}});
    expect(unsend.status).toBe(403);
    const react=await invoke({userId:a,mockDb:db,body:{
      action:'react',myRowId:eventId,recipientId:b,emoji:'❤️',op:'add',
    }});
    expect(react.status).toBe(403);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
