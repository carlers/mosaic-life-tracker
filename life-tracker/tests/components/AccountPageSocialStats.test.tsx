import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'user_1', name: 'Test', email: 'test@example.com' },
    logout: vi.fn().mockResolvedValue(true),
  }),
}));
vi.mock('../../src/hooks/useTasks', () => ({ useTasks: () => ({ tasks: [] }) }));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [] }),
}));
vi.mock('../../src/hooks/useFriends', () => ({
  useFriends: () => ({ friends: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }] }),
}));

vi.mock('../../src/components/modals/CategoryManagerSheet', () => ({
  CategoryManagerSheet: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div role="dialog" aria-label="Categories manager">
        <button type="button" onClick={onClose}>Close categories</button>
      </div>
    ) : null,
}));

import { AccountPage } from '../../src/pages/AccountPage';

// Regression: §2 (Me shows the accepted Friends count).
describe('AccountPage content and scroll ownership', () => {
  it('shows the accepted friend count under Friends', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Friends')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('Followers')).toBeNull();
  });

  // Regression: §2 (logout remains part of the Me content flow).
  it('keeps Account logout inside the normal account scroll flow', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );
    const scroll = screen.getByTestId('account-scroll');
    expect(scroll).toContainElement(screen.getByRole('button', { name: 'Logout' }));
  });

  // Regression: §2 (Me has no decorative quote block).
  it('does not render the decorative Me-page quote', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    expect(
      screen.queryByText(/Tact is the ability to describe others/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Eleanor Chaffee')).not.toBeInTheDocument();
  });

  it('opens the existing category manager from the Me Categories tile and closes it', async () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole('dialog', { name: 'Categories manager' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Categories/ }));

    expect(await screen.findByRole('dialog', { name: 'Categories manager' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close categories' }));
    expect(screen.queryByRole('dialog', { name: 'Categories manager' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Categories/ })).toBeEnabled();
  });

});
