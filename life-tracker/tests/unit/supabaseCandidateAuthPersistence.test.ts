import { describe, expect, it, vi } from 'vitest';
import {
  createCandidateAuthSession, type CandidateSessionPersistence,
} from '../../supabase-poc/candidateAuthSession';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const URL = 'https://isolated.test.supabase.co';
const KEY = 'sb_publishable_test_only';
const token = (label: string) => 'signed-synthetic-access-' + label;
const refresh = (label: string) => 'synthetic-refresh-credential-' + label;
const body = (owner: string, label: string) => ({
  user: { id: owner }, access_token: token(label),
  refresh_token: refresh(label), expires_in: 3600, token_type: 'bearer',
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

function fixture() {
  const saved = new Map<string, string>();
  const storage: CandidateSessionPersistence = {
    getItem: vi.fn((key: string) => saved.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { saved.set(key, value); }),
    removeItem: vi.fn((key: string) => { saved.delete(key); }),
  };
  let offline = false;
  let denied = false;
  let wrongOwner = false;
  let refreshLabel = 'rotated';
  let releaseRefresh: (() => Promise<Response>) | null = null;
  const requests: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push(url);
    if (url.includes('grant_type=password')) {
      const params = JSON.parse(String(init?.body)) as { email: string };
      return response(body(params.email.startsWith('b@') ? B : A, params.email.startsWith('b@') ? 'b' : 'a'));
    }
    if (url.includes('grant_type=refresh_token')) {
      if (offline) throw Error('network offline with sensitive key');
      if (denied) return response({ error: 'session revoked' }, 401);
      if (releaseRefresh) return releaseRefresh();
      return response(body(A, refreshLabel));
    }
    if (url.endsWith('/auth/v1/user')) {
      const bearer = (init?.headers as Record<string, string>)?.Authorization;
      const owner = bearer === 'Bearer ' + token('b') ? B : A;
      return response({ id: wrongOwner ? B : owner });
    }
    if (url.endsWith('/auth/v1/logout')) throw Error('network failed');
    throw Error('Unexpected synthetic endpoint');
  });
  const create = (endpoint = URL) => createCandidateAuthSession({
    baseUrl: endpoint, publishableKey: KEY, persistence: storage,
    fetcher: fetcher as typeof fetch,
  });
  return {
    saved, storage, requests, create, fetcher,
    offline: (value: boolean) => { offline = value; },
    denied: (value: boolean) => { denied = value; },
    wrongOwner: (value: boolean) => { wrongOwner = value; },
    delayRefresh: (fn: () => Promise<Response>) => { releaseRefresh = fn; },
    nextRefresh: (value: string) => { refreshLabel = value; },
  };
}

describe('isolated candidate persisted Supabase refresh restoration (#1027)', () => {
  it('stores only owner and refresh credential; no JWT, password, email or cached auth', async () => {
    const f = fixture();
    const first = f.create();
    const signed = await first.signIn('a@example.test', 'never-store-password');
    expect(signed.userId).toBe(A);
    const persisted = [...f.saved.values()];
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toContain(refresh('a'));
    expect(persisted[0]).not.toContain(token('a'));
    expect(persisted[0]).not.toContain('never-store-password');
    expect(persisted[0]).not.toContain('a@example.test');
    const reloaded = f.create();
    expect(await reloaded.getSessionSnapshot()).toBeNull();
    expect(reloaded.getOwnerId()).toBeNull();
    const restored = await reloaded.restoreFromPersistence();
    expect(restored?.userId).toBe(A);
    expect(await reloaded.getVerifiedSession()).toEqual(restored);
    expect([...f.saved.values()][0]).toContain(refresh('rotated'));
    expect([...f.saved.values()][0]).not.toContain(refresh('a'));
    expect(f.requests.some(url => url.endsWith('/auth/v1/user'))).toBe(true);
  });

  it('keeps a pending token across outage without treating cached owner as signed', async () => {
    const f = fixture();
    await f.create().signIn('a@example.test', 'password');
    const next = f.create();
    f.offline(true);
    await expect(next.restoreFromPersistence()).rejects.toThrow('network unavailable');
    expect(next.getOwnerId()).toBeNull();
    expect(await next.getVerifiedSession()).toBeNull();
    expect(f.saved.size).toBe(1);
    f.offline(false);
    expect((await next.restoreFromPersistence())?.userId).toBe(A);
  });

  it('erases saved refresh and refuses re-entry on confirmed server denial', async () => {
    const f = fixture();
    await f.create().signIn('a@example.test', 'password');
    f.denied(true);
    const next = f.create();
    await expect(next.restoreFromPersistence()).rejects.toThrow('rejected by the server');
    expect(f.saved.size).toBe(0);
    expect(await next.getSessionSnapshot()).toBeNull();
    expect(await next.restoreFromPersistence()).toBeNull();
  });

  it('does not trust malformed owner/JSON or a wrong signed account', async () => {
    const f = fixture();
    f.saved.set('mosaic_candidate_supabase_refresh_v1:' + URL, '{"version":1,"origin":"'+URL+'","ownerId":"forged"}');
    await expect(f.create().restoreFromPersistence()).rejects.toThrow('Invalid stored');
    expect(f.saved.size).toBe(0);
    await f.create().signIn('a@example.test', 'password');
    f.wrongOwner(true);
    await expect(f.create().restoreFromPersistence()).rejects.toThrow('rejected by the server');
    expect(f.saved.size).toBe(0);
  });

  it('cannot overwrite a newer signed account with a delayed restore', async () => {
    const f = fixture();
    await f.create().signIn('a@example.test', 'password');
    const manager = f.create();
    let release!: (reply: Response) => void;
    let started!: () => void;
    const begun = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<Response>(resolve => { release = resolve; });
    f.delayRefresh(() => { started(); return pending; });
    const old = manager.restoreFromPersistence();
    await begun;
    const newer = await manager.signIn('b@example.test', 'password');
    release(response(body(A, 'rotated')));
    await expect(old).rejects.toThrow('changed during restore');
    expect(manager.getOwnerId()).toBe(B);
    expect((await manager.getSessionSnapshot())?.accessToken).toBe(newer.accessToken);
    expect([...f.saved.values()][0]).toContain(refresh('b'));
  });

  it('clears persisted refresh on logout even when remote revocation is unconfirmed', async () => {
    const f = fixture();
    const session = f.create();
    await session.signIn('a@example.test', 'password');
    await expect(session.signOut()).resolves.toBe(false);
    expect(f.saved.size).toBe(0);
    expect(await session.getSessionSnapshot()).toBeNull();
    expect(await f.create().restoreFromPersistence()).toBeNull();
  });

  it('refuses to acknowledge a rotated refresh when storage cannot write it', async () => {
    const f = fixture();
    const session = f.create();
    await session.signIn('a@example.test', 'password');
    vi.mocked(f.storage.setItem).mockImplementationOnce(() => { throw Error('secret browser quota'); });
    await expect(session.refresh()).rejects.toThrow('Cannot save stored Supabase session');
    expect(await session.getSessionSnapshot()).toBeNull();
    expect(f.saved.size).toBe(0);
  });
});
