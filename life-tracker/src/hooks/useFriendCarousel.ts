import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useFriends } from './useFriends';
import { useMyProfile } from './useMyProfile';
import { useSettings } from './useSettings';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import {
  fetchProfileByUserId,
  updateFriendBioLocally,
} from '../lib/social';
import type { FriendshipDocument } from '../db/schema';

const PREFS_KEY = 'friend_carousel_prefs';
const DEBUG = import.meta.env.DEV;
// HB-11: bio backfill ran serially, one network round-trip per friend.
// Cap concurrent fetches so a first-load with many bio-less friends does
// not issue N sequential requests.
const BIO_BACKFILL_CONCURRENCY = 4;

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
  const order = Array.isArray(obj.order)
    ? (obj.order as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const hidden = Array.isArray(obj.hidden)
    ? (obj.hidden as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return { order, hidden };
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
  const isOnline = useConnectivity();
  const canUseNetwork = isOnline && !isOffline;
  const { friends, isLoading: friendsLoading } = useFriends();
  const { profile, isLoading: profileLoading } = useMyProfile();
  const { settings, isLoading: settingsLoading, setSetting } = useSettings();

  const prefs = useMemo(() => parsePrefs(settings[PREFS_KEY]), [settings]);

  const attemptedBiosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canUseNetwork) return;
    const missing = friends.filter(
      (f) =>
        (!f.friendBio || f.friendBio === '') &&
        !attemptedBiosRef.current.has(f.friendId)
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      // Mark every candidate as attempted up front so a re-render mid-
      // flight does not re-queue the same friends.
      for (const f of missing) attemptedBiosRef.current.add(f.friendId);

      // Chunked parallel backfill: up to BIO_BACKFILL_CONCURRENCY
      // fetches in flight at once. A failed fetch is logged and
      // swallowed (its `attemptedBiosRef` entry stays set, so it is not
      // retried this session).
      const queue = [...missing];
      const workers: Promise<void>[] = [];
      const runOne = async (): Promise<void> => {
        for (;;) {
          const f = queue.shift();
          if (!f || cancelled) return;
          try {
            const p = await fetchProfileByUserId(f.friendId);
            if (cancelled) return;
            if (p?.bio) {
              await updateFriendBioLocally(f.id, p.bio);
            }
          } catch (err) {
            if (DEBUG) {
              console.warn(
                '[useFriendCarousel] Bio backfill failed for',
                f.friendId,
                err
              );
            }
          }
        }
      };
      for (let i = 0; i < BIO_BACKFILL_CONCURRENCY; i++) {
        workers.push(runOne());
      }
      await Promise.all(workers);
    })();
    return () => {
      cancelled = true;
    };
  }, [canUseNetwork, friends]);

  const persons = useMemo<CarouselPerson[]>(() => {
    const list: CarouselPerson[] = [];

    list.push({
      id: 'me',
      kind: 'me',
      userId: profile?.user_id || user?.$id || '',
      username: profile?.username || '',
      displayName:
        profile?.display_name ||
        profile?.username ||
        user?.name ||
        'Me',
      avatarFileId: profile?.avatar_file_id || '',
      bio: profile?.bio || '',
    });

    const hiddenSet = new Set(prefs.hidden);
    const visibleFriends = friends.filter((f) => !hiddenSet.has(f.friendId));

    const orderIndex = new Map<string, number>();
    prefs.order.forEach((id, idx) => orderIndex.set(id, idx));

    const sorted = [...visibleFriends].sort((a, b) => {
      const aIdx = orderIndex.get(a.friendId);
      const bIdx = orderIndex.get(b.friendId);
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
      if (aIdx !== undefined) return -1;
      if (bIdx !== undefined) return 1;
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
  }, [friends, prefs, profile, user?.$id, user?.name]);

  const reorder = useCallback(
    async (newFriendOrder: string[]) => {
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
