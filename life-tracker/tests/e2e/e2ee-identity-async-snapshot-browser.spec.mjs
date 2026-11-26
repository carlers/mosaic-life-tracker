import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['localhost','127.0.0.1'].includes(new URL(BASE).hostname))
  throw Error('E2EE identity async-snapshot test requires localhost');
test.use({ignoreHTTPSErrors:true});

test('P-256 recipient and device-approval fingerprints bind immutable original input across async WebCrypto checks',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {
      candidateIdentityFingerprint,pinManuallyVerifiedRecipient,
      requirePinnedRecipientIdentity,requirePrivateRecipientShare,
    }=await import('/src/lib/e2ee/recipientIdentityGate.ts');
    const {
      createNewDeviceApprovalRequest,deviceRequestFingerprint,
    }=await import('/src/lib/e2ee/deviceApprovalPreflight.ts');
    const owner={projectId:'6b00671500279e901846',
      ownerId:'synthetic_async_snapshot_owner'};
    const keyId='k_'+'b'.repeat(32);
    const raw=new Uint8Array(await crypto.subtle.exportKey('raw',
      (await crypto.subtle.generateKey(
        {name:'ECDH',namedCurve:'P-256'},false,['deriveBits'])).publicKey));
    const base64=btoa(String.fromCharCode(...raw))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const recipient={
      projectId:owner.projectId,recipientId:'synthetic_original_recipient',
      deviceId:'synthetic_device_1',algorithm:'P-256',publicKey:base64,
      identityEpoch:1,
    };
    const original=await candidateIdentityFingerprint(owner,recipient);
    const mutable={...recipient};
    const pending=candidateIdentityFingerprint(owner,mutable);
    mutable.recipientId='synthetic_swapped_recipient';
    mutable.deviceId='synthetic_swapped_device';
    mutable.identityEpoch=2;
    const afterMutation=await pending;
    const pinCandidate={...recipient};
    const pendingPin=pinManuallyVerifiedRecipient(owner,pinCandidate,original);
    pinCandidate.recipientId='synthetic_changed_after_call';
    pinCandidate.identityEpoch=5;
    const pin=await pendingPin;
    const requireCandidate={...recipient};
    const pendingTrusted=requirePinnedRecipientIdentity(
      owner,requireCandidate,pin);
    requireCandidate.deviceId='synthetic_changed_after_call';
    const trusted=await pendingTrusted;
    const share={
      owner,recipient:{...recipient},pin,
      visibility:'followers',relationship:'accepted',
      sharingEpoch:3,revocationEpoch:2,
    };
    const pendingShare=requirePrivateRecipientShare(share);
    share.recipient.recipientId='synthetic_changed_after_share';
    share.relationship='blocked';
    const shared=await pendingShare;
    const noSilentKeyChange=await requirePinnedRecipientIdentity(
      owner,{...recipient,identityEpoch:3},pin).then(()=>false,()=>true);
    const gate={assertReady:async scope=>{
      if(scope.projectId!==owner.projectId||scope.ownerId!==owner.ownerId)
        throw Error('Synthetic owner-MFA identity mismatch');
    }};
    const now=1795680000000;
    const created=await createNewDeviceApprovalRequest(
      owner,'synthetic_new_device',keyId,1,now,gate);
    const expectedDevice=await deviceRequestFingerprint(created.request);
    const mutatedRequest={...created.request};
    const pendingDevice=deviceRequestFingerprint(mutatedRequest);
    mutatedRequest.ownerId='synthetic_changed_account';
    mutatedRequest.newDeviceId='synthetic_changed_device';
    mutatedRequest.keyId='k_'+'c'.repeat(32);
    mutatedRequest.rootGeneration=2;
    const actualDevice=await pendingDevice;
    return {
      unchangedFingerprint:afterMutation===original,
      pinOwner:pin.localOwnerId===owner.ownerId,
      pinRecipient:pin.recipientId===recipient.recipientId,
      pinDevice:pin.deviceId===recipient.deviceId,
      pinEpoch:pin.identityEpoch===1,
      trusted:trusted.status==='trusted',
      shared:shared.status==='trusted',
      noSilentKeyChange,
      deviceUnchanged:actualDevice===expectedDevice,
      privateKeyNonextractable:created.privateKey.extractable===false,
    };
  });
  expect(result).toEqual({
    unchangedFingerprint:true,pinOwner:true,pinRecipient:true,
    pinDevice:true,pinEpoch:true,trusted:true,shared:true,
    noSilentKeyChange:true,deviceUnchanged:true,
    privateKeyNonextractable:true,
  });
  expect(writes).toBe(0);
});
