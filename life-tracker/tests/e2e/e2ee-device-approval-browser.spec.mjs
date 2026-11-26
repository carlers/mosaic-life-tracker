import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Device approval preflight proof requires localhost');
test.use({ignoreHTTPSErrors:true});

test('ephemeral new-device request is human-bound, short-lived and never sends a key',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const module=await import('/src/lib/e2ee/deviceApprovalPreflight.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_device_approval_owner'};
    const kid='k_'+'c'.repeat(32),now=Date.now();
    const ready={assertReady:async scope=>{
      if(scope.ownerId!==owner.ownerId)throw Error('Wrong completed MFA owner');
    }};
    const newDevice=await module.createNewDeviceApprovalRequest(
      owner,'synthetic_new_phone',kid,3,now,ready);
    const {request,privateKey}=newDevice;
    const publicTranscript=JSON.stringify(request);
    const fingerprint=await module.deviceRequestFingerprint(request);
    const accepted=await module.requireMatchedDeviceApprovalRequest(
      request,owner,'synthetic_existing_laptop',
      kid,3,now+1000,fingerprint,ready);
    const denied=async(candidate,scope=owner,oldKid=kid,epoch=3,at=now+1000,
      typed=fingerprint,gate=ready)=>
      module.requireMatchedDeviceApprovalRequest(candidate,scope,
        'synthetic_existing_laptop',oldKid,epoch,at,typed,gate)
        .then(()=>false,()=>true);
    const checks={
      wrongOwner:await denied(request,{...owner,ownerId:'synthetic_stranger'}),
      wrongProject:await denied(request,{...owner,projectId:'production'}),
      wrongKey:await denied(request,owner,'k_'+'d'.repeat(32)),
      wrongGeneration:await denied(request,owner,kid,4),
      wrongFingerprint:await denied(request,owner,kid,3,now+1000,'0'.repeat(29)),
      expired:await denied(request,owner,kid,3,now+5*60*1000),
      extraSecret:await denied({...request,rootPlaintext:'UNSAFE'}),
      alteredNonce:await denied({...request,nonce:'n_'+'f'.repeat(32)}),
      malformedPublic:await denied({...request,ephemeralPublicKey:'A'.repeat(87)}),
      futureTimestamp:await denied({...request,createdAt:now+60000,
        expiresAt:now+60000+5*60*1000}),
      sameDevice:await module.requireMatchedDeviceApprovalRequest(
        request,owner,request.newDeviceId,kid,3,now,fingerprint,ready)
        .then(()=>false,()=>true),
      mfaPending:await denied(request,owner,kid,3,now+1000,fingerprint,
        {assertReady:async()=>{throw Error('MFA pending');}}),
    };
    const noRootInRequest=![
      'rootPlaintext','recoverySecret','privateKey','rootEnvelope',
    ].some(term=>publicTranscript.includes(term));
    return {status:accepted.status,fingerprint:accepted.fingerprint,
      privateExtractable:privateKey.extractable,
      noRootInRequest,checks,
      ephemeralPublic:request.ephemeralPublicKey.length,
      nonceUnique:request.nonce!==request.requestId};
  });
  expect(result).toMatchObject({
    status:'fingerprint-matched-not-approved',privateExtractable:false,
    noRootInRequest:true,ephemeralPublic:87,nonceUnique:true,
  });
  expect(result.fingerprint).toMatch(/^(?:[a-f0-9]{4}-){5}[a-f0-9]{4}$/);
  expect(Object.values(result.checks).every(Boolean)).toBe(true);
  expect(writes).toBe(0);
});
