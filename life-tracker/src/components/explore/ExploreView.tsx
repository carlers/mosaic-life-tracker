import React, { useCallback, useMemo, useState } from 'react';
import { Copy, Check, Users, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { SearchBar } from './SearchBar';
import { UserResultCard } from './UserResultCard';
import { FriendRequestRow } from './FriendRequestRow';
import { FriendRow } from './FriendRow';
import { OutgoingRequestRow } from './OutgoingRequestRow';
import { FriendActionSheet } from './FriendActionSheet';
import { useFriends } from '../../hooks/useFriends';
import { useProfileLookup } from '../../hooks/useProfileLookup';
import { useMyProfile } from '../../hooks/useMyProfile';
import type { ProfileCard } from '../../lib/social';
import type { FriendshipDocument } from '../../db/schema';

interface ExploreViewProps {
  onRequestUsername: () => void;
  onFeedback?: (message: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onRequestUsername,
  onFeedback,
}) => {
  const { profile, isLoading: profileLoading } = useMyProfile();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    isLoading: friendsLoading,
    sendRequest,
    accept,
    decline,
    cancel,
    remove,
    block,
    findFriendship,
  } = useFriends();
  const {
    results,
    isSearching,
    error: searchError,
    query,
    setQuery,
    clear,
  } = useProfileLookup();

  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<FriendshipDocument | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const myUsername = profile?.username || '';

  const relationshipFor = useCallback(
    (p: ProfileCard) => {
      const existing = findFriendship(p.user_id);
      if (existing) {
        if (existing.status === 'accepted') return 'friends' as const;
        if (existing.status === 'pending_outgoing') return 'outgoing' as const;
        if (existing.status === 'pending_incoming') return 'incoming' as const;
      }
      return 'none' as const;
    },
    [findFriendship]
  );

  const handleAdd = useCallback(
    async (p: ProfileCard) => {
      if (!profile) return;
      setSendingTo(p.user_id);
      try {
        await sendRequest(
          {
            username: profile.username,
            displayName: profile.display_name || profile.username,
            avatarFileId: profile.avatar_file_id || '',
            bio: profile.bio || '',
          },
          p
        );
        onFeedback?.('Request sent');
      } catch (err) {
        console.error('[ExploreView] Send request failed:', err);
      } finally {
        setSendingTo(null);
      }
    },
    [profile, sendRequest, onFeedback]
  );

  const handleCancelRequest = useCallback(
    async (friendUserId: string) => {
      try {
        await cancel(friendUserId);
        onFeedback?.('Request cancelled');
      } catch (err) {
        console.error('[ExploreView] Cancel request failed:', err);
      }
    },
    [cancel, onFeedback]
  );

  const handleCopyUsername = useCallback(async () => {
    if (!myUsername) return;
    try {
      await navigator.clipboard.writeText(myUsername);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error('[ExploreView] Copy failed:', err);
    }
  }, [myUsername]);

  const visibleResults = useMemo(
    () => results.filter((r) => r.user_id !== profile?.user_id),
    [results, profile?.user_id]
  );

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333]">
          <Users size={28} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Set up your profile</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Pick a username so friends can find and add you.
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRequestUsername}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Choose username
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333]">
        <h1 className="text-lg font-bold text-white">Explore</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-6">
        <SearchBar
          value={query}
          onChange={setQuery}
          onClear={clear}
          disabled={typeof navigator !== 'undefined' && !navigator.onLine}
        />

        {searchError && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">
            {searchError}
          </div>
        )}

        {isSearching && (
          <div className="flex items-center gap-2 px-2 text-xs text-gray-500">
            <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            Searching…
          </div>
        )}

        {visibleResults.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              Search results
            </h2>
            {visibleResults.map((p) => (
              <UserResultCard
                key={p.$id}
                profile={p}
                relationship={relationshipFor(p)}
                onAdd={handleAdd}
                isSending={sendingTo === p.user_id}
              />
            ))}
          </section>
        )}

        {query.trim() && !isSearching && visibleResults.length === 0 && !searchError && (
          <p className="text-xs text-gray-500 px-2">
            No user found. Check the spelling or ask them to share their username.
          </p>
        )}

        {incomingRequests.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Inbox size={14} className="text-gray-500" />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Incoming requests ({incomingRequests.length})
              </h2>
            </div>
            {incomingRequests.map((r) => (
              <FriendRequestRow
                key={r.id}
                friendship={r}
                onAccept={accept}
                onDecline={decline}
              />
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            My friends ({friends.length})
          </h2>
          {friendsLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <p className="text-xs text-gray-500 px-2">
              No friends yet. Search above to add someone.
            </p>
          ) : (
            friends.map((f) => (
              <FriendRow
                key={f.id}
                friendship={f}
                onOpenActions={setActionTarget}
              />
            ))
          )}
        </section>

        {outgoingRequests.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              Sent requests ({outgoingRequests.length})
            </h2>
            {outgoingRequests.map((r) => (
              <OutgoingRequestRow
                key={r.id}
                friendship={r}
                onCancel={handleCancelRequest}
              />
            ))}
          </section>
        )}

        <section className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Your username</p>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-white flex-1 truncate">
              @{myUsername}
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopyUsername}
              className="flex items-center gap-1.5 bg-[#2A2A2A] hover:bg-[#333333] text-xs font-medium text-white px-3 py-1.5 rounded-full transition-colors"
            >
              {copied ? (
                <>
                  <Check size={12} strokeWidth={3} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </motion.button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Share this so friends can find you.
          </p>
        </section>
      </div>

      <FriendActionSheet
        isOpen={!!actionTarget}
        onClose={() => setActionTarget(null)}
        friendship={actionTarget}
        onRemove={remove}
        onBlock={block}
      />
    </div>
  );
};