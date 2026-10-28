import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RootAuthProvider } from '../../src/hooks/RootAuthProvider';
import { captureEmailActionCallback, clearEmailActionCallback, readEmailActionCallback } from '../../src/lib/emailActionCallback';

const providers = vi.hoisted(() => ({ appwrite: vi.fn(), supabase: vi.fn() }));
vi.mock('../../src/lib/coreBackendConfig', () => ({ CORE_BACKEND: {
  driver: 'supabase', baseUrl: 'https://example.supabase.co', publishableKey: 'sb_publishable_test',
} }));
vi.mock('../../src/hooks/AuthProvider', () => ({ AuthProvider: providers.appwrite }));
vi.mock('../../src/hooks/SupabaseAuthProvider', () => ({ default: providers.supabase }));
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'target@example.org', email_confirmed_at: '2026-10-20T00:00:00Z' };
let fetcher: ReturnType<typeof vi.fn>;
function open(path = '/reset-password', kind = 'recovery') {
  window.history.replaceState(null, '', `${path}#type=${kind}&token_hash=${'a'.repeat(64)}`);
  captureEmailActionCallback(window);
  render(<RootAuthProvider><p>Ordinary account application</p></RootAuthProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn(async (url: string) => url.includes('/logout') ? new Response(null, { status: 204 }) :
    new Response(JSON.stringify(url.endsWith('/verify')
      ? { access_token: 'disposable-link-access', user } : user)));
  vi.stubGlobal('fetch', fetcher);
  localStorage.setItem('existing-account', 'untouched account data');
});
afterEach(() => {
  cleanup();
  clearEmailActionCallback();
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('provider-neutral email recovery route', () => {
  it('accepts email/code after clean navigation without mounting any account writer', async () => {
    window.history.replaceState(null, '', '/reset-password');
    captureEmailActionCallback(window);
    render(<RootAuthProvider><p>Ordinary account application</p></RootAuthProvider>);
    expect(await screen.findByLabelText('Email address', { exact: true })).toBeVisible();
    expect(screen.getByLabelText('Email code', { exact: true })).toBeVisible();
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText('Email address', { exact: true }),
      { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText('Email code', { exact: true }),
      { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email code' }));
    expect(await screen.findByRole('status')).toHaveTextContent(user.email);
    expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify({
      email: user.email, token: '123456', type: 'recovery',
    }));
    expect(providers.appwrite).not.toHaveBeenCalled();
    expect(providers.supabase).not.toHaveBeenCalled();
    expect(localStorage.getItem('existing-account')).toBe('untouched account data');
  });

  it('does not clear a replacement link when the previous verification finishes late', async () => {
    let finish!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Verify email link' }));
    act(() => {
      window.history.replaceState(null, '', '/reset-password#type=recovery&token_hash=' + 'b'.repeat(64));
      captureEmailActionCallback(window);
    });
    await act(async () => {
      finish(new Response(JSON.stringify({ access_token: 'disposable-link-access', user })));
    });
    expect(await screen.findByRole('button', { name: 'Verify email link' })).toBeVisible();
    // The replacement route has consumed its own credential into isolated
    // memory; it must not leave the raw hash globally available.
    expect(readEmailActionCallback()).toBeNull();
    expect(screen.queryByText(/Verified account/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verify email link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(user.email);
    expect(fetcher.mock.calls.some(([, init]) =>
      String(init?.body).includes('b'.repeat(64)))).toBe(true);
  });
  it('cleans the URL, verifies the visible target and resets without mounting any signed account writer', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Verify email link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Verified account: target@example.org');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new secure password' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new secure password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText(/password has been reset successfully/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Return to Mosaic' })).toHaveAttribute('href', '/login');
    expect(localStorage.getItem('existing-account')).toBe('untouched account data');
    expect(providers.appwrite).not.toHaveBeenCalled();
    expect(providers.supabase).not.toHaveBeenCalled();
    expect(screen.queryByText('Ordinary account application')).not.toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, '', '/reset-password#type=recovery&token_hash=' + 'b'.repeat(64));
      captureEmailActionCallback(window);
    });
    expect(await screen.findByRole('button', { name: 'Verify email link' })).toBeVisible();
    expect(window.location.hash).toBe('');
    expect(screen.queryByText(/password has been reset successfully/)).not.toBeInTheDocument();
  });

  it('confirms email without creating an active account or asking for another password', async () => {
    open('/auth/confirm', 'signup');
    fireEvent.click(await screen.findByRole('button', { name: 'Verify email link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish confirmation' }));
    expect(await screen.findByText(/Your email is confirmed/)).toBeVisible();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    expect(providers.supabase).not.toHaveBeenCalled();
  });

  it('strips malformed links and retries a transient verification failure without displaying its secret', async () => {
    open('/reset-password', 'signup');
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or incomplete');
    expect(window.location.hash).toBe('');
    expect(fetcher).not.toHaveBeenCalled();
    cleanup();
    fetcher.mockRejectedValueOnce(Error('private email credential'));
    open();
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Verify email link' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('could not be confirmed');
    expect(screen.getByRole('alert')).not.toHaveTextContent('private email credential');
    fireEvent.click(screen.getByRole('button', { name: 'Verify email link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(user.email);
  });
});
