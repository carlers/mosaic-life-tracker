import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { UserResultCard } from './UserResultCard';
import { useFriendConnections } from '../../hooks/useFriendConnections';
import { useFriends } from '../../hooks/useFriends';
import { useMyProfile } from '../../hooks/useMyProfile';
import { useFeatureEnabled } from '../../hooks/useFeatureEnabled';
import type { ProfileCard } from '../../lib/social';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  friendId: string | null;
  friendName: string;
}
export const FriendConnectionsSheet: React.FC<Props> = ({ isOpen, onClose, friendId, friendName }) => {
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const discoveryEnabled = useFeatureEnabled('mosaic_disable_friend_discovery');
  const requestsEnabled = useFeatureEnabled('mosaic_disable_friend_requests');
  const { findFriendship, sendRequest } = useFriends();
  const { profile: self } = useMyProfile();
  const [sendingId, setSendingId] = useState('');
  const [feedback, setFeedback] = useState('');
  const available = isOpen && socialEnabled && discoveryEnabled && !!friendId &&
    findFriendship(friendId)?.status === 'accepted';
  const { items, nextCursor, isLoading, error, loadMore, retry } =
    useFriendConnections(friendId, available);
  const add = async (candidate: ProfileCard) => {
    if (!self || !requestsEnabled) return;
    setSendingId(candidate.user_id);
    setFeedback('');
    try {
      await sendRequest({
        username: self.username, displayName: self.display_name || self.username,
        avatarFileId: self.avatar_file_id || '', bio: self.bio || '',
      }, candidate);
      setFeedback('Friend request sent or queued.');
    } catch {
      setFeedback('Could not send friend request.');
    } finally { setSendingId(''); }
  };
  return <BottomSheet isOpen={isOpen && socialEnabled && discoveryEnabled} onClose={onClose}
    title={`Friends of ${friendName}`}>
    <div className="space-y-3 px-4 pb-8">
      {!available && <p className="text-sm text-gray-400">Friends list unavailable.</p>}
      {available && items.map(item => {
        const existing = findFriendship(item.profile.user_id);
        const relationship = existing?.status === 'accepted' ? 'friends'
          : existing?.status === 'pending_outgoing' ? 'outgoing'
          : existing?.status === 'pending_incoming' ? 'incoming'
          : item.relationship;
        return <UserResultCard key={item.profile.user_id} profile={item.profile}
          relationship={relationship} onAdd={p => void add(p)}
          isSending={sendingId === item.profile.user_id} allowRequests={requestsEnabled}/>;
      })}
      {available && !isLoading && !items.length && !error &&
        <p className="text-sm text-gray-400">No friends available to discover.</p>}
      {available && error && <div role="status" className="flex items-center gap-3">
        <span className="text-sm text-gray-400">{error}</span>
        <button type="button" onClick={retry} className="rounded-lg px-3 py-2 bg-surfaceHighlight">Retry</button>
      </div>}
      {available && isLoading && <p role="status" className="text-sm text-gray-400">Loading friends…</p>}
      {available && nextCursor && !isLoading && <button type="button" onClick={loadMore}
        className="rounded-lg bg-surfaceHighlight px-4 py-2 text-sm">Load more</button>}
      {feedback && <p role="status" className="text-xs text-gray-400">{feedback}</p>}
    </div>
  </BottomSheet>;
};
