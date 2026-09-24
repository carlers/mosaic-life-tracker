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
vi.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({ tasks: [] }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({ categories: [] }),
}));

import { AccountPage } from '../../src/pages/AccountPage';

describe('primary page vertical scroll ownership', () => {
  // Regression: PROJECT_REFERENCE.md §2 — MainLayout, not Me, owns the full-page
  // vertical scroller so phone horizontal gestures work across the whole page.
  it('does not create a nested full-page vertical scroller on Me', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('account-scroll')).not.toHaveClass(
      'overflow-y-auto'
    );
  });
});
