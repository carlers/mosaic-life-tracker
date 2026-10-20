import { describe, expect, it, vi } from 'vitest';
import { createSupabaseBrowserSession } from '../../src/lib/supabaseBrowserSession';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const identity = { legacyUserId: 'mosaic_owner', supabaseUserId: OWNER };

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: (key: string) => { values.delete(key); },
  };
  let queue = Promise.resolve();
  const exclusive = <T,>(_name: string, work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.then(() => {}, () => {});
    return result;
  };
  let counter = 0;
  let currentRefresh = '';
  let owner = OWNER;
  const accessOwners = new Map<string, string>();
  const rotations: string[] = [];
  let offline = false;
  let denied = false;
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (offline) throw new TypeError('offline');
    if (String(url).includes('/logout')) return new Response(null, { status: 204 });
    if (denied) return Response.json({}, { status: 401 });
    if (String(url).endsWith('/user')) {
      const token = new Headers(init?.headers).get('Authorization')?.slice(7) ?? '';
      return Response.json({ id: accessOwners.get(token) });
    }
    const body = JSON.parse(String(init?.body));
    if (String(url).includes('refresh_token')) {
      rotations.push(body.refresh_token);
      if (body.refresh_token !== currentRefresh)
        return Response.json({ error_code: 'refresh_token_already_used' }, { status: 400 });
    } else {
      owner = body.email === 'other@example.org' ? OTHER : OWNER;
    }
    counter++;
    const access = 'synthetic_access_' + counter;
    currentRefresh = 'synthetic_refresh_' + counter;
    accessOwners.set(access, owner);
    return Response.json({
      user: { id: owner }, access_token: access, refresh_token: currentRefresh,
      expires_in: 3600, token_type: 'bearer',
    });
  }) as unknown as typeof fetch;
  const tab = () => createSupabaseBrowserSession({
    baseUrl: 'https://isolated.supabase.test', publishableKey: 'sb_publishable_synthetic',
    storage, exclusive, randomId: () => crypto.randomUUID(), fetcher,
  });
  return { tab, storage, values, rotations, fetcher,
    offline: (value: boolean) => { offline = value; },
    deny: () => { denied = true; },
  };
}
async function login(f: ReturnType<typeof fixture>) {
  const tab = f.tab();
  await tab.session.signIn('owner@example.org', 'synthetic password');
  await tab.rememberIdentity(identity, 'owner@example.org');
  return tab;
}

