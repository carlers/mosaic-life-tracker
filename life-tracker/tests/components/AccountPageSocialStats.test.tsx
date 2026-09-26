import React from 'react';
import { render, screen } from '@testing-library/react';
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

import { AccountPage } from '../../src/pages/AccountPage';

// Regression: PROJECT_REFERENCE.md §2 — Me reports accepted Friends from the
// shared FriendsProvider rather than a hard-coded follower count.
describe('AccountPage content and scroll ownership', () => {
  it('shows the accepted friend count under Friends', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    const friendsLabel = screen.getByText('Friends');
    const stat = friendsLabel.parentElement;
    expect(stat).toHaveTextContent('3');
    expect(screen.queryByText('Followers')).toBeNull();
  });

  // Regression: PROJECT_REFERENCE.md §2 — logout stays in the account content flow.
  it('keeps Account logout inside the normal account scroll flow', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );
    const scroll = screen.getByTestId('account-scroll');
    expect(scroll).toContainElement(screen.getByRole('button', { name: 'Logout' }));
  });

  // Regression: PROJECT_REFERENCE.md §2 — Me has no decorative quote/author block.
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

});
