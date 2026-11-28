/**
 * UNWIRED / OFF: exact Scratch-only synthetic root-epoch contention contract.
 * No SDK, API credentials, HTTP or host operator. A mocked-port PASS does
 * NOT establish backend atomicity, signed device possession or writer fencing.
 * A future reviewed adapter must attest its own disposable fixture and host.
 */
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {planScratchOwnerRootEpochClaim}=require(
  '../appwrite-functions/message-action/e2ee-root-epoch-claim-candidate.js');
const PROJECT='6b00671500279e901846';
const KEY=/^k_[a-f0-9]{32}$/,HASH=/^[a-f0-9]{64}$/;
const OWNER=/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const sha=s=>createHash('sha256').update(s).digest('hex');
function denied(){throw Error('Root contention proof incomplete; no runtime attestation.');}
function exact(x,fields){
  return !!x&&typeof x==='object'&&!Array.isArray(x)&&
    Object.getPrototypeOf(x)===Object.prototype&&
    Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
}
function conflict(error){
  return Number(error?.code)===409||Number(error?.status)===409;
}
/**
 * Future port must create a fresh, independently verified disposable Scratch
 * root fixture for each call, NEVER reuse the existing M1 synthetic owner.
 * Real admin authorization, signed owner root proof, real old-client denial,
 * installed version and 2-node transaction topology are external gates.
 * No mutation is performed unless a separately authorized adapter is given.
 */
export async function checkScratchRootEpochRaceModel({
  projectId,ownerId,expectedGeneration,contenders,port,
}){
  if(projectId!==PROJECT||typeof ownerId!=='string'||!OWNER.test(ownerId)||
     !Number.isSafeInteger(expectedGeneration)||expectedGeneration<1||
     expectedGeneration>=2147483647||
     !Number.isSafeInteger(contenders)||contenders<20||contenders>90||
     !port||typeof port.setup!=='function'||typeof port.attempt!=='function'||
     typeof port.readback!=='function'||typeof port.cleanup!=='function')
    denied();
  const owner=Object.freeze({projectId:PROJECT,ownerId});
  let result=null,failure=null,cleanup;
  let disposableFixtureVerified=false;
  try{
    const baseline=await port.setup(owner,expectedGeneration);
    if(!exact(baseline,['projectId','ownerId','generation','keyId',
      'oldEnvelopeSha256','claimAbsent','disposable'])||
       baseline.projectId!==PROJECT||baseline.ownerId!==ownerId||
       baseline.generation!==expectedGeneration||
       !KEY.test(baseline.keyId)||!HASH.test(baseline.oldEnvelopeSha256)||
       baseline.claimAbsent!==true||baseline.disposable!==true)denied();
    // Only a positively attested disposable lease authorizes fixture cleanup.
    // An uncertain setup must NOT trigger an unscoped delete by owner ID.
    disposableFixtureVerified=true;
    const plans=Array.from({length:contenders},(_,i)=>{
      const unique=sha('SYNTHETIC-E2EE-CLAIM/'+JSON.stringify([
        PROJECT,ownerId,expectedGeneration,i]));
      const opId='o_'+unique.slice(0,32);
      const nextKeyId='k_'+sha(unique+'/key').slice(0,32);
      const claim=planScratchOwnerRootEpochClaim(owner,expectedGeneration,{
        expectedKeyId:baseline.keyId,nextKeyId,operationId:opId,
      });
      return Object.freeze({
        projectId:PROJECT,ownerId,claimId:claim.claimId,
        expectedGeneration,nextGeneration:expectedGeneration+1,
        expectedKeyId:baseline.keyId,nextKeyId,
        operationId:opId,
        beforeEnvelopeSha256:baseline.oldEnvelopeSha256,
        afterEnvelopeSha256:sha(unique+'/fake-encrypted-envelope'),
      });
    });
    const claimId=plans[0].claimId;
    if(!plans.every(x=>x.claimId===claimId)||
       new Set(plans.map(x=>x.operationId)).size!==contenders)denied();
    const outcomes=await Promise.allSettled(plans.map(plan=>port.attempt(plan)));
    let winners=[],conflicts=0,unknown=0;
    for(let i=0;i<outcomes.length;i++){
      const o=outcomes[i];
      if(o.status==='rejected'){
        if(conflict(o.reason))conflicts++;else unknown++;
        continue;
      }
      if(!exact(o.value,['status','operationId'])||
         o.value.operationId!==plans[i].operationId){unknown++;continue;}
      if(o.value.status==='committed')winners.push(i);
      else if(o.value.status==='conflict')conflicts++;
      else unknown++;
    }
    // An unknown receipt is NOT automatically a rejected transaction.
    if(winners.length!==1||conflicts!==contenders-1||unknown!==0)denied();
    const winner=plans[winners[0]];
    const after=await port.readback(owner,claimId);
    if(!exact(after,['projectId','ownerId','rootGeneration','rootKeyId',
      'claimId','claimOperationId','fromGeneration','toGeneration',
      'beforeEnvelopeSha256','afterEnvelopeSha256','claimCount'])||
       after.projectId!==PROJECT||after.ownerId!==ownerId||
       after.rootGeneration!==expectedGeneration+1||
       after.rootKeyId!==winner.nextKeyId||after.claimId!==claimId||
       after.claimOperationId!==winner.operationId||
       after.fromGeneration!==expectedGeneration||
       after.toGeneration!==expectedGeneration+1||
       after.beforeEnvelopeSha256!==baseline.oldEnvelopeSha256||
       after.afterEnvelopeSha256!==winner.afterEnvelopeSha256||
       after.claimCount!==1)denied();
    result=Object.freeze({
      status:'synthetic-port-model-only-not-backend-proof',
      contenders,committed:1,conflicts,indeterminate:0,
      claimId,winnerOpId:winner.operationId,generation:after.rootGeneration,
    });
  }catch(error){failure=error;}
  finally{
    if(!disposableFixtureVerified){
      // A failed setup may have unknown backend state. An independently
      // trusted operator must reconcile it; never guess it is disposable.
      failure=Error('Disposable fixture was not positively attested.');
    }else try{cleanup=await port.cleanup(owner);}
    catch{failure=Error('Synthetic fixture cleanup unverified.');}
    if(disposableFixtureVerified&&(!exact(cleanup,['status','ownerId'])||
       cleanup.status!=='cleared'||cleanup.ownerId!==ownerId))
      failure=Error('Synthetic fixture cleanup unverified.');
  }
  if(failure)denied();
  return result;
}
