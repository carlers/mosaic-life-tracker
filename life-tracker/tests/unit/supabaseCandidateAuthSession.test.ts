import { describe, expect, it, vi } from 'vitest';
import { createCandidateAuthSession, CandidateSessionError } from '../../supabase-poc/candidateAuthSession';
import { createCandidateHttpTransport } from '../../supabase-poc/candidateHttpTransport';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const KEY = 'sb_publishable_test_only';
const URL = 'https://isolated.test.supabase.co';
const access = (label: string) => 'signed-synthetic-token-' + label;
const refreshToken = (label: string) => 'synthetic-refresh-token-' + label;
const tokenBody = (id: string, label: string) => ({
  user: { id }, access_token: access(label), refresh_token: refreshToken(label),
  token_type: 'bearer', expires_in: 3600,
});
function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
function authFixture() {
  let owner = A;
  let refreshId = A;
  const requests: { url: string; init: RequestInit }[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init: init ?? {} });
    if (url.includes('grant_type=password')) {
      const data = JSON.parse(String(init?.body)) as { email: string };
      owner = data.email.startsWith('b@') ? B : A;
      return reply(tokenBody(owner, owner === A ? 'a' : 'b'));
    }
    if (url.includes('grant_type=refresh_token')) return reply(tokenBody(refreshId, 'rotated'));
    if (url.endsWith('/auth/v1/user')) {
      const bearer = (init?.headers as Record<string, string>)?.Authorization;
      return reply({ id: bearer === 'Bearer ' + access('b') ? B
        : bearer === 'Bearer ' + access('rotated') ? refreshId : A });
    }
    if (url.endsWith('/auth/v1/logout')) return new Response(null, { status: 204 });
    if (url.endsWith('/auth/v1/signup')) return reply({ user: { id: A } });
    if (url.endsWith('/auth/v1/recover')) return reply({});
    if (url.includes('/rest/v1/')) return reply([]);
    throw new Error('Unexpected local Auth request');
  });
  const session = createCandidateAuthSession({
    baseUrl: URL, publishableKey: KEY, fetcher: fetcher as typeof fetch,
  });
  return { session, fetcher, requests, setRefreshOwner(value: string) { refreshId = value; } };
}

