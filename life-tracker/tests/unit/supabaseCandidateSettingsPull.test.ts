import { describe, expect, it, vi } from 'vitest';
import { pullCandidateSettings } from '../../supabase-poc/candidatePull';
import { createCandidateHttpTransport, CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';
import { toCandidateSettingWrite } from '../../supabase-poc/candidateSettingsMapping';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';
import type { SettingsDocument } from '../../src/db/schema';

const owner: CandidateIdentity = {
  legacyUserId: 'legacy_owner',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const doc: SettingsDocument = {
  id:'s_123', userId:owner.legacyUserId, key:'calendarZoomDays',
  value:'{"days":7,"emoji":"🌙"}', updatedAt:'2026-10-25T00:00:00Z', isDeleted:true,
};
const row = { ...toCandidateSettingWrite(doc,owner),
  change_seq:'9007199254740993', server_updated_at:'2026-10-25T12:00:00Z' };
const signed = { userId:owner.supabaseUserId, accessToken:'signed-owner-token', sessionEpoch:7 };
function harness(rows: unknown[] = [row]) {
  const session = { getVerifiedSession:vi.fn().mockResolvedValue(signed) };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows),{
    status:200,headers:{'content-type':'application/json'},
  }));
  const transport = createCandidateHttpTransport({
    baseUrl:'https://synthetic.supabase.co',publishableKey:'sb_publishable_synthetic_only',
    session,fetcher:fetcher as unknown as typeof fetch,
  });
  return {session,fetcher,transport};
}
describe('source-only Settings signed cursor read', () => {
  it('reads exact owner-scoped Settings with JWT and monotone bigint revision', async () => {
    const h=harness();
    const result=await pullCandidateSettings({
      transport:h.transport,identity:owner,
      checkpoint:{changeSeq:'9007199254740992'},batchSize:50,
    });
    expect(result.documents).toEqual([{...doc,_deleted:false}]);
    expect(result.checkpoint).toEqual({changeSeq:'9007199254740993'});
    const [url,init]=h.fetcher.mock.calls[0] as [string,RequestInit];
    const parsed=new URL(url);
    expect(parsed.pathname).toBe('/rest/v1/mosaic_candidate_settings');
    expect(parsed.searchParams.get('owner_id')).toBe('eq.'+owner.supabaseUserId);
    expect(parsed.searchParams.get('change_seq')).toBe('gt.9007199254740992');
    expect(parsed.searchParams.get('order')).toBe('change_seq.asc');
    expect(parsed.searchParams.get('limit')).toBe('50');
    expect(init).toMatchObject({method:'GET',credentials:'omit',cache:'no-store',
      headers:{Authorization:'Bearer signed-owner-token'}});
    expect(h.session.getVerifiedSession).toHaveBeenCalledTimes(2);
  });
  it('preserves checkpoint on empty page', async () => {
    const h=harness([]);
    const checkpoint={changeSeq:'51'};
    await expect(pullCandidateSettings({transport:h.transport,identity:owner,
      checkpoint,batchSize:5})).resolves.toEqual({documents:[],checkpoint});
  });
  it('rejects foreign owner, invalid metadata, and unportable settings', async () => {
    for (const bad of [
      {...row,owner_id:'22222222-2222-4222-8222-222222222222'},
      {...row,is_deleted:undefined},
      {...row,setting_value:null},
      {...row,setting_key:'profileImageId'},
      {...row,setting_key:'friend_carousel_prefs'},
    ]) {
      const h=harness([bad]);
      await expect(pullCandidateSettings({
        transport:h.transport,identity:owner,batchSize:2,
      })).rejects.toThrow();
    }
  });
  it('does not advance after duplicate/out-of-order/unsafe revisions or oversized pages', async () => {
    for (const rows of [
      [row,{...row,id:'s_124'}],
      [row,{...row,id:'s_124',change_seq:'9007199254740992'}],
      [{...row,change_seq:9007199254740993}],
    ]) {
      const h=harness(rows);
      await expect(pullCandidateSettings({
        transport:h.transport,identity:owner,batchSize:2,
      })).rejects.toThrow();
    }
    await expect(pullCandidateSettings({
      transport:harness([row,row]).transport,identity:owner,batchSize:1,
    })).rejects.toThrow(/response size/);
  });
  it('validates owner/checkpoint/batch before contacting Supabase', async () => {
    const h=harness();
    await expect(pullCandidateSettings({
      transport:h.transport,identity:{...owner,supabaseUserId:'invalid'},batchSize:1,
    })).rejects.toThrow();
    await expect(pullCandidateSettings({
      transport:h.transport,identity:owner,batchSize:101,
    })).rejects.toThrow();
    await expect(pullCandidateSettings({
      transport:h.transport,identity:owner,
      checkpoint:{changeSeq:'-1'},batchSize:1,
    })).rejects.toThrow();
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it('refuses in-flight owner session replacement after HTTP response', async () => {
    const h=harness();
    h.session.getVerifiedSession.mockResolvedValueOnce(signed)
      .mockResolvedValueOnce({...signed,sessionEpoch:8});
    await expect(pullCandidateSettings({
      transport:h.transport,identity:owner,batchSize:1,
    })).rejects.toBeInstanceOf(CandidateAuthError);
  });
});
