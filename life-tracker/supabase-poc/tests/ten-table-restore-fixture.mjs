#!/usr/bin/env node
/** #1027 signed, two-owner Bucket+task-link byte proof across an actual
 * age-encrypted PostgreSQL17 restore. Ephemeral GitHub local Supabase ONLY.
 */
import {randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.MOSAIC_SETTINGS_RESTORE_URL;
const key=process.env.MOSAIC_SETTINGS_RESTORE_KEY;
const path=process.env.MOSAIC_BUCKET_RESTORE_FIXTURE;
const phase=process.argv[2];
if(process.env.GITHUB_ACTIONS!=='true' ||
 process.env.MOSAIC_REAL_AUTH_RECOVERY_LAB!=='1' ||
 !/^http:\/\/127\.0\.0\.1:(?:54321|3[2-9]\d{3}|4[0-6]\d{3}|47000)$/.test(base||'') ||
 !key?.startsWith('sb_publishable_') ||
 !path?.startsWith((process.env.RUNNER_TEMP||'/invalid')+'/') ||
 !['seed','verify'].includes(phase)) throw Error('Refusing non-disposable Bucket recovery');
function check(x,message){if(!x)throw Error(message);}
async function request(route,{method='GET',token,body}={}){
 const res=await fetch(base+route,{method,redirect:'error',cache:'no-store',
 headers:{apikey:key,Authorization:'Bearer '+(token||key),
 ...(body===undefined?{}:{'content-type':'application/json',Prefer:'return=representation'})},
 ...(body===undefined?{}:{body:JSON.stringify(body)})});
 let value;try{value=await res.json();}catch{value=null;}
 return {status:res.status,body:value};
}
async function good(p,label){
 const x=await p;check(x.status>=200&&x.status<300,
   'Signed private bucket '+label+' HTTP '+x.status);return x.body;
}
async function signin(email,password){
 return good(request('/auth/v1/token?grant_type=password',
  {method:'POST',body:{email,password}}),'password sign-in');
}
async function newOwner(){
 const email='buckets-restore-'+randomBytes(9).toString('hex')+'@example.org';
 const password='Aa!9'+randomBytes(24).toString('hex');
 const user=await good(request('/auth/v1/signup',{method:'POST',
  body:{email,password}}),'owner signup');
 const session=await signin(email,password);
 check(user.user?.id===session.user?.id&&typeof session.access_token==='string',
  'Local signed GoTrue owner mismatch');
 return {email,password,ownerId:user.user.id,token:session.access_token};
}
async function lease(user){
 const authority=await good(request('/rest/v1/rpc/mosaic_core_session',{
  method:'POST',token:user.token,body:{p_action:'acquire'}}),'owner authority');
 check(authority.ownerId===user.ownerId,'Wrong owner authority');
}
const registryEnabled=process.env.MOSAIC_ACCOUNT_REGISTRY_LAB==='1';
async function registry(user,mode=null){
 return good(request('/rest/v1/rpc/mosaic_account_status',{method:'POST',token:user.token,
  body:{p_start_mode:mode}}),'account registry');
}
const prefix='ci_'+randomBytes(7).toString('hex');
if(phase==='seed'){
 const user=await newOwner();await lease(user);
 const accountRegistry=registryEnabled?await registry(user,'recovery-pending'):null;
 const now='2026-10-25T12:00:00Z';
 const category='cat_'+prefix,task='task_'+prefix,bucket='bucket_'+prefix;
 const liveLink='link_live_'+prefix,deadLink='link_tomb_'+prefix;
 const categorySeed=await good(request('/rest/v1/mosaic_candidate_categories',{
   method:'POST',token:user.token,
   body:{owner_id:user.ownerId,id:category,name:'Signed private',
     color:'#888888',order_index:0,updated_at:now,is_deleted:false}}),'category seed');
 if(registryEnabled){
   check(Array.isArray(categorySeed)&&categorySeed.length===1,
     'Missing source category row for retirement proof');
   const retired=await good(request('/rest/v1/rpc/mosaic_candidate_cas_category',{
     method:'POST',token:user.token,body:{p_id:category,
       p_expected_seq:String(categorySeed[0].change_seq),
       p_patch:{retired_on:'2026-10-27',updated_at:now}}}),
       'source category retirement CAS');
   check(retired?.retired_on==='2026-10-27',
     'Source category retirement metadata was not stored');
 }
 await good(request('/rest/v1/mosaic_candidate_tasks',{
   method:'POST',token:user.token,
   body:{owner_id:user.ownerId,id:task,title:'Task 🌙',
     category_id:category,completed:false,order_index:0,task_date:'2026-10-25',
     created_at:now,updated_at:now,is_deleted:false}}),'task seed');
 const bucketRows=await good(request('/rest/v1/mosaic_candidate_buckets',{
   method:'POST',token:user.token,
   body:{owner_id:user.ownerId,id:bucket,title:'Learn 🏊',description:'exact private note',
     achieved:false,achieved_at:'',created_at:now,updated_at:now,is_deleted:false}}),
   'bucket seed');
 check(bucketRows.length===1&&BigInt(bucketRows[0].change_seq)>0n,'Seed bucket stamp missing');
 const achieved=await good(request('/rest/v1/rpc/mosaic_candidate_cas_bucket',{
   method:'POST',token:user.token,
   body:{p_id:bucket,p_expected_seq:String(bucketRows[0].change_seq),
   p_patch:{achieved:true,achieved_at:now,updated_at:now}}}),'bucket achievement CAS');
 check(achieved.achieved===true&&BigInt(achieved.change_seq)>BigInt(bucketRows[0].change_seq),
  'Bucket achievement revision missing');
 const links=[];
 for(const id of [liveLink,deadLink]){
  const result=await good(request('/rest/v1/mosaic_candidate_bucket_task_links',{
   method:'POST',token:user.token,
   body:{owner_id:user.ownerId,id,bucket_list_id:bucket,task_id:task,
    created_at:now,updated_at:now,is_deleted:false}}),'link seed');
  check(result.length===1&&BigInt(result[0].change_seq)>0n,'Link stamp missing');
  links.push(result[0]);
 }
 const tomb=await good(request('/rest/v1/rpc/mosaic_candidate_cas_bucket_link',{
  method:'POST',token:user.token,
  body:{p_id:deadLink,p_expected_seq:String(links[1].change_seq),
  p_patch:{is_deleted:true,updated_at:now}}}),'link tombstone CAS');
 check(tomb.is_deleted===true&&BigInt(tomb.change_seq)>BigInt(links[1].change_seq),
  'Link deletion revision missing');
 await writeFile(path,JSON.stringify({email:user.email,password:user.password,
  ownerId:user.ownerId,category,task,bucket,liveLink,deadLink,accountRegistry,
  bucketRevision:String(achieved.change_seq),liveRevision:String(links[0].change_seq),
  tombRevision:String(tomb.change_seq)}),{mode:0o600,flag:'wx'});
 console.log('MOSAIC_BUCKET_TEN_TABLE_SIGNED_SOURCE_PASS');
}else{
 const expected=JSON.parse(await readFile(path,'utf8'));
 const {email,password,ownerId,category,bucket,task,liveLink,deadLink,
   bucketRevision,liveRevision,tombRevision}=expected;
 const signed=await signin(email,password);
 check(signed.user?.id===ownerId&&typeof signed.access_token==='string',
  'Restored Bucket owner password failed');
 const owner={ownerId,token:signed.access_token};await lease(owner);
 if(registryEnabled){
  check(JSON.stringify(await registry(owner))===JSON.stringify(expected.accountRegistry),
   'Restored identity/installation/provenance/consent changed');
  check(JSON.stringify(await registry(owner,'recovery-pending'))===JSON.stringify(expected.accountRegistry),
   'Restored pending consent was not idempotent');
 }
 const ownerPath='?select=*&owner_id=eq.'+encodeURIComponent(ownerId);
 if(registryEnabled){
   const categories=await good(request('/rest/v1/mosaic_candidate_categories'+ownerPath,
     {token:owner.token}),'restored retired category');
   check(categories.some(row=>row.id===category&&row.retired_on==='2026-10-27'),
     'Fourteen-table category retirement metadata did not survive exact restore');
 }
 const buckets=await good(request('/rest/v1/mosaic_candidate_buckets'+ownerPath,
  {token:owner.token}),'restored owner Buckets');
 const links=await good(request('/rest/v1/mosaic_candidate_bucket_task_links'+ownerPath,
  {token:owner.token}),'restored owner links');
 const found=buckets.find(row=>row.id===bucket);
 const live=links.find(row=>row.id===liveLink);
 const dead=links.find(row=>row.id===deadLink);
 check(found?.title==='Learn 🏊'&&found.description==='exact private note'&&
   found.achieved===true&&found.is_deleted===false&&
   String(found.change_seq)===bucketRevision,'Restored Bucket values/revision differ');
 check(live?.owner_id===ownerId&&live.bucket_list_id===bucket&&
   live.task_id===task&&live.is_deleted===false&&String(live.change_seq)===liveRevision,
   'Restored READY task link changed owner or identity');
 check(dead?.owner_id===ownerId&&dead.bucket_list_id===bucket&&dead.task_id===task&&
   dead.is_deleted===true&&String(dead.change_seq)===tombRevision,
   'Restored link tombstone or revision lost');
 const attacker=await newOwner();await lease(attacker);
 const hidden=await good(request('/rest/v1/mosaic_candidate_bucket_task_links'+ownerPath,
  {token:attacker.token}),'foreign link read');
 check(Array.isArray(hidden)&&hidden.length===0,'Foreign owner read restored task links');
 const forged=await good(request('/rest/v1/rpc/mosaic_candidate_cas_bucket_link',{
  method:'POST',token:attacker.token,body:{
    p_id:liveLink,p_expected_seq:liveRevision,p_patch:{is_deleted:true}}}),
  'foreign link CAS');
 check(forged===null || (typeof forged==='object'&&!Array.isArray(forged)&&
   Object.keys(forged).length>0&&Object.values(forged).every(v=>v===null)),
  'Foreign link CAS affected owner row');
 const after=await good(request('/rest/v1/mosaic_candidate_bucket_task_links'+ownerPath,
  {token:owner.token}),'post-attack owner link read');
 const original=after.find(row=>row.id===liveLink);
 check(original?.is_deleted===false&&original.task_id===task&&
  String(original.change_seq)===liveRevision,
  'Foreign CAS changed restored owner reference');
 console.log('MOSAIC_BUCKET_TEN_TABLE_REAL_SIGNED_RESTORE_PASS');
}