describe('candidate Supabase session lifecycle (#1027)', () => {
  it('server-verifies login, then composes with existing owner-locked REST transport', async () => {
    const f = authFixture();
    expect(await f.session.getSessionSnapshot()).toBeNull();
    const signed = await f.session.signIn('A@example.org', 'synthetic-pass');
    expect(signed).toMatchObject({ userId: A, sessionEpoch: 1 });
    expect(await f.session.getVerifiedSession()).toEqual(signed);
    const transport = createCandidateHttpTransport({
      baseUrl: URL, publishableKey: KEY,
      session: f.session, fetcher: f.fetcher as typeof fetch,
    });
    await expect(transport.listChanges({
      domain: 'categories', ownerId: A, afterExclusive: '0', batchSize: 10,
    })).resolves.toEqual([]);
    await expect(transport.listChanges({
      domain: 'categories', ownerId: B, afterExclusive: '0', batchSize: 10,
    })).rejects.toThrow('matching verified session');
    expect(f.requests.filter(x => x.url.includes('/rest/v1/'))).toHaveLength(1);
    const first = f.requests[0];
    expect(first.url).toBe(URL + '/auth/v1/token?grant_type=password');
    expect(first.init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    expect(first.init.body).toContain('"email":"a@example.org"');
    expect(f.session.getOwnerId()).toBe(A);
    expect(f.session.getExpiresAt()).toBeGreaterThan(Date.now());
  });

  it('hard fences old-owner tokens before account switch and never falls back', async () => {
    const f = authFixture();
    const a = await f.session.signIn('a@example.org', 'synthetic-pass');
    const b = await f.session.signIn('b@example.org', 'synthetic-pass');
    expect(b.userId).toBe(B);
    expect(b.sessionEpoch).toBeGreaterThan(a.sessionEpoch);
    expect(await f.session.getVerifiedSession()).toEqual(b);
    const transport = createCandidateHttpTransport({
      baseUrl: URL, publishableKey: KEY, session: f.session,
      fetcher: f.fetcher as typeof fetch,
    });
    await expect(transport.listChanges({
      domain: 'tasks', ownerId: A, afterExclusive: '0', batchSize: 5,
    })).rejects.toThrow('matching verified session');
    expect(f.requests.filter(x => x.url.includes('/rest/v1/'))).toHaveLength(0);
  });

  it('never installs a response from a delayed login over a newer account', async () => {
    let release!: (value: Response) => void;
    let staleStarted!: () => void;
    const staleSignal = new Promise<void>(resolve => { staleStarted = resolve; });
    const pending = new Promise<Response>(resolve => { release = resolve; });
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('grant_type=password')) {
        const email = (JSON.parse(String(init?.body)) as { email: string }).email;
        if (email.startsWith('a@')) { staleStarted(); return pending; }
        return reply(tokenBody(B, 'b'));
      }
      if (url.endsWith('/auth/v1/user')) return reply({ id: B });
      throw new Error('Unexpected');
    });
    const s = createCandidateAuthSession({ baseUrl: URL, publishableKey: KEY, fetcher: fetcher as typeof fetch });
    const first = s.signIn('a@example.org', 'old');
    await staleSignal;
    const second = await s.signIn('b@example.org', 'new');
    release(reply(tokenBody(A, 'a')));
    await expect(first).rejects.toThrow('changed during login');
    expect(await s.getSessionSnapshot()).toEqual({
      accessToken: second.accessToken, sessionEpoch: second.sessionEpoch,
    });
  });

  it('refresh rotates the epoch, rejects wrong-owner refresh and shares in-flight attempts', async () => {
    const f = authFixture();
    const a = await f.session.signIn('a@example.org', 'password');
    const [one, two] = await Promise.all([f.session.refresh(), f.session.refresh()]);
    expect(one).toEqual(two);
    expect(one.sessionEpoch).toBeGreaterThan(a.sessionEpoch);
    expect(f.requests.filter(x => x.url.includes('grant_type=refresh_token'))).toHaveLength(1);
    f.setRefreshOwner(B);
    await expect(f.session.refresh()).rejects.toBeInstanceOf(CandidateSessionError);
    expect((await f.session.getSessionSnapshot())?.accessToken).toBe(one.accessToken);
  });

  it('signout clears local tokens even when revocation cannot be confirmed', async () => {
    const f = authFixture();
    await f.session.signIn('a@example.org', 'password');
    f.fetcher.mockImplementationOnce(async () => { throw Error('secret credentials'); });
    await expect(f.session.signOut()).resolves.toBe(false);
    expect(await f.session.getSessionSnapshot()).toBeNull();
    expect(f.session.getOwnerId()).toBeNull();
    expect(await f.session.getVerifiedSession()).toBeNull();
    await expect(f.session.refresh()).rejects.toThrow('No Supabase session');
  });

  it('confirms remote logout on HTTP 204 and erases local access promptly', async () => {
    const f = authFixture();
    await f.session.signIn('a@example.org', 'password');
    await expect(f.session.signOut()).resolves.toBe(true);
    expect(await f.session.getSessionSnapshot()).toBeNull();
    expect(f.requests.some(x => x.url.endsWith('/auth/v1/logout'))).toBe(true);
  });

  it('clears old login after a definitive refresh denial but not after an outage', async () => {
    const denied = authFixture();
    await denied.session.signIn('a@example.org', 'password');
    denied.fetcher.mockImplementationOnce(async () => reply({ error: 'invalid session' }, 401));
    await expect(denied.session.refresh()).rejects.toThrow('rejected by the server');
    expect(await denied.session.getSessionSnapshot()).toBeNull();

    const offline = authFixture();
    await offline.session.signIn('a@example.org', 'password');
    const before = await offline.session.getSessionSnapshot();
    offline.fetcher.mockImplementationOnce(async () => { throw Error('transient network outage'); });
    await expect(offline.session.refresh()).rejects.toThrow('Supabase Auth network unavailable');
    expect(await offline.session.getSessionSnapshot()).toEqual(before);
  });

  it('signup and recovery do not treat returned user metadata as an active login', async () => {
    const f = authFixture();
    await f.session.signUp('a@example.org', 'password123');
    expect(await f.session.getVerifiedSession()).toBeNull();
    await f.session.requestPasswordRecovery('a@example.org');
    const seen = f.requests.filter(x => /signup|recover/.test(x.url));
    expect(seen.map(x => x.url)).toEqual([
      URL + '/auth/v1/signup', URL + '/auth/v1/recover',
    ]);
  });

  it('denies malformed tokens, failed owner verification, unsafe keys and endpoints', async () => {
    const invalid = createCandidateAuthSession({
      baseUrl: URL, publishableKey: KEY,
      fetcher: vi.fn(async () => reply({ user: { id: A }, access_token: 'forged' })) as typeof fetch,
    });
    await expect(invalid.signIn('a@example.org', 'secret')).rejects.toThrow('Invalid or mismatched');
    expect(await invalid.getSessionSnapshot()).toBeNull();
    for (const url of ['http://malicious.example', 'https://secret:pw@example.org',
      'https://example.org/a/path']) {
      expect(() => createCandidateAuthSession({ baseUrl: url, publishableKey: KEY })).toThrow();
    }
    expect(() => createCandidateAuthSession({
      baseUrl: URL, publishableKey: 'sb_secret_unsafe',
    })).toThrow();
  });

  it('does not leak raw network exceptions into returned errors', async () => {
    const manager = createCandidateAuthSession({
      baseUrl: URL, publishableKey: KEY,
      fetcher: vi.fn(async () => { throw Error('sensitive password+bearer'); }) as typeof fetch,
    });
    await expect(manager.signIn('a@example.org', 'private_password'))
      .rejects.toThrow('Supabase Auth network unavailable');
  });
});
