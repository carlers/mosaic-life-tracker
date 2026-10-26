import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SettingsDocument } from '../../src/db/schema';
import {
  buildCandidateSettingsReplayPlan, verifyCandidateSettingsReplayParity,
  type CandidateSettingsReplayInput,
} from '../../supabase-poc/candidateSettingsHistoryReplay';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';

const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x),'utf8').digest('hex');
const id:CandidateIdentity={
  legacyUserId:'appwrite_owner',
  supabaseUserId:'11111111-1111-4111-8111-111111111111',
};
const at='2026-10-26T09:00:00Z';
const row=(rid:string,key:string,value:string,isDeleted=false):SettingsDocument=>({
  id:rid,userId:id.legacyUserId,key,value,updatedAt:at,isDeleted,
});
function source(){
  return [
    row('pref_1','calendarTaskPreviewLimit','"unlimited"'),
    row('pref_2','theme','{"scheme":"dark","emoji":"🌙"}'),
    row('pref_3','archivedFeature','',true),
    row('pref_4','profileImageId','private_file_ID_1'),
    row('pref_5','friend_carousel_prefs','{"friendIds":["other_private_owner"]}'),
    row('pref_6','unknownFutureFlag','false'),
    row('pref_7','oldAvatar','',true),
  ];
}
const normalized=(x:SettingsDocument[])=>x.map(o=>({
  id:o.id,userId:o.userId,key:o.key,value:o.value,updatedAt:o.updatedAt,isDeleted:o.isDeleted,
})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
function fixture():CandidateSettingsReplayInput{
  const rows=source();
  return {
    identity:{...id},
    originalRows:rows,
    expectedOriginalCount:rows.length,
    expectedOriginalRowsSha256:hash(normalized(rows)),
    originalSourceArchiveCipherSha256:'a'.repeat(64),
    originalSevenDomainScanSha256:'b'.repeat(64),
  };
}
function target(plan:ReturnType<typeof buildCandidateSettingsReplayPlan>){
  return plan.portableWrites.map(write=>({
    ...write,change_seq:'9007199254740993',
    server_updated_at:'2026-10-26T09:00:01.000Z',
  }));
}
function proof(){
  const plan=buildCandidateSettingsReplayPlan(fixture());
  return {plan,independentlyPinnedPlanSha256:plan.planSha256,targetRows:target(plan)};
}
describe('complete-owner original Settings history replay (#1027)',()=>{
  it('partitions seven complete owner rows into portable + deferred avatar/friend without loss',()=>{
    const plan=buildCandidateSettingsReplayPlan(fixture());
    expect(plan.originalCount).toBe(7);
    expect(plan.portableWrites).toHaveLength(5);
    expect(plan.portableWrites.map(x=>x.id))
      .toEqual(['pref_1','pref_2','pref_3','pref_6','pref_7']);
    expect(plan.portableWrites[1].setting_value)
      .toBe('{"scheme":"dark","emoji":"🌙"}');
    expect(plan.portableWrites[2]).toMatchObject({is_deleted:true,setting_value:''});
    expect(plan.deferred.map(x=>x.key))
      .toEqual(['profileImageId','friend_carousel_prefs']);
    expect(plan.deferred.every(x=>/^[a-f0-9]{64}$/.test(x.originalFieldsSha256)))
      .toBe(true);
    expect(plan.deferred).not.toEqual(expect.arrayContaining([
      expect.objectContaining({value:expect.anything()}),
    ]));
    expect(plan.deferredValuesRemainInEncryptedOriginalSource).toBe(true);
    expect(plan.realDeferredMediaOrSocialMigrated).toBe(false);
    expect(plan.providerCutoverEligible).toBe(false);
  });
  it('validates original source independently of input order and isolates output from later edits',()=>{
    const a=fixture(),b=fixture();
    b.originalRows=[...b.originalRows].reverse();
    expect(buildCandidateSettingsReplayPlan(a)).toEqual(buildCandidateSettingsReplayPlan(b));
    const plan=buildCandidateSettingsReplayPlan(a);
    a.originalRows[0].value='modified';
    expect(plan.portableWrites[0].setting_value).toBe('"unlimited"');
    expect(plan.originalRowsSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('refuses foreign, omitted, duplicate owner-key and altered original opaque bytes',()=>{
    for(const change of [
      (f:CandidateSettingsReplayInput)=>{
        f.originalRows=[...f.originalRows.slice(0,-1)];
      },
      (f:CandidateSettingsReplayInput)=>{
        f.originalRows[0].userId='another_owner';
      },
      (f:CandidateSettingsReplayInput)=>{
        f.originalRows[0].value='"slightly different"';
      },
      (f:CandidateSettingsReplayInput)=>{
        f.originalRows[1].key=f.originalRows[0].key;
      },
      (f:CandidateSettingsReplayInput)=>{
        f.originalRows[1].id=f.originalRows[0].id;
      },
      (f:CandidateSettingsReplayInput)=>{
        f.originalRows[0].isDeleted=true;
      },
      (f:CandidateSettingsReplayInput)=>{
        f.expectedOriginalCount=1;
      },
      (f:CandidateSettingsReplayInput)=>{
        f.expectedOriginalRowsSha256='0'.repeat(64);
      },
      (f:CandidateSettingsReplayInput)=>{
        f.originalSevenDomainScanSha256='bad';
      },
    ]){
      const fixtureData=fixture();change(fixtureData);
      expect(()=>buildCandidateSettingsReplayPlan(fixtureData)).toThrow();
    }
  });
  it('refuses unusual Settings shapes rather than discarding historical keys',()=>{
    for(const [key,value] of [
      ['profileImageId',null],
      ['not-valid-key','foo'],
      ['theme','x'.repeat(65537)],
    ]){
      const f=fixture();
      f.originalRows[0].key=key;
      f.originalRows[0].value=value as string;
      expect(()=>buildCandidateSettingsReplayPlan(f)).toThrow();
    }
  });
  it('compares all signed target rows byte-exact while retaining deferred history independently',()=>{
    const p=proof();
    const checked=verifyCandidateSettingsReplayParity(p);
    expect(checked).toMatchObject({
      originalSettingsCount:7,expectedPortableCount:5,deferredOwnerKeyCount:2,
      sourceServerAuthorityProven:false,
      signedTargetReadbackAuthenticated:false,providerCutoverEligible:false,
    });
    expect(checked.targetFieldsSha256).toMatch(/^[a-f0-9]{64}$/);
    const reversed=verifyCandidateSettingsReplayParity({
      ...p,targetRows:[...p.targetRows].reverse(),
    });
    expect(reversed).toEqual(checked);
  });
  it('blocks owner switch, invisible remote avatar, content changes and revisionless rows',()=>{
    const mutations=[
      (p:ReturnType<typeof proof>)=>{p.targetRows.pop();},
      (p:ReturnType<typeof proof>)=>{p.targetRows[0].owner_id=
        '22222222-2222-4222-8222-222222222222';},
      (p:ReturnType<typeof proof>)=>{p.targetRows[1].setting_value='changed';},
      (p:ReturnType<typeof proof>)=>{p.targetRows[1].is_deleted=true;},
      (p:ReturnType<typeof proof>)=>{p.targetRows[0].change_seq='0';},
      (p:ReturnType<typeof proof>)=>{p.targetRows[0].change_seq='9007199254740993.0';},
      (p:ReturnType<typeof proof>)=>{p.targetRows[0].server_updated_at='invalid';},
      (p:ReturnType<typeof proof>)=>{p.targetRows[0].setting_key='profileImageId';},
      (p:ReturnType<typeof proof>)=>{p.targetRows[1].id=p.targetRows[0].id;},
      (p:ReturnType<typeof proof>)=>{p.independentlyPinnedPlanSha256='0'.repeat(64);},
    ];
    for(const mutate of mutations){
      const p=proof();mutate(p);
      expect(()=>verifyCandidateSettingsReplayParity(p)).toThrow();
    }
  });
  it('rejects tampered or dropped deferred classifications even with intact target row counts',()=>{
    const p=proof();
    p.plan.deferred[0].originalFieldsSha256='0'.repeat(64);
    expect(()=>verifyCandidateSettingsReplayParity(p))
      .toThrow(/replay plan differs/);
    const q=proof();
    q.plan.deferred.pop();
    expect(()=>verifyCandidateSettingsReplayParity(q))
      .toThrow(/replay plan differs/);
  });
});
