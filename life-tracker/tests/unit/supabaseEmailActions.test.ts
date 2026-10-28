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

  it('recognizes standard GoTrue bearer redirects without accepting mixed or forged callbacks', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature_fake_for_test';
    const native = '#type=recovery&access_token=' + token +
      '&refresh_token=synthetic-secret&token_type=bearer&expires_in=3600';
    expect(parseEmailAction('/reset-password', native)).toEqual({ kind: 'recovery', accessToken: token });
    expect(parseEmailAction('/auth/confirm', native.replace('recovery', 'signup')))
      .toEqual({ kind: 'signup', accessToken: token });
    for (const hash of [
      native + '&token_hash=' + callback.tokenHash,
      native + '&access_token=second',
      native.replace('token_type=bearer', 'token_type=unknown'),
      native.replace('type=recovery', 'type=magiclink'),
      native.replace('refresh_token=synthetic-secret', ''),
      '#type=recovery&access_token=forged&refresh_token=synthetic-secret&token_type=bearer',
    ]) expect(parseEmailAction('/reset-password', hash)).toBeNull();
    expect(parseEmailAction('/home', native)).toBeNull();
  });

  it('server-verifies a native recovery bearer without token exchange, durable storage or another account', async () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature_fake_for_test';
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith('/user') && init?.method === 'GET') return json(user);
      if (url.endsWith('/user') && init?.method === 'PUT') return json(user);
      if (url.endsWith('/logout?scope=local')) return new Response(null, { status: 204 });
      throw Error('Unexpected request');
    });
    const actions = createSupabaseEmailActions({
      ...config, callback: { kind: 'recovery', accessToken: token }, fetcher,
    });
    await expect(actions.verify()).resolves.toEqual({ kind: 'recovery', email: user.email });
    expect(requests.map(r => r.init?.method)).toEqual(['GET']);
    await expect(actions.resetPassword('new secure password')).resolves.toEqual({ revoked: true });
    expect(requests.map(r => r.init?.method)).toEqual(['GET', 'GET', 'PUT', 'POST']);
    expect(requests.every(r => !r.url.includes(token) && !r.url.includes('synthetic-secret'))).toBe(true);
    expect(requests[2].init?.body).toBe(JSON.stringify({ password: 'new secure password' }));
    await expect(actions.verify()).rejects.toThrow('completed');
  });

  it('refuses a native bearer when GoTrue denies it and never submits a password', async () => {
    const fetcher = vi.fn(async () => json({ message: 'JWT expired' }, 401));
    const actions = createSupabaseEmailActions({
      ...config, callback: { kind: 'recovery', accessToken: 'fake.jwt.token' }, fetcher,
    });
    await expect(actions.verify()).rejects.toThrow('rejected');
    await expect(actions.resetPassword('secure password')).rejects.toThrow('Verify');
    expect(fetcher).toHaveBeenCalledTimes(1);
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
