import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { isOfflineError } from '../lib/authEvents';
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
  const { user } = useAuth();
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
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
  }, [cachedProfile, userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLoadedUserId(userId);
      setError(null);
      return;
    }
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
  }, [cachedProfile, userId]);

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
        if (isOfflineError(createError)) {
          const optimistic: ProfileCard = {
            $id: `profile_${userId}`,
            user_id: userId,
            username: input.username.toLowerCase(),
            display_name: input.displayName || '',
            avatar_file_id: input.avatarFileId || '',
            bio: input.bio || '',
            is_searchable: true,
          };
          writeCachedOwnProfile(userId, optimistic);
          setResolved({ userId, profile: optimistic });
          setLoadedUserId(userId);
        }
        throw createError;
      }
    },
    [userId]
  );

  const checkUsername = useCallback(
    async (username: string): Promise<boolean | null> => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return null;
      }
      return isUsernameAvailable(username);
    },
    []
  );

  const isDefinitelyOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  const isLoading =
    !!userId &&
    !isDefinitelyOffline &&
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
