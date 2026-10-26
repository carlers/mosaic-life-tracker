/**
 * #1027 original owner Settings complete-history replay and readback preflight.
 * Source-only; no HTTP, hosted SQL, export, avatar import or feature activation.
 * Independent original-source attestations and signed target snapshots are
 * external requirements, never inferred from a digest supplied by this module.
 */
import { createHash } from 'node:crypto';
import type { SettingsDocument } from '../src/db/schema';
import {
  classifyCandidateSettingKey, toCandidateSettingWrite,
  fromCandidateSettingRow, type CandidateSettingRow,
  type CandidateSettingWrite,
} from './candidateSettingsMapping';
import { parseCandidateRevision, validateCandidateIdentity,
  type CandidateIdentity } from './candidateMapping';

const SHA=/^[a-f0-9]{64}$/;
const KEY=/^[A-Za-z][A-Za-z0-9_]{0,127}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const MAX=250_000;
const digest=(value:unknown):string=>createHash('sha256')
  .update(JSON.stringify(value),'utf8').digest('hex');
const byId=(a:{id:string},b:{id:string})=>
  a.id<b.id?-1:a.id>b.id?1:0;
function fail(detail:string):never{
  throw new Error('Owner Settings history replay: '+detail);
}
const sourceFields=(row:SettingsDocument)=>({
  id:row.id,userId:row.userId,key:row.key,value:row.value,
  updatedAt:row.updatedAt,isDeleted:row.isDeleted,
});

export type CandidateSettingsReplayInput={
  identity:CandidateIdentity;
  /** Full original Appwrite owner rows including tombstones and special keys. */
  originalRows:readonly SettingsDocument[];
  /** Separately signed complete owner Settings count; NOT client pagination. */
  expectedOriginalCount:number;
  /** Independently authenticated original signed source row-content digest. */
  expectedOriginalRowsSha256:string;
  /** Original complete seven-reader source encrypted artifact ciphertext SHA. */
  originalSourceArchiveCipherSha256:string;
  originalSevenDomainScanSha256:string;
};
export type DeferredSettingsKey={
  id:string;
  key:'profileImageId'|'friend_carousel_prefs';
  originalFieldsSha256:string;
  isDeleted:boolean;
};

/**
 * This plan must NEVER be fed directly to the shipped RxDB collection:
 * Settings contains avatar and social references needing independent media
 * and friend identity migration, not portable Supabase settings rows.
 */
export function buildCandidateSettingsReplayPlan(input:CandidateSettingsReplayInput){
  if(!input)fail('missing complete original source');
  validateCandidateIdentity(input.identity);
  if(![input.expectedOriginalRowsSha256,
    input.originalSourceArchiveCipherSha256,
    input.originalSevenDomainScanSha256].every(s=>
      typeof s==='string'&&SHA.test(s))||
     !Number.isSafeInteger(input.expectedOriginalCount)||
     input.expectedOriginalCount<0||input.expectedOriginalCount>MAX||
     !Array.isArray(input.originalRows)||
     input.originalRows.length!==input.expectedOriginalCount)
    fail('incomplete independently pinned original owner history');
  const source=input.originalRows.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||
       row.userId!==input.identity.legacyUserId||
       typeof row.id!=='string'||!ID.test(row.id)||
       typeof row.key!=='string'||!KEY.test(row.key)||
       typeof row.value!=='string'||row.value.length>65536||
       typeof row.updatedAt!=='string'||!row.updatedAt||
       row.updatedAt.length>50||!Number.isFinite(Date.parse(row.updatedAt))||
       typeof row.isDeleted!=='boolean')
      fail('foreign or malformed original owner Settings field');
    classifyCandidateSettingKey(row.key);
    return sourceFields(row);
  }).sort(byId);
  const ids=new Set<string>(),keys=new Set<string>();
  for(const row of source){
    if(ids.has(row.id)||keys.has(row.key))
      fail('duplicate original Settings row or unique owner preference key');
    ids.add(row.id);keys.add(row.key);
  }
  if(digest(source)!==input.expectedOriginalRowsSha256)
    fail('original owner Settings rows differ from independent authenticated source hash');
  const portableWrites:CandidateSettingWrite[]=[];
  const deferred:DeferredSettingsKey[]=[];
  for(const row of source){
    if(classifyCandidateSettingKey(row.key)==='personal'){
      portableWrites.push(toCandidateSettingWrite(row,input.identity));
    }else{
      deferred.push({
        id:row.id,key:row.key as DeferredSettingsKey['key'],
        originalFieldsSha256:digest(row),isDeleted:row.isDeleted,
      });
    }
  }
  if(portableWrites.length+deferred.length!==input.expectedOriginalCount)
    fail('original owner preference silently omitted');
  const canonical={
    format:'mosaic-owner-settings-replay-plan' as const,
    version:1 as const,
    owner:{...input.identity},
    originalSourceArchiveCipherSha256:input.originalSourceArchiveCipherSha256,
    originalSevenDomainScanSha256:input.originalSevenDomainScanSha256,
    originalRowsSha256:input.expectedOriginalRowsSha256,
    originalCount:input.expectedOriginalCount,
    portableWrites,deferred,
  };
  return {
    ...canonical,
    planSha256:digest(canonical),
    deferredValuesRemainInEncryptedOriginalSource:true as const,
    realDeferredMediaOrSocialMigrated:false as const,
    signedTargetReadbackAuthenticated:false as const,
    providerCutoverEligible:false as const,
  };
}
type SettingsPlan=ReturnType<typeof buildCandidateSettingsReplayPlan>;
/**
 * Input remote rows MUST be an independently complete, signed, owner-fenced
 * Supabase snapshot. Server revision is not client-owned. A complete
 * remote set may contain ONLY the planned portable rows; no unknown avatar
 * or friend setting is ever silently imported as if it were portable.
 */
