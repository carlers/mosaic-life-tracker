import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FriendshipDocument } from '../../db/schema';
import type { FriendConnection } from '../../lib/friendDiscovery';
import { listFriendConnections } from '../../lib/friendDiscovery';
import { UserResultCard } from './UserResultCard';
import { FriendConnectionsSheet } from './FriendConnectionsSheet';
import { useFriends } from '../../hooks/useFriends';
import { useAuth } from '../../hooks/useAuth';
import { useMyProfile } from '../../hooks/useMyProfile';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useFeatureEnabled } from '../../hooks/useFeatureEnabled';
import type { ProfileCard } from '../../lib/social';

export const FriendsOfFriendsSection: React.FC<{ friends: FriendshipDocument[] }> = ({ friends }) => {
  const { user } = useAuth();
  const { profile: self } = useMyProfile();
  const { findFriendship, sendRequest } = useFriends();
  const connectivity = useConnectivity();
  const discoveryEnabled = useFeatureEnabled('mosaic_disable_friend_discovery');
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const enabled = discoveryEnabled && socialEnabled;
  const requestsEnabled = useFeatureEnabled('mosaic_disable_friend_requests');
  const [expanded, setExpanded] = useState(false);
  const [openFriend, setOpenFriend] = useState<FriendshipDocument | null>(null);
  const [state, setState] = useState<{ scope: string; items: FriendConnection[]; loading: boolean; error: string }>({
    scope: '', items: [], loading: false, error: '',
  });
  const [sending, setSending] = useState('');
  const [feedback, setFeedback] = useState('');
  const uid = user?.$id || '';
  const source = useMemo(() => friends.filter(f => f.status === 'accepted' && !f.isDeleted).slice(0, 3), [friends]);
  const scope = enabled && expanded && uid ? uid + ':' + source.map(f => f.friendId).join('|') : '';
  useEffect(() => {
    if (!scope) return;
    let live = true;
    // An asynchronous synchronization prevents setState-in-effect cascades.
    const online = connectivity.status === 'online';
    queueMicrotask(() => {
      if (live) setState({
        scope, items: [], loading: online,
        error: online ? '' : 'Connect to discover friends.',
      });
    });
    if (!online) return () => { live = false; };
    (async () => {
      try {
        const pages = await Promise.allSettled(source.map(f => listFriendConnections(f.friendId, '', 4)));
        // A private friend list is unavailable by design (404). Other permitted
        // intermediaries should still contribute suggestions.
        if (pages.some(p => p.status === 'rejected' && (p.reason as { code?: number })?.code !== 404) &&
            !pages.some(p => p.status === 'fulfilled')) throw new Error('Discovery unavailable');
        if (!live) return;
        const seen = new Set<string>([uid, ...friends.map(f => f.friendId)]);
        const items: FriendConnection[] = [];
        for (const result of pages) {
          if (result.status !== 'fulfilled') continue;
          for (const item of result.value.items) {
          if (seen.has(item.profile.user_id)) continue;
          seen.add(item.profile.user_id);
          items.push(item);
          }
        }
        setState({ scope, items: items.slice(0, 12), loading: false, error: '' });
      } catch {
        if (live) setState({ scope, items: [], loading: false, error: 'Discovery unavailable.' });
      }
    })();
    return () => { live = false; };
  // Stable dependencies ensure revocation or account changes invalidate old responses.
  }, [scope, connectivity.status, source, friends, uid]);
  const add = useCallback(async (p: ProfileCard) => {
    if (!self || !requestsEnabled) return;
    setSending(p.user_id); setFeedback('');
    try {
      await sendRequest({
        username: self.username, displayName: self.display_name || self.username,
        avatarFileId: self.avatar_file_id || '', bio: self.bio || '',
      }, p);
      setFeedback('Friend request sent or queued.');
    } catch { setFeedback('Could not send friend request.'); }
    finally { setSending(''); }
  }, [self, requestsEnabled, sendRequest]);
  if (!enabled || !friends.length) return null;
  const visible = state.scope === scope;
  return <section className="space-y-2">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(x => !x)}
      className="flex min-h-11 w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm font-medium focus-visible:outline">
      <span>Friends of friends</span><span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <>
      <p className="px-1 text-xs text-gray-400">People your friends have chosen to make discoverable.</p>
      {source.map(friend => <button type="button" key={friend.friendId}
        onClick={() => setOpenFriend(friend)} className="mr-2 rounded-full border border-[#333333] px-3 py-2 text-xs">
        {friend.friendDisplayName || friend.friendUsername}’s friends
      </button>)}
      {visible && state.loading && <p role="status" className="text-sm text-gray-400">Finding friends…</p>}
      {visible && state.error && <p role="status" className="text-sm text-gray-400">{state.error}</p>}
      {visible && !state.loading && !state.error && !state.items.length &&
        <p className="px-1 text-sm text-gray-400">No friends available to discover yet.</p>}
      {visible && state.items.filter(item => !['blocked', 'accepted'].includes(findFriendship(item.profile.user_id)?.status || '')).map(item => {
        const status = findFriendship(item.profile.user_id)?.status;
        const relation = status === 'accepted' ? 'friends' : status === 'pending_outgoing' ? 'outgoing'
          : status === 'pending_incoming' ? 'incoming' : item.relationship;
        return <UserResultCard key={item.profile.user_id} profile={item.profile}
          relationship={relation} onAdd={p => void add(p)}
          allowRequests={requestsEnabled} isSending={sending === item.profile.user_id}/>;
      })}
      {feedback && <p role="status" className="text-xs text-gray-400">{feedback}</p>}
    </>}
    <FriendConnectionsSheet isOpen={!!openFriend} friendId={openFriend?.friendId || null}
      friendName={openFriend?.friendDisplayName || openFriend?.friendUsername || 'Friend'}
      onClose={() => setOpenFriend(null)}/>
  </section>;
};
