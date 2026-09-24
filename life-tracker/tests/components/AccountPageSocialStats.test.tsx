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
describe('AccountPage social stats', () => {
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
});
