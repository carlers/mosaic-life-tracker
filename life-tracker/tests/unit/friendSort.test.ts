import { describe, expect, it } from 'vitest';
import type { FriendshipDocument, MessageDocument } from '../../src/db/schema';
import { compareLatest, rankFriendInteractions, resolveFriendSortMode, sortFriendRows } from '../../src/lib/friendSort';

const date = (day: number) => new Date(Date.UTC(2026, 10, day)).toISOString();
function friend(friendId: string, acceptedAt = '', createdAt = date(1)): FriendshipDocument {
  return {
    id: 'fr_' + friendId, userId: 'owner', friendId,
    friendUsername: friendId, friendDisplayName: friendId, friendAvatarFileId: '',
    friendBio: '', status: 'accepted', createdAt, updatedAt: date(3),
    acceptedAt, isDeleted: false,
  };
}
function message(id: string, other: string, overrides: Partial<MessageDocument> = {}): MessageDocument {
  return {
    id, userId: 'owner', threadId: 'thread', senderId: 'owner',
    recipientId: other, direction: 'outgoing', content: '',
    taskRefId: '', taskRefTitle: '', taskRefDate: '', taskRefColor: '',
    replyToId: '', replyToContent: '', replyToSenderId: '', isUnsent: false,
    originalMessageId: '', reactions: '', readAt: '', deliveryStatus: 'delivered',
    createdAt: date(3), updatedAt: date(3), isDeleted: false,
    ...overrides,
  };
}
describe('friends list ordering', () => {
  it('defaults invalid preferences to Latest', () => {
    expect(resolveFriendSortMode('invalid')).toBe('latest');
    expect(resolveFriendSortMode(null)).toBe('latest');
    expect(resolveFriendSortMode('closest')).toBe('closest');
  });
  it('uses verified acceptance, not mutable updatedAt, and places unknown legacy rows later', () => {
    const a = friend('a', date(2));
    const b = friend('b', date(3));
    const legacy = friend('old', '', date(1));
    a.updatedAt = date(4);
    expect(sortFriendRows([a, legacy, b], 'latest').map(f => f.friendId))
      .toEqual(['b', 'a', 'old']);
    expect(compareLatest(a, b)).toBeGreaterThan(0);
  });
  it('counts each delivered direct message once, in both directions', () => {
    const f = friend('bob', date(2));
    const rows = [
      message('one', 'bob'),
      message('copy', 'bob', { senderId: 'bob', recipientId: 'owner', direction: 'incoming', originalMessageId: 'one' }),
      message('incoming', 'bob', { senderId: 'bob', recipientId: 'owner', direction: 'incoming', originalMessageId: 'other' }),
      message('pending', 'bob', { deliveryStatus: 'pending' }),
      message('deleted', 'bob', { isDeleted: true }),
      message('unsent', 'bob', { isUnsent: true }),
      message('pre-accept', 'bob', { createdAt: date(1) }),
      message('stranger', 'stranger'),
      message('foreign-owner', 'bob', { userId: 'someoneelse' }),
    ];
    const score = rankFriendInteractions(rows, 'owner', [f], Date.parse(date(4)));
    expect(score.get('bob')).toEqual({ count: 2, lastAt: Date.parse(date(3)) });
    expect(score.has('stranger')).toBe(false);
  });
  it('sorts by recent chat count then last activity, falling back to Latest', () => {
    const a = friend('a', date(3));
    const b = friend('b', date(2));
    const c = friend('c', date(1));
    const score = new Map([
      ['b', { count: 3, lastAt: Date.parse(date(3)) }],
      ['c', { count: 1, lastAt: Date.parse(date(4)) }],
    ]);
    expect(sortFriendRows([a, b, c], 'closest', score).map(f => f.friendId))
      .toEqual(['b', 'c', 'a']);
    expect(sortFriendRows([a, b, c], 'closest').map(f => f.friendId))
      .toEqual(['a', 'b', 'c']);
  });
});
