import { describe, expect, it, vi } from 'vitest';
import {
  createCandidateHttpTransport,
  CandidateAuthError,
  CandidateHttpError,
  type CandidateSessionProvider,
} from '../../supabase-poc/candidateHttpTransport';
import { pullCandidateTasks } from '../../supabase-poc/candidatePull';

const id = '11111111-1111-4111-8111-111111111111';
const identity = { legacyUserId: 'appwrite_original_id', supabaseUserId: id };
const verified = { userId: id, accessToken: 'synthetic-access-token', sessionEpoch: 7 };
const key = 'sb_publishable_synthetic_test_only';

function harness(body: unknown = [], status = 200) {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  ) as unknown as typeof fetch;
  const auth = vi.fn().mockResolvedValue(verified);
  const session: CandidateSessionProvider = { getVerifiedSession: auth };
  const transport = createCandidateHttpTransport({
    baseUrl: 'https://synthetic.supabase.co',
    publishableKey: key,
    session,
    fetcher,
  });
  return { fetcher: fetcher as unknown as ReturnType<typeof vi.fn>, auth, transport };
}

describe('isolated Supabase REST candidate boundary', () => {
  it('rejects a token rotation even when a session provider forgets to bump its epoch', async () => {
    const { transport, auth, fetcher } = harness([]);
    auth.mockResolvedValueOnce(verified).mockResolvedValue({
      ...verified, accessToken: 'rotated-synthetic-token-with-same-epoch',
    });
    await expect(transport.listChanges({
      domain: 'tasks', ownerId: id, afterExclusive: '0', batchSize: 10,
    })).rejects.toBeInstanceOf(CandidateAuthError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('queries only own changed rows with bearer token, exact cursor and bounded limit', async () => {
    const { fetcher, auth, transport } = harness([]);
    await transport.listChanges({
      domain: 'categories', ownerId: id,
      afterExclusive: '9007199254740993', batchSize: 100,
    });
    expect(auth).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, request] = fetcher.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://synthetic.supabase.co');
    expect(parsed.pathname).toBe('/rest/v1/mosaic_candidate_categories');
    expect(parsed.searchParams.get('owner_id')).toBe('eq.' + id);
    expect(parsed.searchParams.get('change_seq')).toBe('gt.9007199254740993');
    expect(parsed.searchParams.get('order')).toBe('change_seq.asc');
    expect(parsed.searchParams.get('limit')).toBe('100');
    expect(request).toMatchObject({
      method: 'GET', cache: 'no-store', credentials: 'omit',
      headers: { Authorization: 'Bearer synthetic-access-token', apikey: key },
    });
  });

  it('fails before fetch when owner is different or signed-in user missing', async () => {
    const { fetcher, transport, auth } = harness();
    await expect(transport.listChanges({
      domain: 'tasks',
      ownerId: '22222222-2222-4222-8222-222222222222',
      afterExclusive: '0', batchSize: 3,
    })).rejects.toBeInstanceOf(CandidateAuthError);
    auth.mockResolvedValue(null);
    await expect(transport.listChanges({
      domain: 'tasks', ownerId: id, afterExclusive: '0', batchSize: 3,
    })).rejects.toBeInstanceOf(CandidateAuthError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects results if account switched while request was in flight', async () => {
    const { fetcher, transport, auth } = harness([{ owner_id: id, change_seq: 1 }]);
    auth.mockReset()
      .mockResolvedValueOnce(verified)
      .mockResolvedValueOnce({ ...verified, sessionEpoch: 8 });
    await expect(transport.listChanges({
      domain: 'tasks', ownerId: id, afterExclusive: '0', batchSize: 10,
    })).rejects.toThrow('account changed');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('distinguishes denied session from service failure', async () => {
    const denied = harness([], 401);
    await expect(denied.transport.listChanges({
      domain: 'tasks', ownerId: id, afterExclusive: '0', batchSize: 10,
    })).rejects.toBeInstanceOf(CandidateAuthError);
    const down = harness([], 503);
    await expect(down.transport.listChanges({
      domain: 'tasks', ownerId: id, afterExclusive: '0', batchSize: 10,
    })).rejects.toBeInstanceOf(CandidateHttpError);
  });

  it('refuses secret keys, insecure remote endpoints and malformed JSON', async () => {
    const session: CandidateSessionProvider = { getVerifiedSession: vi.fn().mockResolvedValue(verified) };
    expect(() => createCandidateHttpTransport({
      baseUrl: 'http://remote.example.com', publishableKey: key, session,
    })).toThrow('HTTPS');
    expect(() => createCandidateHttpTransport({
      baseUrl: 'https://synthetic.supabase.co', publishableKey: 'sb_secret_forbidden', session,
    })).toThrow('publishable key');
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'not a page' }), { status: 200 }),
    ) as unknown as typeof fetch;
    const transport = createCandidateHttpTransport({
      baseUrl: 'http://localhost:54321', publishableKey: key, session, fetcher,
    });
    await expect(transport.listChanges({
      domain: 'tasks', ownerId: id, afterExclusive: '0', batchSize: 10,
    })).rejects.toThrow('JSON page');
  });

  it('can feed checkpoint validation without connecting the Mosaic app', async () => {
    const row = {
      owner_id: id, id: 'task_test', title: 'Example', completed: false,
      category_id: '', order_index: 0, tags: null, task_date: '2026-10-19',
      memo: null, image: null, created_at: 'now', completed_at: null,
      updated_at: 'now', source: null, routine_id: null, reminder_time: null,
      reactions: null, visibility: 'private', is_deleted: false,
      change_seq: '12', server_updated_at: 'now',
    };
    const { transport } = harness([row]);
    const result = await pullCandidateTasks({
      transport, identity, checkpoint: { changeSeq: '11' }, batchSize: 10,
    });
    expect(result.checkpoint).toEqual({ changeSeq: '12' });
    expect(result.documents[0]).toMatchObject({
      id: 'task_test', userId: identity.legacyUserId, isDeleted: false, _deleted: false,
    });
  });
});
