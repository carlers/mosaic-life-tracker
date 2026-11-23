import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useFriends } from './useFriends';
import { useMyProfile } from './useMyProfile';
import { useSettings } from './useSettings';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { useFeatureEnabled } from './useFeatureEnabled';
import { isFeatureEnabled } from '../lib/featureControls';
import type { FriendshipDocument } from '../db/schema';

const PREFS_KEY = 'friend_carousel_prefs';
export interface CarouselPerson {
  id: string;
  kind: 'me' | 'friend';
  userId: string;
  username: string;
  displayName: string;
  avatarFileId: string;
  bio: string;
}

interface CarouselPrefs {
  order: string[];
  hidden: string[];
}

const DEFAULT_PREFS: CarouselPrefs = { order: [], hidden: [] };

function parsePrefs(raw: unknown): CarouselPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFS;
  const obj = raw as Record<string, unknown>;
  const ids = (value: unknown) => Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string') : [];
  return { order: ids(obj.order), hidden: ids(obj.hidden) };
}

export interface UseFriendCarouselReturn {
  persons: CarouselPerson[];
  isLoading: boolean;
  reorder: (newOrder: string[]) => Promise<void>;
  toggleVisibility: (friendId: string) => Promise<void>;
  resetOrder: () => Promise<void>;
  rawFriends: FriendshipDocument[];
  order: string[];
  hidden: string[];
}

export function useFriendCarousel(): UseFriendCarouselReturn {
  const { user, isOffline } = useAuth();
  const connectivity = useConnectivity();
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const canUseNetwork = socialEnabled && connectivity.status === 'online' && !isOffline;
  const { friends, isLoading: friendsLoading } = useFriends();
  const { profile, isLoading: profileLoading } = useMyProfile();
  const { settings, isLoading: settingsLoading, setSetting } = useSettings();

  const prefs = useMemo(() => parsePrefs(settings[PREFS_KEY]), [settings]);
  const ownDisplayName = typeof settings.displayName === 'string' ? settings.displayName : '';

  const attemptedBiosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canUseNetwork || !friends.some(friend =>
      !friend.friendBio && !attemptedBiosRef.current.has(friend.friendId))) return;
    let cancelled = false;
    void import('../lib/friendBioBackfill')
      .then(({ backfillUntriedFriendBios }) =>
        backfillUntriedFriendBios(friends, attemptedBiosRef.current, () => cancelled))
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('[useFriendCarousel] Bio backfill unavailable', error);
      });
    return () => { cancelled = true; };
  }, [canUseNetwork, friends]);

  const persons = useMemo<CarouselPerson[]>(() => {
    const list: CarouselPerson[] = [];

    list.push({
      id: 'me',
      kind: 'me',
      userId: profile?.user_id || user?.$id || '',
      username: profile?.username || '',
      displayName:
        ownDisplayName ||
        profile?.display_name ||
        profile?.username ||
        user?.name ||
        'Me',
      avatarFileId: profile?.avatar_file_id || '',
      bio: profile?.bio || '',
    });

    const hiddenSet = new Set(prefs.hidden);
    const visibleFriends = socialEnabled ? friends.filter((f) => !hiddenSet.has(f.friendId)) : [];

    const orderIndex = new Map<string, number>();
    prefs.order.forEach((id, idx) => orderIndex.set(id, idx));

    const sorted = [...visibleFriends].sort((a, b) => {
      const aIdx = orderIndex.get(a.friendId);
      const bIdx = orderIndex.get(b.friendId);
      if (aIdx !== undefined || bIdx !== undefined)
        return aIdx === undefined ? 1 : bIdx === undefined ? -1 : aIdx - bIdx;
      const aName = (a.friendDisplayName || a.friendUsername || '').toLowerCase();
      const bName = (b.friendDisplayName || b.friendUsername || '').toLowerCase();
      return aName.localeCompare(bName);
    });

    for (const f of sorted) {
      list.push({
        id: f.friendId,
        kind: 'friend',
        userId: f.friendId,
        username: f.friendUsername,
        displayName: f.friendDisplayName || f.friendUsername,
        avatarFileId: f.friendAvatarFileId || '',
        bio: f.friendBio || '',
      });
    }

    return list;
  }, [friends, prefs, profile, ownDisplayName, socialEnabled, user?.$id, user?.name]);

  const reorder = useCallback(
    async (newFriendOrder: string[]) => {
      if (!isFeatureEnabled('mosaic_disable_all_social')) return;
      const next: CarouselPrefs = {
        order: newFriendOrder,
        hidden: prefs.hidden,
      };
      await setSetting(PREFS_KEY, next);
    },
    [prefs.hidden, setSetting]
  );

  const toggleVisibility = useCallback(
    async (friendId: string) => {
      if (!isFeatureEnabled('mosaic_disable_all_social')) return;
      const hiddenSet = new Set(prefs.hidden);
      if (hiddenSet.has(friendId)) hiddenSet.delete(friendId);
      else hiddenSet.add(friendId);
      const next: CarouselPrefs = {
        order: prefs.order,
        hidden: Array.from(hiddenSet),
      };
      await setSetting(PREFS_KEY, next);
    },
    [prefs.order, prefs.hidden, setSetting]
  );

  const resetOrder = useCallback(async () => {
    if (!isFeatureEnabled('mosaic_disable_all_social')) return;
    await setSetting(PREFS_KEY, DEFAULT_PREFS);
  }, [setSetting]);

  const isLoading = friendsLoading || profileLoading || settingsLoading;

  return {
    persons,
    isLoading,
    reorder,
    toggleVisibility,
    resetOrder,
    rawFriends: friends,
    order: prefs.order,
    hidden: prefs.hidden,
  };
}