describe('durable browser Supabase session', () => {
  it('serializes separate tabs and always rotates the latest durable refresh token', async () => {
    const f = fixture();
    const first = await login(f);
    const second = f.tab();
    const third = f.tab();
    await Promise.all([second.session.restoreFromPersistence(), third.session.restoreFromPersistence()]);
    await Promise.all([first.session.refresh(), second.session.refresh(), third.session.refresh()]);
    expect(f.rotations).toEqual(Array.from({ length: 5 }, (_, i) => 'synthetic_refresh_' + (i + 1)));
    expect((await first.session.getVerifiedSession())?.userId).toBe(OWNER);
    const saved = [...f.values.values()].join('');
    expect(saved).not.toContain('synthetic_access_');
    expect(saved).not.toContain('synthetic password');
  });

  it('opens only a cached local identity offline, retains it after outage, then restores signed authority', async () => {
    const f = fixture();
    await login(f);
    const reopened = f.tab();
    expect(reopened.getCachedIdentity()).toEqual({ ...identity, email: 'owner@example.org' });
    expect(await reopened.session.getVerifiedSession()).toBeNull();
    f.offline(true);
    await expect(reopened.session.restoreFromPersistence()).rejects.toThrow();
    expect(reopened.getCachedIdentity()?.legacyUserId).toBe(identity.legacyUserId);
    expect(await reopened.session.getSessionSnapshot()).toBeNull();
    f.offline(false);
    await reopened.session.restoreFromPersistence();
    expect((await reopened.session.getVerifiedSession())?.userId).toBe(OWNER);
  });

  it('fences delayed old tabs and prevents their logout or refresh from overwriting another login', async () => {
    const f = fixture();
    const stale = await login(f);
    const replacement = f.tab();
    await replacement.session.signIn('other@example.org', 'synthetic password');
    expect(await stale.session.getSessionSnapshot()).toBeNull();
    expect(await stale.session.getVerifiedSession()).toBeNull();
    expect(stale.getCachedIdentity()).toBeNull();
    await expect(stale.session.refresh()).rejects.toThrow();
    await stale.session.signOut();
    expect((await replacement.session.getVerifiedSession())?.userId).toBe(OTHER);
  });

  it('does not resurrect a logged-out browser on a delayed restore and revokes remotely', async () => {
    const f = fixture();
    const first = await login(f);
    const second = f.tab();
    await second.session.restoreFromPersistence();
    expect(await first.session.signOut()).toBe(true);
    expect(f.fetcher).toHaveBeenCalledWith(expect.stringContaining('/logout?scope=local'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer synthetic_access_') }) }));
    await expect(second.session.refresh()).rejects.toThrow();
    expect(await f.tab().session.restoreFromPersistence()).toBeNull();
    expect(f.values.size).toBe(0);
  });

  it('removes cached local trust on definitive Auth rejection, but not network uncertainty', async () => {
    const f = fixture();
    const first = await login(f);
    f.deny();
    expect(await first.session.getVerifiedSession()).toBeNull();
    expect(f.tab().getCachedIdentity()).toBeNull();
    expect(f.values.size).toBe(0);
  });

  it('retains the refresh family when replication wakes with an expired access JWT', async () => {
    const f = fixture();
    const first = await login(f);
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600_000);
    try {
      await expect(first.session.getVerifiedSession()).rejects.toThrow('renewal');
      expect(f.tab().getCachedIdentity()?.legacyUserId).toBe(identity.legacyUserId);
      await first.session.refresh();
      expect((await first.session.getVerifiedSession())?.userId).toBe(OWNER);
    } finally { now.mockRestore(); }
  });

  it('does not acknowledge a rotated credential if durable storage fails', async () => {
    const f = fixture();
    const first = await login(f);
    f.storage.setItem.mockImplementationOnce(() => { throw Error('quota'); });
    await expect(first.session.refresh()).rejects.toThrow('quota');
    expect(await first.session.getSessionSnapshot()).toBeNull();
  });

  it('fails closed when browser storage becomes unreadable and does not acknowledge logout', async () => {
    const f = fixture();
    const first = await login(f);
    vi.spyOn(f.storage, 'getItem').mockImplementation(() => { throw Error('storage unavailable'); });
    expect(first.isCurrent()).toBe(false);
    expect(first.getCachedIdentity()).toBeNull();
    expect(await first.session.getVerifiedSession()).toBeNull();
    await expect(first.session.signOut()).rejects.toThrow('storage unavailable');
    expect(f.values.size).toBe(1);
  });

  it('retains the family on view teardown without giving a cached hint remote authority', async () => {
    const f = fixture();
    const first = await login(f);
    first.session.discardMemory();
    expect(await first.session.getVerifiedSession()).toBeNull();
    expect(f.tab().getCachedIdentity()?.legacyUserId).toBe(identity.legacyUserId);
    expect(f.fetcher).not.toHaveBeenCalledWith(expect.stringContaining('/logout'), expect.anything());
  });

  it('rejects corrupt or foreign cached owner records', async () => {
    const f = fixture();
    const first = await login(f);
    const record = JSON.parse(f.storage.getItem(first.storageKey)!);
    record.cache.supabaseUserId = OTHER;
    f.storage.setItem(first.storageKey, JSON.stringify(record));
    expect(f.tab().getCachedIdentity()).toBeNull();
    expect(await first.session.getVerifiedSession()).toBeNull();
    expect(await f.tab().session.restoreFromPersistence()).toBeNull();
  });
});
