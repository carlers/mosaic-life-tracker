import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  user: { $id: 'owner_1' },
  refresh: vi.fn(),
  send: vi.fn(),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mock.user,
    refreshEmailVerificationStatus: mock.refresh,
    requestEmailVerification: mock.send,
  }),
}));
import { AccountSettingsSheet } from '../../src/components/modals/AccountSettingsSheet';

const props = {
  isOpen: true,
  onClose: vi.fn(),
  onOpenChangeEmail: vi.fn(),
  onOpenChangePassword: vi.fn(),
  currentEmail: 'owner@example.com',
};

describe('account email verification control', () => {
  beforeEach(() => {
    mock.refresh.mockReset().mockResolvedValue(false);
    mock.send.mockReset().mockResolvedValue(undefined);
    props.onClose.mockReset();
    props.onOpenChangeEmail.mockReset();
    props.onOpenChangePassword.mockReset();
  });
  it('shows live unverified status and sends only on explicit action', async () => {
    render(<AccountSettingsSheet {...props} />);
    expect(mock.send).not.toHaveBeenCalled();
    const send = await screen.findByRole('button', { name: 'Send verification email' });
    fireEvent.click(send);
    await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verification email requested');
    expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled();
    expect(screen.getByText(/Verification is optional/)).toBeInTheDocument();
  });
  it('never sends if the server says verified', async () => {
    mock.refresh.mockResolvedValue(true);
    render(<AccountSettingsSheet {...props} />);
    expect(await screen.findByRole('status')).toHaveTextContent('Email verified');
    expect(screen.queryByRole('button', { name: 'Send verification email' })).toBeNull();
  });
  it('disables requests when live status cannot be fetched', async () => {
    mock.refresh.mockRejectedValue(new Error('offline'));
    render(<AccountSettingsSheet {...props} />);
    expect(await screen.findByRole('status')).toHaveTextContent('unavailable');
    expect(screen.queryByRole('button', { name: 'Send verification email' })).toBeNull();
  });
  it('converts the backend rate limit to an actionable safe message', async () => {
    mock.send.mockRejectedValue({ code: 429, message: 'private' });
    render(<AccountSettingsSheet {...props} />);
    const send = await screen.findByRole('button', { name: 'Send verification email' });
    fireEvent.click(send);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
    expect(document.body.textContent).not.toContain('private');
  });
});
