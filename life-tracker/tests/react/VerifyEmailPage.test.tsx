import React, { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  complete: vi.fn(),
  user: null as null | { $id: string },
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ completeEmailVerification: mock.complete, user: mock.user }),
}));
import { VerifyEmailPage } from '../../src/pages/VerifyEmailPage';
import { captureEmailVerificationCallbackUrl, clearEmailVerificationCallback } from '../../src/lib/emailVerificationCallback';

describe('email verification callback', () => {
  beforeEach(() => {
    clearEmailVerificationCallback();
    mock.complete.mockReset().mockResolvedValue(undefined);
    mock.user = null;
    window.history.replaceState({}, '', '/verify-email');
  });
  it('scrubs callback secrets immediately and redeems once in strict mode', async () => {
    window.history.replaceState({}, '', '/verify-email?userId=user_1&secret=secret_123');
    captureEmailVerificationCallbackUrl();
    expect(window.location.search).toBe('');
    render(<StrictMode><MemoryRouter><VerifyEmailPage /></MemoryRouter></StrictMode>);
    expect(window.location.search).toBe('');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('verified'));
    expect(mock.complete).toHaveBeenCalledExactlyOnceWith('user_1', 'secret_123');
    expect(screen.getByRole('link', { name: 'Return to login' })).toHaveAttribute('href', '/login');
  });
  it('does not redeem incomplete tokens or render the secret', async () => {
    window.history.replaceState({}, '', '/verify-email?secret=secret_should_never_be_visible');
    render(<MemoryRouter><VerifyEmailPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('incomplete'));
    expect(mock.complete).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(document.body.textContent).not.toContain('secret_should_never_be_visible');
  });
  it('rejects cross-account callbacks without exposing the token', async () => {
    mock.user = { $id: 'other_user' };
    mock.complete.mockRejectedValue(new Error('Verification belongs to another signed-in account.'));
    window.history.replaceState({}, '', '/verify-email?userId=user_1&secret=secret_123');
    render(<MemoryRouter><VerifyEmailPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('another account'));
    expect(window.location.search).toBe('');
    expect(document.body.textContent).not.toContain('secret_123');
  });
  it('handles server failure without displaying backend error contents', async () => {
    mock.complete.mockRejectedValue(new Error('sensitive backend response'));
    window.history.replaceState({}, '', '/verify-email?userId=user_1&secret=secret_123');
    render(<MemoryRouter><VerifyEmailPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Verification failed'));
    expect(document.body.textContent).not.toContain('sensitive backend response');
  });
});
