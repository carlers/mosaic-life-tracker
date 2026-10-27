#!/usr/bin/env node
/**
 * Disposable synthetic owner Settings byte/GoTrue proof across age restore.
 * No hosted endpoints or real account credentials. Private fixture stays 0600
 * in the GitHub runner's temporary directory and is erased by lab cleanup.
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const base = process.env.MOSAIC_SETTINGS_RESTORE_URL;
const key = process.env.MOSAIC_SETTINGS_RESTORE_KEY;
const path = process.env.MOSAIC_SETTINGS_RESTORE_FIXTURE;
const phase = process.argv[2];
if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.MOSAIC_REAL_AUTH_RECOVERY_LAB !== '1' ||
    !/^http:\/\/127\.0\.0\.1:(?:54321|3[2-9]\d{3}|4[0-6]\d{3}|47000)$/.test(base || '') ||
    !key?.startsWith('sb_publishable_') ||
    !path?.startsWith((process.env.RUNNER_TEMP || '/invalid') + '/') ||
    !['seed','verify'].includes(phase)) {
  throw new Error('Refusing non-disposable synthetic Settings recovery');
}
const check = (ok, name) => { if (!ok) throw new Error(name); };
async function call(route, { method='GET', token, body }={}) {
  const response=await fetch(base+route,{
    method, redirect:'error', cache:'no-store',
    headers:{apikey:key,Authorization:'Bearer '+(token||key),
      ...(body===undefined?{}:{'content-type':'application/json',Prefer:'return=representation'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  let data;
  try { data=await response.json(); } catch { data=null; }
  return { status:response.status, body:data };
}
async function good(p, context) {
  const result=await p;
  check(result.status>=200 && result.status<300,
    'Signed disposable Settings '+context+' HTTP '+result.status);
  return result.body;
}
async function newAccount(prefix) {
  const email=prefix+randomBytes(9).toString('hex')+'@example.org';
  const password='A9!'+randomBytes(20).toString('hex');
  const auth=await good(call('/auth/v1/signup',{method:'POST',body:{email,password}}),
    'account enrollment');
  check(typeof auth.user?.id==='string','Local GoTrue owner missing');
  const session=await good(call('/auth/v1/token?grant_type=password',{
    method:'POST',body:{email,password},
  }),'account password grant');
  check(session.user?.id===auth.user.id && typeof session.access_token==='string',
    'Signed owner token mismatch');
  return {email,password,owner:auth.user.id,token:session.access_token};
}
async function lease(user) {
  const body=await good(call('/rest/v1/rpc/mosaic_core_session',{
    method:'POST',token:user.token,body:{p_action:'acquire'},
  }),'owner authority');
  check(body.ownerId===user.owner,'Signed owner lease mismatch');
  if (process.env.MOSAIC_ACCOUNT_REGISTRY_LAB==='1') await good(call('/rest/v1/rpc/mosaic_account_status',{
    method:'POST',token:user.token,body:{p_start_mode:'fresh'},
  }),'signed fresh-data consent');
}
if (phase==='seed') {
  const owner=await newAccount('settings-restore-');
  await lease(owner);
  const settingId='setting_restore_'+randomBytes(5).toString('hex');
  const value='{"mode":"🌙","user":"opaque"}';
  const saved=await good(call('/rest/v1/mosaic_candidate_settings',{
    method:'POST',token:owner.token,
    body:{owner_id:owner.owner,id:settingId,setting_key:'calendarZoomDays',
      setting_value:value,updated_at:'2026-10-25T12:00:00Z',is_deleted:false},
  }),'Settings create');
  check(saved.length===1 && saved[0].owner_id===owner.owner &&
    BigInt(saved[0].change_seq)>0n,'Settings initial owner revision');
  const result=await good(call('/rest/v1/rpc/mosaic_candidate_cas_setting',{
    method:'POST',token:owner.token,
    body:{p_id:settingId,p_expected_seq:String(saved[0].change_seq),
      p_patch:{is_deleted:true,updated_at:'2026-10-25T12:01:00Z'}},
  }),'Settings tombstone CAS');
  check(result.id===settingId && result.is_deleted===true &&
    BigInt(result.change_seq)>BigInt(saved[0].change_seq),'Settings deleted revision');
  // File contains synthetic credentials only, never real account details.
  await writeFile(path,JSON.stringify({email:owner.email,password:owner.password,
    ownerId:owner.owner,settingId,value,revision:String(result.change_seq)}),
  {mode:0o600,flag:'wx'});
  console.log('MOSAIC_SETTINGS_SYNTHETIC_SIGNED_SOURCE_PASS');
} else {
  const {email,password,ownerId,settingId,value,revision}
    =JSON.parse(await readFile(path,'utf8'));
  const signed=await good(call('/auth/v1/token?grant_type=password',{
    method:'POST',body:{email,password},
  }),'restored original password');
  check(signed.user?.id===ownerId && typeof signed.access_token==='string',
    'Restored owner account mismatch');
  const user={owner:ownerId,token:signed.access_token};
  const who=await good(call('/auth/v1/user',{token:user.token}),'restored identity');
  check(who.id===ownerId,'Restored signed principal mismatch');
  await lease(user);
  const rows=await good(call('/rest/v1/mosaic_candidate_settings?select=*&id=eq.'+
    encodeURIComponent(settingId),{token:user.token}),'restored Settings owner read');
  check(Array.isArray(rows)&&rows.length===1&&rows[0].owner_id===ownerId&&
    rows[0].setting_value===value&&rows[0].is_deleted===true&&
    String(rows[0].change_seq)===revision,'Restored signed Settings bytes/revision changed');
  const other=await newAccount('settings-foreign-');
  await lease(other);
  const foreign=await good(call('/rest/v1/mosaic_candidate_settings?select=id&owner_id=eq.'+
    encodeURIComponent(ownerId),{token:other.token}),'foreign Settings read');
  check(Array.isArray(foreign)&&foreign.length===0,'Restored Settings leaked cross-owner');
  const forge=await good(call('/rest/v1/rpc/mosaic_candidate_cas_setting',{
    method:'POST',token:other.token,
    body:{p_id:settingId,p_expected_seq:revision,
      p_patch:{is_deleted:false,setting_value:'forged'}},
  }),'foreign Settings CAS');
  // A PostgreSQL composite RPC can serialize "no affected row" as an
  // object whose every field is null. The existing signed Settings lab
  // already recognizes this format. Never accept a populated foreign row.
  const denied = forge===null || (forge && typeof forge==='object' &&
    !Array.isArray(forge) && Object.keys(forge).length>0 &&
    Object.values(forge).every(value=>value===null));
  check(denied,'Restored Settings foreign-owner CAS returned real row');
  // Verify the actual stored owner row AGAIN after the adversarial write;
  // response shape alone must not be mistaken for proof of isolation.
  const after=await good(call('/rest/v1/mosaic_candidate_settings?select=*&id=eq.'+
    encodeURIComponent(settingId),{token:user.token}),'post-foreign owned read');
  check(Array.isArray(after) && after.length===1 &&
    after[0].owner_id===ownerId && after[0].setting_value===value &&
    after[0].is_deleted===true && String(after[0].change_seq)===revision,
    'Foreign-owner CAS changed the restored Settings contents/revision');
  console.log('MOSAIC_SETTINGS_SIGNED_EIGHT_TABLE_RESTORED_PASS');
}
