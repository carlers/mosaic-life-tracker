import { describe, expect, it, vi } from 'vitest';
import { CandidateAuthError } from '../../supabase-poc/candidateHttpTransport';
import { createCandidateCasTransport } from '../../supabase-poc/candidateCasTransport';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const session = { userId: owner, accessToken: 'signed-synthetic-token', sessionEpoch: 7 };
const key = 'sb_publishable_synthetic_only';
const currentRevision = '9007199254740993';
const nextRevision = '9007199254740994';
const accepted = {
  owner_id: owner, id: 'original-task', change_seq: nextRevision,
  is_deleted: true, title: 'Done',
};

function setup(data: unknown = accepted, status = 200) {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(data), { status }));
  const getVerifiedSession = vi.fn().mockResolvedValue(session);
  const transport = createCandidateCasTransport({
    baseUrl: 'https://synthetic.supabase.co', publishableKey: key,
    session: { getVerifiedSession }, fetcher: fetcher as typeof fetch,
  });
  return { fetcher, getVerifiedSession, transport };
}
const args = {
  domain: 'tasks' as const, ownerId: owner, documentId: 'original-task',
  expectedRevision: currentRevision,
  patch: { title: 'Done', is_deleted: true },
};

describe('isolated Supabase candidate atomic CAS transport (#967)', () => {
  it('uses authenticated RPC, not unguarded UPDATE, and preserves bigint precision', async () => {
    const { transport, fetcher, getVerifiedSession } = setup();
    const result = await transport.compareAndSet(args);
    expect(result).toMatchObject({
      state: 'applied', revision: nextRevision, row: accepted,
    });
    expect(getVerifiedSession).toHaveBeenCalledTimes(2);
    const [url, request] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://synthetic.supabase.co/rest/v1/rpc/mosaic_candidate_cas_task');
    expect(request).toMatchObject({
      method: 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: {
        apikey: key, Authorization: 'Bearer ' + session.accessToken,
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(request.body))).toEqual({
      p_id: 'original-task', p_expected_seq: currentRevision,
      p_patch: { title: 'Done', is_deleted: true },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports a stale/missing/foreign null CAS result as conflict without revision advance', async () => {
    const { transport, fetcher } = setup(null);
    expect(await transport.compareAndSet(args)).toEqual({ state: 'conflict' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('supports the category RPC without granting unrestricted patch fields', async () => {
    const { transport, fetcher } = setup({
      owner_id: owner, id: 'category', change_seq: '2', is_deleted: false, color: '#123456',
    });
    const result = await transport.compareAndSet({
      domain: 'categories', ownerId: owner, documentId: 'category',
      expectedRevision: '1', patch: { color: '#123456' },
    });
    expect(result.state).toBe('applied');
    expect(fetcher.mock.calls[0][0]).toContain('mosaic_candidate_cas_category');
  });

  it('refuses owner/id/revision injection and invalid JSON patch before network', async () => {
    const { transport, fetcher } = setup();
    for (const patch of [
      { owner_id: other }, { id: 'switched' }, { change_seq: '10' },
      { server_updated_at: 'now' }, {}, { title: { nested: 'bad' } },
      { title: Number.POSITIVE_INFINITY },
    ]) {
      await expect(transport.compareAndSet({
        ...args, patch: patch as typeof args.patch,
      })).rejects.toThrow();
    }
    await expect(transport.compareAndSet({ ...args, expectedRevision: '0' })).rejects.toThrow();
    await expect(transport.compareAndSet({ ...args, expectedRevision: '9007199254740992.5' }))
      .rejects.toThrow();
    await expect(transport.compareAndSet({ ...args, documentId: '' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects foreign, stale, malformed and non-tombstone responses after HTTP', async () => {
    for (const response of [
      { ...accepted, owner_id: other }, { ...accepted, id: 'other-task' },
      { ...accepted, change_seq: currentRevision },
      { ...accepted, change_seq: 9007199254740994 }, // unsafe numeric > 2^53
      { ...accepted, is_deleted: null }, [],
    ]) {
      const { transport } = setup(response);
      await expect(transport.compareAndSet(args)).rejects.toThrow();
    }
  });

  it('rejects changed token or account while write was in flight', async () => {
    const { transport, getVerifiedSession } = setup();
    getVerifiedSession.mockResolvedValueOnce(session).mockResolvedValue({
      ...session, accessToken: 'rotated-token-without-new-epoch',
    });
    await expect(transport.compareAndSet(args)).rejects.toBeInstanceOf(CandidateAuthError);
    const second = setup();
    second.getVerifiedSession.mockResolvedValueOnce(session).mockResolvedValue({
      userId: other, accessToken: 'different-session', sessionEpoch: 8,
    });
    await expect(second.transport.compareAndSet(args)).rejects.toBeInstanceOf(CandidateAuthError);
  });

  it('distinguishes denied auth from HTTP failure without automatic retry', async () => {
    const denied = setup({ message: 'JWT expired' }, 401);
    await expect(denied.transport.compareAndSet(args)).rejects.toBeInstanceOf(CandidateAuthError);
    const failed = setup({ message: 'unavailable' }, 503);
    await expect(failed.transport.compareAndSet(args)).rejects.toThrow(/status 503/);
    expect(failed.fetcher).toHaveBeenCalledTimes(1);
  });

  it('refuses unsafe or secret-bearing service configuration', () => {
    for (const baseUrl of ['http://external.example', 'https://example.org/other',
      'https://u:pass@example.org', 'https://example.org?credential=yes']) {
      expect(() => createCandidateCasTransport({
        baseUrl, publishableKey: key,
        session: { getVerifiedSession: async () => session },
      })).toThrow();
    }
    expect(() => createCandidateCasTransport({
      baseUrl: 'https://synthetic.supabase.co', publishableKey: 'sb_secret_unsafe',
      session: { getVerifiedSession: async () => session },
    })).toThrow();
  });
});
