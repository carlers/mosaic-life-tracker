/**
 * #1027 real signed personal Settings contract, disposable local Supabase only.
 * Requires local Core authority migration; never targets hosted SQL/Production.
 */
import { randomBytes } from 'node:crypto';
const base = process.env.MOSAIC_SB_LOCAL_URL;
const key = process.env.MOSAIC_SB_LOCAL_PUBLISHABLE_KEY;
if (!['http://127.0.0.1:54321','http://localhost:54321'].includes(base) ||
    !key || !key.startsWith('sb_publishable_')) {
  throw new Error('Private Settings signed test requires disposable loopback Supabase only');
}
const id = randomBytes(7).toString('hex');
const table = 'mosaic_candidate_settings';
const counts = { owners: 0, ownerReads: 0, foreignReadsDenied: 0, anonDenied: 0,
  noLeaseDenied: 0, ownerSpoofDenied: 0, duplicateKeyDenied: 0,
  directWritesDenied: 0, casApplied: 0, staleDenied: 0,
  foreignCasDenied: 0, injectedPatchDenied: 0, tombstones: 0, cursorReplay: 0,
  releasedLeaseDenied: 0 };

function ok(condition, label) { if (!condition) throw new Error(label); }
function denied(response) { return response.status === 401 || response.status === 403; }
async function http(path, { method='GET', token, body }={}) {
  const response = await fetch(base + path, {
    method, redirect:'error', cache:'no-store',
    headers: {
      apikey:key, ...(token?{Authorization:'Bearer '+token}:{}),
      ...(body===undefined?{}:{'content-type':'application/json',Prefer:'return=representation'}),
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  return response;
}
async function json(response, what) {
  if (!response.ok) throw new Error(what + ' failed with HTTP ' + response.status);
  try { return await response.json(); }
  catch { throw new Error(what + ' invalid JSON'); }
}
async function signup(label) {
  const email = 'settings-'+id+'-'+label+'@example.org';
  const password = 'Aa!9'+randomBytes(25).toString('hex');
  const created=await json(await http('/auth/v1/signup',{method:'POST',body:{email,password}}),'local signup');
  ok(typeof created.user?.id==='string','Local GoTrue signup owner absent');
  const grant=await json(await http('/auth/v1/token?grant_type=password',{
    method:'POST',body:{email,password},
  }),'local password grant');
  const token=grant.access_token;
  ok(typeof token==='string' && token.length>40,'Local signed JWT missing');
  const signed=await json(await http('/auth/v1/user',{token}),'local verified owner');
  ok(signed.id===created.user.id,'Signed local GoTrue owner mismatch');
  counts.owners++;
  return { owner:signed.id, token, label };
}
async function acquire(user) {
  const response=await json(await http('/rest/v1/rpc/mosaic_core_session',{
    method:'POST',token:user.token,body:{p_action:'acquire'},
  }),'local exclusive core authority');
  ok(response.ownerId===user.owner && response.backend==='supabase-cloud',
    'Signed local authority did not bind owner and provider');
  if (process.env.MOSAIC_ACCOUNT_REGISTRY_LAB==='1') await json(await http('/rest/v1/rpc/mosaic_account_status',{
    method:'POST',token:user.token,body:{p_start_mode:'fresh'},
  }),'signed fresh-data consent');
}
async function create(user, keyname, idname, value='7', explicitOwner=user.owner) {
  return http('/rest/v1/'+table,{
    method:'POST',token:user.token,body:{owner_id:explicitOwner,id:idname,
      setting_key:keyname,setting_value:value,updated_at:'2026-10-25T00:00:00.000Z',
      is_deleted:false},
  });
}
async function read(user, owner, extra='') {
  return json(await http('/rest/v1/'+table+
    '?select=*&owner_id=eq.'+encodeURIComponent(owner)+extra,{token:user.token}),'private settings read');
}
async function cas(user,idname,rev,patch) {
  return http('/rest/v1/rpc/mosaic_candidate_cas_setting',{
    method:'POST',token:user.token,
    body:{p_id:idname,p_expected_seq:String(rev),p_patch:patch},
  });
}
function normalize(value) {
  if (value===null) return null;
  if (value && typeof value==='object' && !Array.isArray(value) &&
      Object.keys(value).length>0 && Object.values(value).every(v=>v===null)) return null;
  return value;
}
const alice=await signup('a');
const bob=await signup('b');
ok(alice.owner!==bob.owner,'Local GoTrue owners duplicated');
const aId='ci_setting_a_'+id, bId='ci_setting_b_'+id;
const withoutLease=await create(alice,'calendarZoomDays',aId);
ok(denied(withoutLease),'Signed owner without a writer lease inserted Settings');
counts.noLeaseDenied++;
await acquire(alice);
await acquire(bob);
for (const [user,rowId] of [[alice,aId],[bob,bId]]) {
  const res=await create(user,'calendarZoomDays',rowId);
  ok(res.status===201,'Signed owned Settings INSERT returned HTTP '+res.status);
  const rows=await json(res,'inserted settings');
  ok(Array.isArray(rows)&&rows.length===1&&rows[0].owner_id===user.owner&&
     rows[0].id===rowId&&BigInt(rows[0].change_seq)>0n,
     'Signed Settings create lacks authoritative revision or owner');
}
for (const [user,other] of [[alice,bob],[bob,alice]]) {
  const own=await read(user,user.owner);
  ok(own.length===1&&own[0].owner_id===user.owner,'Owned Settings not readable');
  counts.ownerReads++;
  const foreign=await read(user,other.owner);
  ok(foreign.length===0,'Cross-owner Settings SELECT leaked private record');
  counts.foreignReadsDenied++;
}
const anonRead=await http('/rest/v1/'+table+'?select=id');
ok(denied(anonRead),'Anonymous Settings SELECT was permitted');counts.anonDenied++;
const anonCas=await http('/rest/v1/rpc/mosaic_candidate_cas_setting',{
  method:'POST',body:{p_id:aId,p_expected_seq:'1',p_patch:{setting_value:'forged'}},
});
ok(denied(anonCas),'Anonymous Settings CAS was permitted');counts.anonDenied++;
const spoof=await create(alice,'spoof', 'ci_spoof_'+id,'invalid',bob.owner);
ok(denied(spoof),'Foreign Settings INSERT was permitted');counts.ownerSpoofDenied++;
const duplicate=await create(alice,'calendarZoomDays','ci_duplicate_'+id);
ok(duplicate.status===409,'Owner duplicate setting key not blocked');
counts.duplicateKeyDenied++;
for (const method of ['PATCH','DELETE']) {
  const result=await http('/rest/v1/'+table+'?id=eq.'+encodeURIComponent(aId),{
    method,token:alice.token,...(method==='PATCH'?{body:{setting_value:'forged'}}:{}),
  });
  ok(denied(result),'Direct Settings '+method+' was permitted');
  counts.directWritesDenied++;
}
const ownRow=(await read(alice,alice.owner))[0];
const initial=BigInt(ownRow.change_seq);
const written=normalize(await json(await cas(alice,aId,initial,{
  setting_value:'{"color":"🌙"}',updated_at:'2026-10-25T11:30:00.000Z',
}),'applied Settings CAS'));
ok(written?.id===aId&&written.setting_value==='{"color":"🌙"}'&&
   BigInt(written.change_seq)>initial,'Signed CAS failed to advance authoritative row');
counts.casApplied++;
const stale=normalize(await json(await cas(alice,aId,initial,{
  setting_value:'stale',
}),'stale Settings CAS'));
ok(stale===null,'Stale Settings CAS overwrote newer value');counts.staleDenied++;
const foreign=normalize(await json(await cas(bob,aId,written.change_seq,{
  setting_value:'foreign',
}),'foreign Settings CAS'));
ok(foreign===null,'Foreign account Settings CAS succeeded');counts.foreignCasDenied++;
for (const patch of [{owner_id:bob.owner},{setting_key:'hijack'},{change_seq:0},{}]) {
  const res=await cas(alice,aId,written.change_seq,patch);
  ok(res.status>=400&&res.status<500,'Invalid Settings CAS patch accepted');
  counts.injectedPatchDenied++;
}
const deleted=normalize(await json(await cas(alice,aId,written.change_seq,{
  is_deleted:true,
}),'tombstone Settings CAS'));
ok(deleted?.id===aId&&deleted.is_deleted===true&&
   BigInt(deleted.change_seq)>BigInt(written.change_seq),
   'Signed Settings tombstone CAS did not preserve row/revision');
counts.tombstones++;
const changed=await json(await http('/rest/v1/'+table+
  '?select=id,is_deleted,change_seq&owner_id=eq.'+encodeURIComponent(alice.owner)+
  '&change_seq=gt.'+String(written.change_seq)+'&order=change_seq.asc&limit=100',{
    token:alice.token,
  }),'post-tombstone Settings cursor');
ok(changed.length===1&&changed[0].id===aId&&changed[0].is_deleted===true,
   'Settings cursor failed to replay deletion tombstone');
counts.cursorReplay++;
await json(await http('/rest/v1/rpc/mosaic_core_session',{
  method:'POST',token:alice.token,body:{p_action:'release'},
}),'revoke local owner lease');
const afterRelease=await create(alice,'weekStartsOnSunday','ci_released_'+id);
ok(denied(afterRelease),'Released Settings owner lease continued to write');
counts.releasedLeaseDenied++;
console.log(JSON.stringify({ok:true,testEnvironment:'disposable-supabase-cli-only',counts}));
