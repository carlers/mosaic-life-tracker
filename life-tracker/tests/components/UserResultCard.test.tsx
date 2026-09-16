import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserResultCard } from '../../src/components/explore/UserResultCard';
import type { ProfileCard } from '../../src/lib/social';

// ---------------------------------------------------------------------------
// UserResultCard component tests (Layer 5).
//
// Pins the five relationship branches:
//   none     → "Add" button; tap fires onAdd(profile)
//   friends  → "Friends" label, no Add button
//   outgoing → "Pending"
//   incoming → "Respond in requests"
//   self     → "This is you"
//
// Also pins the isSending disabled state on the Add button.
//
// Deliberately NOT tested here:
//   - Avatar image loading (lib/storage mocked to null).
//   - Class strings on the action labels.
// ---------------------------------------------------------------------------

const mockGetLocalImageUrl = vi.hoisted(() =>
  vi.fn().mockResolvedValue(null)
);
vi.mock('../../src/lib/storage', () => ({
  getLocalImageUrl: mockGetLocalImageUrl,
}));

function makeProfile(): ProfileCard {
  return {
    $id: 'profile_1',
    user_id: 'user_B',
    username: 'b',
    display_name: 'Friend B',
    avatar_file_id: '',
    bio: '',
    is_searchable: true,
  };
}

describe('UserResultCard', () => {
  it('renders display_name and username', () => {
    render(
      <UserResultCard
        profile={makeProfile()}
        relationship="none"
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText('Friend B')).toBeInTheDocument();
    expect(screen.getByText('@b')).toBeInTheDocument();
  });

  it('relationship "none" renders Add button; tap fires onAdd(profile)', () => {
    const onAdd = vi.fn();
    const profile = makeProfile();
    render(
      <UserResultCard
        profile={profile}
        relationship="none"
        onAdd={onAdd}
      />
    );
    const addButton = screen.getByText('Add').closest('button');
    expect(addButton).not.toBeNull();
    fireEvent.click(addButton as Element);
    expect(onAdd).toHaveBeenCalledWith(profile);
  });

  it('isSending renders "Sending…" in place of "Add"', () => {
    render(
      <UserResultCard
        profile={makeProfile()}
        relationship="none"
        onAdd={vi.fn()}
        isSending
      />
    );
    expect(screen.getByText('Sending…')).toBeInTheDocument();
    expect(screen.queryByText('Add')).toBeNull();
  });

  it('non-"none" relationships render their labels and no Add button', () => {
    const { rerender } = render(
      <UserResultCard
        profile={makeProfile()}
        relationship="friends"
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText('Friends')).toBeInTheDocument();
    expect(screen.queryByText('Add')).toBeNull();

    rerender(
      <UserResultCard
        profile={makeProfile()}
        relationship="outgoing"
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText('Pending')).toBeInTheDocument();

    rerender(
      <UserResultCard
        profile={makeProfile()}
        relationship="incoming"
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText('Respond in requests')).toBeInTheDocument();

    rerender(
      <UserResultCard
        profile={makeProfile()}
        relationship="self"
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText('This is you')).toBeInTheDocument();
  });
});