export function verifyCandidateSettingsReplayParity(input:{
  plan:SettingsPlan;
  independentlyPinnedPlanSha256:string;
  targetRows:readonly CandidateSettingRow[];
}){
  const {plan,targetRows,independentlyPinnedPlanSha256:pin}=input??{};
  if(!plan||!Array.isArray(targetRows)||typeof pin!=='string'||!SHA.test(pin))
    fail('missing independent plan hash and full signed target inventory');
  const {planSha256:_localHash,
    deferredValuesRemainInEncryptedOriginalSource:_deferred,
    realDeferredMediaOrSocialMigrated:_media,
    signedTargetReadbackAuthenticated:_signed,
    providerCutoverEligible:_eligible,...canonical}=plan;
  void _localHash;void _deferred;void _media;void _signed;void _eligible;
  if(digest(canonical)!==pin||plan.planSha256!==pin||
     !SHA.test(plan.originalRowsSha256)||
     !SHA.test(plan.originalSourceArchiveCipherSha256)||
     !SHA.test(plan.originalSevenDomainScanSha256)||
     plan.portableWrites.length+plan.deferred.length!==plan.originalCount||
     !Array.isArray(plan.portableWrites)||!Array.isArray(plan.deferred))
    fail('replay plan differs from independent source commitment');
  if(targetRows.length!==plan.portableWrites.length)
    fail('signed target Settings row count differs from original portable history');
  const owner=plan.owner;
  validateCandidateIdentity(owner);
  const expected=new Map<string,CandidateSettingWrite>();
  for(const row of plan.portableWrites){
    if(expected.has(row.id)||row.owner_id!==owner.supabaseUserId||
       classifyCandidateSettingKey(row.setting_key)!=='personal')
      fail('tampered owner Settings replay row');
    expected.set(row.id,row);
  }
  const visited=new Set<string>();
  const normalized:CandidateSettingWrite[]=[];
  for(const row of targetRows){
    if(!row||typeof row.server_updated_at!=='string'||
       !row.server_updated_at.length||
       row.server_updated_at.length>50||
       !Number.isFinite(Date.parse(row.server_updated_at))||
       parseCandidateRevision(row.change_seq)<1n)
      fail('target Settings row has no server revision or timestamp');
    const doc=fromCandidateSettingRow(row,owner);
    if(visited.has(doc.id))fail('duplicate target owner Settings row');
    visited.add(doc.id);
    const current=toCandidateSettingWrite(doc,owner);
    const original=expected.get(doc.id);
    if(!original||JSON.stringify(current)!==JSON.stringify(original))
      fail('target Settings changed an original field or included deferred key');
    normalized.push(current);
  }
  if(visited.size!==expected.size)fail('missing original portable Settings target row');
  return {
    expectedPortableCount:expected.size,
    deferredOwnerKeyCount:plan.deferred.length,
    originalSettingsCount:plan.originalCount,
    targetFieldsSha256:digest(normalized.sort(byId)),
    originalSourceArchiveCipherSha256:plan.originalSourceArchiveCipherSha256,
    originalSevenDomainScanSha256:plan.originalSevenDomainScanSha256,
    independentlyPinnedPlanSha256:pin,
    deferredValuesRemainInEncryptedOriginalSource:true as const,
    sourceServerAuthorityProven:false as const,
    signedTargetReadbackAuthenticated:false as const,
    providerCutoverEligible:false as const,
  };
}
