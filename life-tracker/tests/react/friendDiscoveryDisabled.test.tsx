// Regression: #1657 -- an intentional server kill switch is not a network retry,
// and failed/revoked pages must never retain cached private connections.
import React from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  uid: 'alice',
  status: 'online' as 'online' | 'offline',
  send: vi.fn(),
  sendRequest: vi.fn(),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.uid ? { $id: mocks.uid } : null }),
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({ status: mocks.status }),
}));
vi.mock('../../src/lib/appAction', () => ({
  sendAppAction: mocks.send,
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => true,
}));
vi.mock('../../src/hooks/useFriends', () => ({
  useFriends: () => ({
    findFriendship: (id: string) => id === 'bob' ? { status: 'accepted' } : null,
    sendRequest: mocks.sendRequest,
  }),
}));
vi.mock('../../src/hooks/useMyProfile', () => ({
  useMyProfile: () => ({ profile: null }),
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children }: {
    isOpen: boolean; title: string; children: React.ReactNode;
  }) => isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

import { isDiscoveryNotEnabledError } from '../../src/lib/friendDiscovery';
import { useFriendConnections } from '../../src/hooks/useFriendConnections';
import { FriendConnectionsSheet } from '../../src/components/explore/FriendConnectionsSheet';

const disabled = () => Object.assign(new Error('function rejected'), {
  code: 503, result: { error: 'Discovery unavailable' },
});
const transient = () => Object.assign(new Error('temporary server problem'), {
  code: 503, result: { error: 'Upstream unavailable' },
});
const page = (id: string, nextCursor = '') => ({
  items: [{ user_id: id, username: id, display_name: id, relationship: 'none' }],
  nextCursor,
});

function sheet() {
  return <FriendConnectionsSheet isOpen friendId="bob" friendName="testing" onClose={() => {}}/>;
}

describe('disabled friend connections and revocation safety', () => {
  beforeEach(() => {
    mocks.uid = 'alice';
    mocks.status = 'online';
    mocks.send.mockReset();
    mocks.sendRequest.mockReset();
  });

  it('recognizes only the exact server feature-off result, not arbitrary 503s', () => {
    expect(isDiscoveryNotEnabledError(disabled())).toBe(true);
    expect(isDiscoveryNotEnabledError(transient())).toBe(false);
    expect(isDiscoveryNotEnabledError(Object.assign(new Error('bad request'), {
      code: 404, result: { error: 'Discovery unavailable' },
    }))).toBe(false);
    expect(isDiscoveryNotEnabledError(null)).toBe(false);
    expect(isDiscoveryNotEnabledError({ code: 503, result: null })).toBe(false);
  });

  it('shows a non-retryable explanation instead of the misleading Retry button', async () => {
    mocks.send.mockRejectedValue(disabled());
    render(sheet());
    expect(await screen.findByText("Friends discovery isn't enabled yet.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Friends of testing' })).toBeInTheDocument();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('keeps Retry for temporary errors and permits a successful recovery', async () => {
    mocks.send.mockRejectedValueOnce(transient()).mockResolvedValueOnce(page('charlie'));
    render(sheet());
    expect(await screen.findByText('Friends list unavailable. Try again.')).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Retry' }).click());
    await waitFor(() => expect(screen.getByText('No friends available to discover.')).toBeInTheDocument());
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('clears prior pages immediately on a failed pagination or revoked grant', async () => {
    mocks.send.mockResolvedValueOnce(page('charlie', 'opaque')).mockRejectedValueOnce(disabled());
    const { result } = renderHook(() => useFriendConnections('bob', true));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.errorKind).toBe('disabled'));
    expect(result.current.items).toEqual([]);
    expect(result.current.nextCursor).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not expose previous account pages during a fresh viewer request', async () => {
    let resolveBob!: (value: ReturnType<typeof page>) => void;
    const pending = new Promise<ReturnType<typeof page>>(yes => { resolveBob = yes; });
    mocks.send.mockResolvedValueOnce(page('charlie')).mockImplementationOnce(() => pending);
    const { result, rerender } = renderHook(() => useFriendConnections('bob', true));
    await waitFor(() => expect(result.current.items[0]?.profile.user_id).toBe('charlie'));
    mocks.uid = 'other-account';
    rerender();
    expect(result.current.items).toEqual([]);
    await act(async () => { resolveBob(page('dana')); await pending; });
    await waitFor(() => expect(result.current.items[0]?.profile.user_id).toBe('dana'));
  });

  it('drops cached friend cards on closing and reopening the same sheet', async () => {
    let enabled = true;
    let finish!: (value: ReturnType<typeof page>) => void;
    const pending = new Promise<ReturnType<typeof page>>(resolve => { finish = resolve; });
    mocks.send.mockResolvedValueOnce(page('charlie')).mockImplementationOnce(() => pending);
    const { result, rerender } = renderHook(() => useFriendConnections('bob', enabled));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    enabled = false;
    rerender();
    expect(result.current.items).toEqual([]);
    await act(async () => { await Promise.resolve(); });
    enabled = true;
    rerender();
    expect(result.current.items).toEqual([]);
    await act(async () => { finish(page('dana')); await pending; });
    await waitFor(() => expect(result.current.items[0]?.profile.user_id).toBe('dana'));
  });
});
