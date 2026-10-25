/** #1027 signed two-owner Bucket List/link contract; disposable local CLI only. */
import { randomBytes } from 'node:crypto';
const base=process.env.MOSAIC_SB_LOCAL_URL;
const key=process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
if(!['http://127.0.0.1:54321','http://localhost:54321'].includes(base) ||
   !key?.startsWith('sb_publishable_')) throw Error('Loopback disposable Supabase required');
const suffix=randomBytes(6).toString('hex');
const stamp='2026-10-25T12:00:00.000Z';
function ok(cond,what){if(!cond)throw Error(what);}
function denied(r){return r.status===401||r.status===403;}
async function req(path,{method='GET',token,body}={}){
 return fetch(base+path,{method,redirect:'error',cache:'no-store',headers:{
  apikey:key,...(token?{Authorization:'Bearer '+token}:{}),
  ...(body===undefined?{}:{'content-type':'application/json',Prefer:'return=representation'}),
 },...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function data(response,label){
 ok(response.ok,label+' HTTP '+response.status);
 return response.json();
}
async function signup(label){
 const email='bucket-'+suffix+label+'@example.org';
 const password='Aa!9'+randomBytes(18).toString('hex');
 const s=await data(await req('/auth/v1/signup',{method:'POST',body:{email,password}}),'signup');
 const t=await data(await req('/auth/v1/token?grant_type=password',
  {method:'POST',body:{email,password}}),'password grant');
 const u=await data(await req('/auth/v1/user',{token:t.access_token}),'signed user');
 ok(u.id===s.user?.id,'signed owner mismatch');
 const user={owner:u.id,token:t.access_token};
 const lease=await data(await req('/rest/v1/rpc/mosaic_core_session',
  {method:'POST',token:user.token,body:{p_action:'acquire'}}),'authority');
 ok(lease.ownerId===user.owner,'authority owner mismatch');
 return user;
}
async function insert(user,table,row){
 return req('/rest/v1/'+table,{method:'POST',token:user.token,body:row});
}
async function read(user,table,owner){
 return data(await req('/rest/v1/'+table+'?select=*&owner_id=eq.'+owner,
  {token:user.token}),'private owner read');
}
async function cas(user,kind,id,seq,patch){
 return req('/rest/v1/rpc/mosaic_candidate_cas_'+kind,{
  method:'POST',token:user.token,body:{p_id:id,p_expected_seq:String(seq),p_patch:patch}});
}
function normalized(value){
 if(value===null)return null;
 if(value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length>0&&Object.values(value).every(v=>v===null))return null;
 return value;
}
const alice=await signup('alice'),bob=await signup('bob');
ok(alice.owner!==bob.owner,'duplicate signed accounts');
const categories='mosaic_candidate_categories',tasks='mosaic_candidate_tasks';
const buckets='mosaic_candidate_buckets',links='mosaic_candidate_bucket_task_links';
const bId='bucket_'+suffix,tId='task_'+suffix,lId='link_'+suffix;
const category='cat_'+suffix;
let r=await insert(alice,categories,{owner_id:alice.owner,id:category,
 name:'Private',color:'#888888',order_index:0,updated_at:stamp,is_deleted:false});
ok(r.status===201,'seed owned category failed '+r.status);
r=await insert(alice,tasks,{owner_id:alice.owner,id:tId,title:'Private task',
 completed:false,category_id:category,order_index:0,task_date:'2026-10-25',
 created_at:stamp,updated_at:stamp,is_deleted:false});
ok(r.status===201,'seed owned task failed '+r.status);
const ownedBucket={owner_id:alice.owner,id:bId,title:'Plan 🌙',
 description:'Private goal',achieved:false,achieved_at:'',created_at:stamp,
 updated_at:stamp,is_deleted:false};
const pre=await req('/rest/v1/'+buckets+'?select=id');
ok(denied(pre),'anonymous Bucket SELECT accepted');
const noLeaseBob=await insert(bob,buckets,{...ownedBucket,owner_id:bob.owner,id:'bob_'+suffix});
ok(noLeaseBob.status===201,'second signed owner own Bucket INSERT refused');
r=await insert(alice,buckets,ownedBucket);
ok(r.status===201,'owner Bucket INSERT failed '+r.status);
const bucketRow=(await data(r,'Bucket create'))[0];
ok(BigInt(bucketRow.change_seq)>0n,'Bucket stamp revision absent');
const foreign=await read(bob,buckets,alice.owner);
ok(foreign.length===0,'cross-owner Bucket read leak');
r=await insert(bob,buckets,{...ownedBucket,id:'foreign_'+suffix});
ok(denied(r),'foreign Bucket INSERT allowed');
r=await insert(alice,links,{owner_id:alice.owner,id:lId,bucket_list_id:bId,
 task_id:tId,created_at:stamp,updated_at:stamp,is_deleted:false});
ok(r.status===201,'owner READY link INSERT failed '+r.status);
const linkRow=(await data(r,'link create'))[0];
ok(BigInt(linkRow.change_seq)>0n,'Link stamp revision absent');
ok((await read(bob,links,alice.owner)).length===0,'cross-owner link read leak');
r=await insert(alice,links,{owner_id:alice.owner,id:'missing_'+suffix,
 bucket_list_id:bId,task_id:'not_found_'+suffix,created_at:stamp,updated_at:stamp});
ok(r.status===409 || r.status===400,'dangling target link inserted');
const deletedBucket='deleted_'+suffix;
r=await insert(alice,buckets,{...ownedBucket,id:deletedBucket,is_deleted:true});
ok(r.status===201,'seed tombstone Bucket failed '+r.status);
r=await insert(alice,links,{owner_id:alice.owner,id:'tomb_target_'+suffix,
 bucket_list_id:deletedBucket,task_id:tId,created_at:stamp,updated_at:stamp,
 is_deleted:false});
ok(r.status===409||r.status===400,'active link to deleted Bucket accepted');
r=await insert(bob,links,{owner_id:bob.owner,id:'cross_'+suffix,
 bucket_list_id:bId,task_id:tId,created_at:stamp,updated_at:stamp});
ok(r.status===409 || r.status===400,'foreign-owner link target accepted');
for(const table of [buckets,links]){
 const resp=await req('/rest/v1/'+table+'?id=eq.'+(table===buckets?bId:lId),{
  method:'PATCH',token:alice.token,body:{is_deleted:true}});
 ok(denied(resp),'direct UPDATE permitted '+table);
 const del=await req('/rest/v1/'+table+'?id=eq.'+(table===buckets?bId:lId),
  {method:'DELETE',token:alice.token});
 ok(denied(del),'direct DELETE permitted '+table);
}
r=await cas(alice,'bucket',bId,bucketRow.change_seq,{title:'Updated 🏊',updated_at:stamp});
const updated=normalized(await data(r,'Bucket CAS'));
ok(updated?.title==='Updated 🏊'&&
 BigInt(updated.change_seq)>BigInt(bucketRow.change_seq),'Bucket CAS failed');
r=await cas(alice,'bucket',bId,bucketRow.change_seq,{title:'stale'});
ok(normalized(await data(r,'stale CAS'))===null,'stale CAS overwrote Bucket');
r=await cas(bob,'bucket',bId,updated.change_seq,{title:'foreign'});
ok(normalized(await data(r,'foreign CAS'))===null,'foreign CAS overwrote Bucket');
for(const patch of [{owner_id:bob.owner},{id:'hijack'},{change_seq:1},{}]){
 r=await cas(alice,'bucket',bId,updated.change_seq,patch);
 ok(r.status>=400&&r.status<500,'invalid Bucket patch accepted');
}
for(const patch of [{task_id:'hijack'},{bucket_list_id:'hijack'},{owner_id:bob.owner}]){
 r=await cas(alice,'bucket_link',lId,linkRow.change_seq,patch);
 ok(r.status>=400&&r.status<500,'link reference redirection accepted');
}
r=await cas(alice,'bucket_link',lId,linkRow.change_seq,{is_deleted:true,updated_at:stamp});
const tomb=normalized(await data(r,'link tombstone CAS'));
ok(tomb?.is_deleted===true&&tomb.task_id===tId&&
 BigInt(tomb.change_seq)>BigInt(linkRow.change_seq),'link tombstone lost identity/revision');
const changed=await data(await req('/rest/v1/'+links+
 '?select=id,is_deleted,change_seq&owner_id=eq.'+alice.owner+
 '&change_seq=gt.'+linkRow.change_seq,{token:alice.token}),'link cursor');
ok(changed.length===1&&changed[0].id===lId&&changed[0].is_deleted===true,
 'link deletion not replayed by cursor');
console.log('MOSAIC_BUCKET_LINK_SIGNED_TWO_OWNER_PASS');
