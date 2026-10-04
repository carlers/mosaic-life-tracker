import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  requestPasswordRecovery: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    login: mocks.login,
    signup: mocks.signup,
    requestPasswordRecovery: mocks.requestPasswordRecovery,
    isLoading: false,
    error: null,
    recoveryLoading: false,
    recoveryError: null,
    recoverySuccess: null,
    pendingSignup: null,
  }),
}));

import { AuthPage } from '../../src/pages/AuthPage';

describe('AuthPage signup onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signup.mockResolvedValue(false);
  });

  it('collects and normalizes a username as part of signup', async () => {
    render(
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'New User' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'New.User_123' },
    });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(mocks.signup).toHaveBeenCalledWith(
        'new@example.com',
        'password123',
        'New User',
        'newuser_123'
      )
    );
  });
});
