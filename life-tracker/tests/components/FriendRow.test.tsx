import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FriendRow } from '../../src/components/explore/FriendRow';
import type { FriendshipDocument } from '../../src/db/schema';

const navigateSpy = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock('../../src/components/ui/DeferredAvatar', () => ({
  DeferredAvatar: ({ alt }: { alt?: string }) => <div aria-label={alt} />,
}));

function makeFriend(): FriendshipDocument {
  return {
    id: 'fr_1',
    userId: 'user_A',
    friendId: 'user_B',
    friendUsername: 'b',
    friendDisplayName: 'Friend B',
    friendAvatarFileId: '',
    friendBio: '',
    status: 'accepted',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
  };
}

beforeEach(() => {
  navigateSpy.mockClear();
});

describe('FriendRow', () => {
  it('opens the friend calendar with Explore recorded as its route parent', () => {
    render(<FriendRow friendship={makeFriend()} onOpenActions={() => {}} />);

    fireEvent.click(screen.getByText('Friend B'));

    expect(navigateSpy).toHaveBeenCalledWith('/friends/user_B', {
      state: { parentPath: '/explore' },
    });
  });
});
