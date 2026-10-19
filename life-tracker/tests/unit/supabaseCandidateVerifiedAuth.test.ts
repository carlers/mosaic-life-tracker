import { describe, expect, it, vi } from 'vitest';
import { CandidateAuthVerificationError, createCandidateVerifiedAuthProvider } from '../../supabase-poc/candidateVerifiedAuth';
import { createCandidateHttpTransport } from '../../supabase-poc/candidateHttpTransport';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const key = 'sb_publishable_synthetic_only';
const snapshot = { accessToken: 'synthetic-JWT-not-real', sessionEpoch: 1 };

function factory({
  id = A, status = 200, before = snapshot, after = snapshot,
}: {
  id?: string; status?: number; before?: typeof snapshot | null; after?: typeof snapshot | null;
} = {}) {
  const getSessionSnapshot = vi.fn()
    .mockResolvedValueOnce(before)
    .mockResolvedValue(after);
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ id }), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
  const provider = createCandidateVerifiedAuthProvider({
    baseUrl: 'https://synthetic.supabase.co',
    publishableKey: key, sessions: { getSessionSnapshot },
    fetcher: fetcher as typeof fetch,
  });
  return { provider, fetcher, getSessionSnapshot };
}

describe('isolated candidate Supabase server-verified Auth boundary (#967)', () => {
  it('sends the token ONLY to /auth/v1/user and accepts signed-in server identity', async () => {
    const { provider, fetcher, getSessionSnapshot } = factory();
    expect(await provider.getVerifiedSession()).toEqual({
      userId: A, accessToken: snapshot.accessToken, sessionEpoch: 1,
    });
    expect(getSessionSnapshot).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, req] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://synthetic.supabase.co/auth/v1/user');
    expect(req).toMatchObject({
      method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: { apikey: key, Authorization: 'Bearer ' + snapshot.accessToken },
    });
  });

  it('does no network request without a signed-in Auth session', async () => {
    const { provider, fetcher } = factory({ before: null });
    expect(await provider.getVerifiedSession()).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects denied, malformed and offline verification without allowing cached claims', async () => {
    const denied = factory({ status: 401 });
    expect(await denied.provider.getVerifiedSession()).toBeNull();
    const denied403 = factory({ status: 403 });
    expect(await denied403.provider.getVerifiedSession()).toBeNull();
    const invalid = factory({ id: 'not-a-uuid' });
    await expect(invalid.provider.getVerifiedSession()).rejects.toThrow(/identity/);
    const serverError = factory({ status: 503 });
    await expect(serverError.provider.getVerifiedSession()).rejects
      .toBeInstanceOf(CandidateAuthVerificationError);
    const offline = factory();
    offline.fetcher.mockRejectedValue(new Error('test secret in raw network error'));
    await expect(offline.provider.getVerifiedSession()).rejects.toThrow('Cannot verify Supabase Auth session');
  });

  it('fails closed if session changed or token rotated while verifying', async () => {
    const switched = factory({ after: { accessToken: 'new-account-token', sessionEpoch: 2 } });
    await expect(switched.provider.getVerifiedSession()).rejects.toThrow(/changed/);
    const rotatedWithoutEpoch = factory({ after: { accessToken: 'rotated-token', sessionEpoch: 1 } });
    await expect(rotatedWithoutEpoch.provider.getVerifiedSession()).rejects.toThrow(/changed/);
    const loggedOut = factory({ after: null });
    await expect(loggedOut.provider.getVerifiedSession()).rejects.toThrow(/changed/);
  });

  it('refuses secret keys, attacker URLs and invalid snapshot data', async () => {
    for (const baseUrl of ['http://evil.example', 'https://fake.org/evil',
      'https://name:password@fake.org', 'https://fake.org?leak=yes']) {
      expect(() => createCandidateVerifiedAuthProvider({
        baseUrl, publishableKey: key,
        sessions: { getSessionSnapshot: async () => snapshot },
      })).toThrow();
    }
    expect(() => createCandidateVerifiedAuthProvider({
      baseUrl: 'https://synthetic.supabase.co', publishableKey: 'sb_secret_unsafe',
      sessions: { getSessionSnapshot: async () => snapshot },
    })).toThrow();
    const invalid = factory({ before: { accessToken: ' bad token ', sessionEpoch: 1 } });
    await expect(invalid.provider.getVerifiedSession()).rejects.toThrow(/snapshot/);
    expect(invalid.fetcher).not.toHaveBeenCalled();
  });

  it('composes verification with candidate REST pull and rejects wrong server identity', async () => {
    let authCalls = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/v1/user')) {
        authCalls += 1;
        return new Response(JSON.stringify({ id: A }), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    });
    const sessions = { getSessionSnapshot: async () => snapshot };
    const session = createCandidateVerifiedAuthProvider({
      baseUrl: 'https://synthetic.supabase.co', publishableKey: key,
      sessions, fetcher: fetcher as typeof fetch,
    });
    const transport = createCandidateHttpTransport({
      baseUrl: 'https://synthetic.supabase.co', publishableKey: key,
      session, fetcher: fetcher as typeof fetch,
    });
    expect(await transport.listChanges({
      domain: 'tasks', ownerId: A, afterExclusive: '0', batchSize: 10,
    })).toEqual([]);
    expect(authCalls).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(3);

    const foreign = factory({ id: B });
    const foreignTransport = createCandidateHttpTransport({
      baseUrl: 'https://synthetic.supabase.co', publishableKey: key,
      session: foreign.provider, fetcher: foreign.fetcher as typeof fetch,
    });
    await expect(foreignTransport.listChanges({
      domain: 'tasks', ownerId: A, afterExclusive: '0', batchSize: 10,
    })).rejects.toThrow(/matching verified session/);
    expect(foreign.fetcher).toHaveBeenCalledTimes(1);
  });
});
