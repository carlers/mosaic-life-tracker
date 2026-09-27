import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import {
  fetchMyProfile,
  createOrUpdateProfile,
  isUsernameAvailable,
  type ProfileCard,
  type MyProfileInput,
} from '../lib/social';
import {
  clearCachedOwnProfile,
  readCachedOwnProfile,
  writeCachedOwnProfile,
} from '../lib/profileCache';

export interface UseMyProfileReturn {
  profile: ProfileCard | null;
  isLoading: boolean;
  error: string | null;
  createProfile: (
    input: Omit<MyProfileInput, 'userId'>
  ) => Promise<ProfileCard | null>;
  refetch: () => Promise<void>;
  checkUsername: (username: string) => Promise<boolean | null>;
}

export function useMyProfile(): UseMyProfileReturn {
  const { user, isOffline } = useAuth();
  const connectivity = useConnectivity();
  const canUseNetwork = connectivity.status === 'online' && !isOffline;
  const userId = user?.$id;
  const cachedProfile = useMemo(
    () => (userId ? readCachedOwnProfile(userId) : null),
    [userId]
  );
  const [resolved, setResolved] = useState<{
    userId: string;
    profile: ProfileCard | null;
  } | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(
    cachedProfile && userId ? userId : null
  );
  const [error, setError] = useState<string | null>(null);

  const visibleProfile =
    userId && resolved?.userId === userId
      ? resolved.profile
      : userId
        ? cachedProfile
        : null;

  const runLoad = useCallback(async (): Promise<void> => {
    if (!userId) return;
    if (!canUseNetwork) {
      return;
    }
    setError(null);
    try {
      const profile = await fetchMyProfile(userId);
      if (profile) writeCachedOwnProfile(userId, profile);
      else clearCachedOwnProfile(userId);
      setResolved({ userId, profile });
      setLoadedUserId(userId);
    } catch (loadError) {
      console.error('[useMyProfile] Load failed:', loadError);
      setError(cachedProfile ? null : 'Could not load profile.');
      setLoadedUserId(userId);
    }
  }, [cachedProfile, canUseNetwork, userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    if (!canUseNetwork) return;
    void fetchMyProfile(userId)
      .then((profile) => {
        if (!active) return;
        if (profile) writeCachedOwnProfile(userId, profile);
        else clearCachedOwnProfile(userId);
        setResolved({ userId, profile });
        setLoadedUserId(userId);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error('[useMyProfile] Load failed:', loadError);
        setError(cachedProfile ? null : 'Could not load profile.');
        setLoadedUserId(userId);
      });
    return () => {
      active = false;
    };
  }, [cachedProfile, canUseNetwork, userId]);

  const createProfile = useCallback(
    async (input: Omit<MyProfileInput, 'userId'>) => {
      if (!userId) {
        console.error('[useMyProfile] Cannot create profile: Not authenticated');
        return null;
      }
      try {
        const created = await createOrUpdateProfile({ ...input, userId });
        writeCachedOwnProfile(userId, created);
        setResolved({ userId, profile: created });
        setLoadedUserId(userId);
        return created;
      } catch (createError) {
        console.error('[useMyProfile] Create failed:', createError);
        throw createError;
      }
    },
    [userId]
  );

  const checkUsername = useCallback(
    async (username: string): Promise<boolean | null> => {
      if (!canUseNetwork) {
        return null;
      }
      return isUsernameAvailable(username);
    },
    [canUseNetwork]
  );

  const isLoading =
    !!userId &&
    canUseNetwork &&
    !cachedProfile &&
    loadedUserId !== userId;
  const visibleError =
    userId && loadedUserId === userId ? error : null;

  return {
    profile: visibleProfile,
    isLoading,
    error: visibleError,
    createProfile,
    refetch: runLoad,
    checkUsername,
  };
}
