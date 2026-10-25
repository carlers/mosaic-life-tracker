import { describe, expect, it, vi } from 'vitest';
import { createCandidateCreateTransport } from '../../supabase-poc/candidateCreateTransport';
import { createCandidateCasTransport } from '../../supabase-poc/candidateCasTransport';
import { CandidateAuthError, CandidateHttpError } from '../../supabase-poc/candidateHttpTransport';
import { toCandidateSettingWrite } from '../../supabase-poc/candidateSettingsMapping';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { SettingsDocument } from '../../src/db/schema';

const owner: CandidateIdentity = {
  legacyUserId:'legacy_owner', supabaseUserId:'11111111-1111-4111-8111-111111111111',
};
const doc: SettingsDocument = {
  id:'s_123', userId:owner.legacyUserId, key:'calendarZoomDays',
  value:'{"days":7,"emoji":"🌙"}', updatedAt:'2026-10-25T00:00:00Z', isDeleted:false,
};
const row = {...toCandidateSettingWrite(doc,owner),change_seq:'9007199254740993',
  server_updated_at:'2026-10-25T12:00:00Z'};
const user={userId:owner.supabaseUserId,accessToken:'signed-settings-token',sessionEpoch:3};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
function harness(responses:Response[]) {
  const fetcher=vi.fn(async()=>responses.shift()??json({error:'not available'},503));
  const getVerifiedSession=vi.fn().mockResolvedValue(user);
  const opts={baseUrl:'https://synthetic.supabase.co',
    publishableKey:'sb_publishable_synthetic_only',
    session:{getVerifiedSession},fetcher:fetcher as typeof fetch};
  return {fetcher,getVerifiedSession,create:createCandidateCreateTransport(opts),
    cas:createCandidateCasTransport(opts)};
}
describe('source-only signed Settings create + revision CAS, without runtime activation',()=>{
  it('creates only original-owner Settings with no upsert/client-owned revision',async()=>{
    const h=harness([json([row],201)]);
    await expect(h.create.createSetting(doc,owner)).resolves.toEqual({
      state:'created',row,revision:'9007199254740993',
    });
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    const [url,init]=h.fetcher.mock.calls[0] as [string,RequestInit];
    expect(url).toBe('https://synthetic.supabase.co/rest/v1/mosaic_candidate_settings');
    expect(init).toMatchObject({
      method:'POST',credentials:'omit',redirect:'error',
      headers:{Authorization:'Bearer signed-settings-token',Prefer:'return=representation'},
    });
    const payload=JSON.parse(String(init.body));
    expect(payload).toEqual(toCandidateSettingWrite(doc,owner));
    expect(payload).not.toHaveProperty('change_seq');
    expect(payload).not.toHaveProperty('server_updated_at');
  });
  it('requires owner-scoped master read on duplicate; refuses invisible owner-key conflict',async()=>{
    const h=harness([json({code:'23505'},409),json([row])]);
    await expect(h.create.createSetting(doc,owner)).resolves.toMatchObject({
      state:'conflict',revision:'9007199254740993',
    });
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    const url=new URL(h.fetcher.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/rest/v1/mosaic_candidate_settings');
    expect(url.searchParams.get('owner_id')).toBe('eq.'+owner.supabaseUserId);
    expect(url.searchParams.get('id')).toBe('eq.s_123');
    await expect(harness([json({},409),json([])]).create.createSetting(doc,owner))
      .rejects.toThrow(/without accessible owner master/);
  });
  it('rejects foreign/protected local setting and fabricated server state before success',async()=>{
    const blank=harness([]);
    await expect(blank.create.createSetting({...doc,userId:'other'},owner)).rejects.toThrow();
    await expect(blank.create.createSetting({...doc,key:'profileImageId'},owner)).rejects.toThrow();
    await expect(blank.create.createSetting({...doc,key:'friend_carousel_prefs'},owner)).rejects.toThrow();
    expect(blank.fetcher).not.toHaveBeenCalled();
    for(const bad of [
      {...row,owner_id:'22222222-2222-4222-8222-222222222222'},
      {...row,setting_value:null},{...row,setting_key:'profileImageId'},
      {...row,is_deleted:null},{...row,change_seq:'0'},
    ]) {
      await expect(harness([json([bad],201)]).create.createSetting(doc,owner))
        .rejects.toThrow();
    }
  });
  it('uses signed exact bigint expected-revision SQL CAS, not direct UPDATE',async()=>{
    const updated={...row,setting_value:'{"days":5}',change_seq:'9007199254740994'};
    const h=harness([json(updated)]);
    await expect(h.cas.compareAndSet({
      domain:'settings',ownerId:owner.supabaseUserId,documentId:doc.id,
      expectedRevision:'9007199254740993',
      patch:{setting_value:updated.setting_value,updated_at:'2026-10-25T12:00:00Z'},
    })).resolves.toEqual({state:'applied',revision:'9007199254740994',row:updated});
    const [url,init]=h.fetcher.mock.calls[0] as [string,RequestInit];
    expect(url).toBe('https://synthetic.supabase.co/rest/v1/rpc/mosaic_candidate_cas_setting');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      p_id:doc.id,p_expected_seq:'9007199254740993',
      p_patch:{setting_value:'{"days":5}',updated_at:'2026-10-25T12:00:00Z'},
    });
  });
  it('forbids Settings patch field spoofing, wrong types and invalid timestamps before network',async()=>{
    const h=harness([]);
    const base={domain:'settings' as const,ownerId:owner.supabaseUserId,
      documentId:doc.id,expectedRevision:'1'};
    for(const patch of [
      {},{owner_id:'forged'},{setting_key:'foreign'},{change_seq:3},
      {setting_value:null},{setting_value:33},{setting_value:'x'.repeat(65537)},
      {updated_at:'invalid'},{updated_at:false},{is_deleted:'true'},
      {server_updated_at:'today'},
    ]) {
      await expect(h.cas.compareAndSet({...base,patch:patch as never})).rejects.toThrow();
    }
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('reports stale/foreign/null composite as conflict and refuses forged successful row',async()=>{
    const args={domain:'settings' as const,ownerId:owner.supabaseUserId,
      documentId:doc.id,expectedRevision:'9007199254740993',
      patch:{is_deleted:true}};
    await expect(harness([json(null)]).cas.compareAndSet(args))
      .resolves.toEqual({state:'conflict'});
    await expect(harness([json({owner_id:null,id:null,change_seq:null,
      is_deleted:null,setting_value:null})]).cas.compareAndSet(args))
      .resolves.toEqual({state:'conflict'});
    for(const bad of [
      {...row,change_seq:'9007199254740993'},
      {...row,owner_id:'22222222-2222-4222-8222-222222222222'},
      {...row,is_deleted:null},
    ]) {
      await expect(harness([json(bad)]).cas.compareAndSet(args)).rejects.toThrow();
    }
  });
  it('does not acknowledge a changed owner token or retry an ambiguous create',async()=>{
    const h=harness([json([row],201)]);
    h.getVerifiedSession.mockResolvedValueOnce(user)
      .mockResolvedValueOnce({...user,accessToken:'rotated-without-epoch'});
    await expect(h.create.createSetting(doc,owner))
      .rejects.toBeInstanceOf(CandidateAuthError);
    const down=harness([json({error:'offline'},503)]);
    await expect(down.create.createSetting(doc,owner))
      .rejects.toBeInstanceOf(CandidateHttpError);
    expect(down.fetcher).toHaveBeenCalledTimes(1);
  });
});
