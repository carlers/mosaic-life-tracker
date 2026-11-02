import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FriendsProvider } from '../../src/hooks/FriendsProvider';
import { useFriends } from '../../src/hooks/useFriends';
import { useMessageActions } from '../../src/hooks/useMessageActions';
import { useFriendCarousel } from '../../src/hooks/useFriendCarousel';
import { useTaskActivityActions } from '../../src/hooks/useTaskActivityActions';

const mocks = vi.hoisted(() => ({
  socialEnabled: false,
  sendFriendRequest: vi.fn(async () => undefined),
  acceptFriendRequest: vi.fn(async () => undefined),
  deleteFriendPair: vi.fn(async () => undefined),
  blockFriend: vi.fn(async () => undefined),
  sendTextMessage: vi.fn(async () => undefined),
  sendTaskReplyMessage: vi.fn(async () => undefined),
  sendTaskReactionMessage: vi.fn(async () => undefined),
  sendDiaryReplyMessage: vi.fn(async () => undefined),
  toggleReactionOnMessage: vi.fn(async () => 'ok'),
  fetchProfileByUserId: vi.fn(async () => ({ bio: 'Friend bio' })),
  updateFriendBioLocally: vi.fn(async () => undefined),
  setSetting: vi.fn(async () => undefined),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'owner', name: 'Owner' }, isOffline: false }),
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (key: string) =>
    key !== 'mosaic_disable_all_social' || mocks.socialEnabled,
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (key: string) =>
    key !== 'mosaic_disable_all_social' || mocks.socialEnabled,
}));
vi.mock('../../src/hooks/useConnectivity', () => ({
  useConnectivity: () => ({ status: 'online' }),
}));
vi.mock('../../src/hooks/useMyProfile', () => ({
  useMyProfile: () => ({ profile: { user_id: 'owner', display_name: 'Owner' }, isLoading: false }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({ settings: {}, isLoading: false, setSetting: mocks.setSetting }),
}));
vi.mock('../../src/hooks/useFriends', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/hooks/useFriends')>();
  return { ...actual };
});
vi.mock('../../src/lib/social', () => ({
  sendFriendRequest: mocks.sendFriendRequest,
  acceptFriendRequest: mocks.acceptFriendRequest,
  deleteFriendPair: mocks.deleteFriendPair,
  blockFriend: mocks.blockFriend,
  fetchProfileByUserId: mocks.fetchProfileByUserId,
  updateFriendBioLocally: mocks.updateFriendBioLocally,
}));
vi.mock('../../src/lib/friendshipCommands', () => ({
  scopeFriendshipCommands: vi.fn(),
  subscribeFriendshipCommands: () => () => {},
  getFriendshipRevision: () => 0,
  pendingFriendshipRows: () => [],
}));
vi.mock('../../src/lib/messageComposer', () => ({
  sendTextMessage: mocks.sendTextMessage,
  sendTaskReplyMessage: mocks.sendTaskReplyMessage,
  sendTaskReactionMessage: mocks.sendTaskReactionMessage,
  sendDiaryReplyMessage: mocks.sendDiaryReplyMessage,
}));
vi.mock('../../src/lib/messageReactions', () => ({
  toggleReactionOnMessage: mocks.toggleReactionOnMessage,
}));
vi.mock('../../src/db/database', () => ({
  getDatabase: vi.fn(() => { throw new Error('Solo mode must not read social DB'); }),
}));

const friendProfile = { friendId: 'friend_1', username: 'friend' };
const mySummary = { username: 'owner', displayName: 'Owner' };
const task = { id: 'task_1', title: 'Task' };
const diary = { id: 'diary_1', userId: 'friend_1' };

beforeEach(() => {
  mocks.socialEnabled = false;
  for (const [key, value] of Object.entries(mocks)) {
    if (key !== 'socialEnabled' && typeof value === 'function') vi.mocked(value).mockClear();
  }
});

describe('social-off stale command boundaries', () => {
  it('refuses fresh messages, photos, replies and reactions, then restores normal sending', async () => {
    const { result } = renderHook(() => useMessageActions('friend_1'));
    await expect(result.current.sendMessage('Hello')).rejects.toThrow('Social features are paused');
    await expect(result.current.sendPhoto({} as File)).rejects.toThrow('Social features are paused');
    await expect(result.current.sendTaskReply(task as never, 'Hi', '#fff')).rejects.toThrow('Social features are paused');
    await expect(result.current.sendDiaryReply(diary as never, 'Hi')).rejects.toThrow('Social features are paused');
    await expect(result.current.sendTaskReaction(task as never, '❤️', '#fff')).rejects.toThrow('Social features are paused');
    await expect(result.current.toggleReaction('msg_1', '❤️')).rejects.toThrow('Social features are paused');
    expect(mocks.sendTextMessage).not.toHaveBeenCalled();
    expect(mocks.sendTaskReactionMessage).not.toHaveBeenCalled();
    mocks.socialEnabled = true;
    await act(async () => { await result.current.sendMessage('Hello'); });
    expect(mocks.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('guards independent task-activity reaction sends', async () => {
    const { result } = renderHook(() => useTaskActivityActions());
    await expect(result.current.sendTaskReaction('friend_1', task as never, '⭐', '#fff'))
      .rejects.toThrow('Social features are paused');
    expect(mocks.sendTaskReactionMessage).not.toHaveBeenCalled();
  });

  it('prevents queued friend requests and acceptance without blocking safety actions', async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      <FriendsProvider>{children}</FriendsProvider>;
    const { result } = renderHook(() => useFriends(), { wrapper });
    await expect(result.current.sendRequest(mySummary as never, friendProfile as never))
      .rejects.toThrow('Social features are paused');
    await expect(result.current.accept('friend_1')).rejects.toThrow('Social features are paused');
    expect(mocks.sendFriendRequest).not.toHaveBeenCalled();
    expect(mocks.acceptFriendRequest).not.toHaveBeenCalled();
    await act(async () => { await result.current.cancel('friend_1'); });
    expect(mocks.deleteFriendPair).toHaveBeenCalledTimes(1);
  });

  it('returns only the owner and skips friend bio requests while paused', () => {
    // The provider returns no friends while social is paused. On a re-enable,
    // an accepted friend can be projected once a provider refresh completes.
    const wrapper = ({ children }: { children: ReactNode }) =>
      <FriendsProvider>{children}</FriendsProvider>;
    const { result } = renderHook(() => useFriendCarousel(), { wrapper });
    expect(result.current.persons.map(person => person.kind)).toEqual(['me']);
    expect(mocks.fetchProfileByUserId).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
