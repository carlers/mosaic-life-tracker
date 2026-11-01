import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/ui/DeferredAvatar', () => ({ DeferredAvatar: () => null }));
import { UserResultCard } from '../../src/components/explore/UserResultCard';
import type { ProfileCard } from '../../src/lib/social';

const profile = { $id: 'user_b', user_id: 'user_b', username: 'friend', display_name: 'Friend', avatar_file_id: '', bio: '', is_searchable: true } as ProfileCard;

describe('new friend request operational control', () => {
  it('hides only new-request initiation and restores it when enabled', () => {
    const onAdd = vi.fn();
    const { rerender } = render(<UserResultCard profile={profile} relationship="none" onAdd={onAdd} allowRequests={false} />);
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(screen.getByText('Requests paused')).toBeInTheDocument();
    rerender(<UserResultCard profile={profile} relationship="none" onAdd={onAdd} allowRequests />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(profile);
    rerender(<UserResultCard profile={profile} relationship="incoming" onAdd={onAdd} allowRequests={false} />);
    expect(screen.getByText('Respond in requests')).toBeInTheDocument();
  });
});
