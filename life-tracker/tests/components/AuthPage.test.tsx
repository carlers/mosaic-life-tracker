import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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

  it('requires username, email and password while still automatically signing in', async () => {
    mocks.signup.mockResolvedValue(true);
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/home" element={<div>Personal workspace</div>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'username');
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'New.User_123' },
    });
    expect(screen.getByLabelText('Username')).toHaveValue('newuser_123');
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'new@example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(mocks.signup).toHaveBeenCalledWith(
      'new@example.com', 'password123', 'newuser_123'
    ));
    expect(await screen.findByText('Personal workspace')).toBeInTheDocument();
  });

  it('prevents double registration while a submission is pending', async () => {
    let finish: (ok: boolean) => void = () => {};
    mocks.signup.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
    render(<MemoryRouter><AuthPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Creating account…' }));
    expect(mocks.signup).toHaveBeenCalledTimes(1);
    finish(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Account' })).toBeEnabled());
  });

  it('returns to an account-safe notification deep link after login', async () => {
    const id = 'not_' + 'a'.repeat(32);
    mocks.login.mockResolvedValue(true);
    const AlertPath = () => {
      const location = useLocation();
      return <p>Opened {location.pathname + location.search}</p>;
    };
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { from: { pathname: '/notifications', search: '?alert=' + id } },
      }]}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/notifications" element={<AlertPath />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Opened /notifications?alert=' + id)).toBeInTheDocument();
  });

});
