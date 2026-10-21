import { describe, expect, it, vi } from 'vitest';
import { createSupabaseEmailActions, parseEmailAction } from '../../src/lib/supabaseEmailActions';

const owner = '11111111-1111-4111-8111-111111111111';
const config = { baseUrl: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };
const callback = { kind: 'recovery' as const, tokenHash: 'a'.repeat(64) };
const user = { id: owner, email: 'fixture@example.org', email_confirmed_at: '2026-10-20T00:00:00Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function fixture() {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith('/verify')) return json({ user, access_token: 'test-access-token', refresh_token: 'test-refresh-token' });
    if (url.endsWith('/user')) return json(user);
    if (url.endsWith('/logout?scope=local')) return new Response(null, { status: 204 });
    throw Error('Unexpected request');
  });
  return { requests, fetcher, actions: createSupabaseEmailActions({ ...config, callback, fetcher }) };
}

describe('isolated email verification and password recovery', () => {
  it('verifies a clean-route email code only in a POST body, without exposing it in navigation', async () => {
    const { requests, fetcher } = fixture();
    const actions = createSupabaseEmailActions({ ...config, kind: 'recovery', callback: null, fetcher });
    await expect(actions.verifyCode(user.email, '123456')).resolves.toEqual({ kind: 'recovery', email: user.email });
    expect(requests[0].init?.body).toBe(JSON.stringify({
      email: user.email, token: '123456', type: 'recovery',
    }));
    expect(requests.every(request => !request.url.includes('123456') &&
      !request.url.includes(user.email) && !request.url.includes(callback.tokenHash))).toBe(true);
    await expect(actions.resetPassword('new secure password')).resolves.toEqual({ revoked: true });
    await expect(actions.verifyCode(user.email, '123456')).rejects.toThrow('completed');
  });

  it('rejects malformed codes and mismatched verified email accounts', async () => {
    const { fetcher } = fixture();
    const actions = createSupabaseEmailActions({ ...config, kind: 'signup', callback: null, fetcher });
    await expect(actions.verifyCode(user.email, '12345x')).rejects.toThrow('valid email address and code');
    expect(fetcher).not.toHaveBeenCalled();
    await expect(actions.verifyCode('other@example.org', '123456')).rejects.toThrow('could not be verified');
    await expect(actions.finishConfirmation()).rejects.toThrow('Verify');
  });

  it('accepts only the expected fragment, route and single-use email action type', () => {
    expect(parseEmailAction('/reset-password', '#type=recovery&token_hash=' + callback.tokenHash)).toEqual(callback);
    expect(parseEmailAction('/auth/confirm', '#type=signup&token_hash=' + callback.tokenHash)).toEqual({ ...callback, kind: 'signup' });
    for (const [path, hash] of [
      ['/home', '#type=recovery&token_hash=' + callback.tokenHash],
      ['/reset-password', '#type=signup&token_hash=' + callback.tokenHash],
      ['/reset-password', '#type=recovery&token_hash=x'],
      ['/reset-password', '#type=recovery&type=signup&token_hash=' + callback.tokenHash],
      ['/reset-password', '#type=recovery&access_token=anything'],
    ]) expect(parseEmailAction(path, hash)).toBeNull();
  });

  it('requires live account verification before changing a password and revokes only the link session', async () => {
    const { actions, requests } = fixture();
    await expect(actions.resetPassword('a secure new password')).rejects.toThrow('Verify');
    expect(requests).toHaveLength(0);
    expect(await actions.verify()).toEqual({ kind: 'recovery', email: user.email });
    await expect(actions.resetPassword('a secure new password')).resolves.toEqual({ revoked: true });
    expect(requests.map(r => [new URL(r.url).pathname, r.init?.method])).toEqual([
      ['/auth/v1/verify', 'POST'], ['/auth/v1/user', 'GET'],
      ['/auth/v1/user', 'GET'], ['/auth/v1/user', 'PUT'], ['/auth/v1/logout', 'POST'],
    ]);
    expect(requests[0].init?.body).toBe(JSON.stringify({ token_hash: callback.tokenHash, type: 'recovery' }));
    expect(requests[3].init?.body).toBe(JSON.stringify({ password: 'a secure new password' }));
    for (const request of requests) {
      expect(request.url).not.toContain(callback.tokenHash);
      expect(request.url).not.toContain('test-access-token');
      expect(request.init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    }
    await expect(actions.resetPassword('another secure password')).rejects.toThrow('Verify');
  });

  it('rejects a signed owner mismatch without sending a password', async () => {
    const { actions, fetcher, requests } = fixture();
    await actions.verify();
    fetcher.mockResolvedValueOnce(json({ ...user, id: '22222222-2222-4222-8222-222222222222' }));
    await expect(actions.resetPassword('new secret password')).rejects.toThrow('account');
    expect(requests.some(r => r.init?.method === 'PUT')).toBe(false);
  });

  it('deduplicates verification and does not expose raw network errors or trust user metadata', async () => {
    const { actions, fetcher } = fixture();
    fetcher.mockRejectedValueOnce(Error('private token: ' + callback.tokenHash));
    await expect(actions.verify()).rejects.toThrow('unavailable');
    await expect(actions.verify()).resolves.toMatchObject({ email: user.email });
    expect(fetcher).toHaveBeenCalledTimes(3);
    const check = fixture();
    await Promise.all([check.actions.verify(), check.actions.verify()]);
    expect(check.fetcher).toHaveBeenCalledTimes(2);
  });

  it('never permits a confirmation grant to change a password', async () => {
    const { fetcher, requests } = fixture();
    const actions = createSupabaseEmailActions({ ...config, callback: { ...callback, kind: 'signup' }, fetcher });
    await actions.verify();
    await expect(actions.resetPassword('new secure password')).rejects.toThrow('recovery');
    await expect(actions.finishConfirmation()).resolves.toEqual({ revoked: true });
    expect(requests.some(r => r.init?.method === 'PUT')).toBe(false);
  });

  it('reports uncertain revocation without retrying a completed password change', async () => {
    const { actions, fetcher } = fixture();
    await actions.verify();
    const implementation = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (url, init) => String(url).includes('/logout')
      ? json({}, 503) : implementation(url, init));
    await expect(actions.resetPassword('new secure password')).resolves.toEqual({ revoked: false });
    await expect(actions.resetPassword('new secure password')).rejects.toThrow('Verify');
  });
});
