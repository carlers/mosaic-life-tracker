import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({
  profile: null as null | { username: string; display_name: string; avatar_file_id: string; bio: string },
  localName: 'Synced owner name',
  createProfile: vi.fn(),
  checkUsername: vi.fn(),
}));

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, title, isOpen }: React.PropsWithChildren<{ title: string; isOpen: boolean }>) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_a', name: 'Account name' } }),
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({ status: 'online' }),
}));
vi.mock('../../src/hooks/useMyProfile', () => ({
  useMyProfile: () => ({
    profile: state.profile, createProfile: state.createProfile,
    checkUsername: state.checkUsername,
  }),
}));
vi.mock('../../src/hooks/useProfile', () => ({
  useProfile: () => ({ displayName: state.localName }),
}));

import { SetUsernameSheet } from '../../src/components/modals/SetUsernameSheet';

function openSheet() {
  const onClose = vi.fn();
  const view = render(<SetUsernameSheet isOpen={false} onClose={onClose} />);
  view.rerender(<SetUsernameSheet isOpen onClose={onClose} />);
  return onClose;
}

describe('SetUsernameSheet single display name source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.profile = {
      username: 'old_handle', display_name: 'Outdated public name',
      avatar_file_id: '', bio: '',
    };
    state.localName = 'Synced owner name';
    state.checkUsername.mockResolvedValue(true);
    state.createProfile.mockImplementation(async (input: { username: string }) => ({ username: input.username }));
  });

  it('edits only the username and preserves the synced owner display name', async () => {
    const onClose = openSheet();
    expect(screen.getByRole('dialog', { name: 'Edit Username' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByText('Display Name')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), {
      target: { value: 'new_handle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Username' }));
    await waitFor(() => expect(state.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'new_handle', displayName: 'Synced owner name' })
    ));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('retains a legacy public name when the synced name is absent', async () => {
    state.localName = '';
    openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Save Username' }));
    await waitFor(() => expect(state.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'old_handle', displayName: 'Outdated public name' })
    ));
    expect(state.checkUsername).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'Could not check. Try again.'],
    [false, 'That username is already taken.'],
  ])('releases the save control when username availability returns %s', async (availability, message) => {
    state.checkUsername.mockResolvedValue(availability);
    openSheet();
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), {
      target: { value: 'unverified_name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Username' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Username' })).not.toBeDisabled();
    expect(state.createProfile).not.toHaveBeenCalled();
  });

  it('creates a missing legacy profile using the account name as fallback', async () => {
    state.profile = null;
    state.localName = '';
    openSheet();
    expect(screen.getByRole('dialog', { name: 'Choose Username' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), {
      target: { value: 'fresh_handle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Profile' }));
    await waitFor(() => expect(state.createProfile).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'fresh_handle', displayName: 'Account name' })
    ));
  });
});
