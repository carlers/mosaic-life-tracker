import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  fetchMyProfile,
  createOrUpdateProfile,
  isUsernameAvailable,
  type ProfileCard,
  type MyProfileInput,
} from '../lib/social';

export interface UseMyProfileReturn {
  profile: ProfileCard | null;
  isLoading: boolean;
  error: string | null;
  createProfile: (
    input: Omit<MyProfileInput, 'userId'>
  ) => Promise<ProfileCard | null>;
  refetch: () => Promise<void>;
  checkUsername: (username: string) => Promise<boolean>;
}

export function useMyProfile(): UseMyProfileReturn {
  const { user } = useAuth();
  const userId = user?.$id;
  const [profile, setProfile] = useState<ProfileCard | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const p = await fetchMyProfile(userId);
      setProfile(p);
      setLoadedUserId(userId);
    } catch (err) {
      console.error('[useMyProfile] Load failed:', err);
      setError('Could not load profile.');
      setLoadedUserId(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    (async () => {
      try {
        const p = await fetchMyProfile(userId);
        if (!isMounted) return;
        setProfile(p);
        setLoadedUserId(userId);
      } catch (err) {
        if (!isMounted) return;
        console.error('[useMyProfile] Load failed:', err);
        setError('Could not load profile.');
        setLoadedUserId(userId);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const createProfile = useCallback(
    async (input: Omit<MyProfileInput, 'userId'>) => {
      if (!userId) {
        console.error('[useMyProfile] Cannot create profile: Not authenticated');
        return null;
      }
      try {
        const created = await createOrUpdateProfile({ ...input, userId });
        setProfile(created);
        return created;
      } catch (err) {
        console.error('[useMyProfile] Create failed:', err);
        throw err;
      }
    },
    [userId]
  );

  const checkUsername = useCallback(async (username: string) => {
    return isUsernameAvailable(username);
  }, []);

  const isLoading = !!userId && loadedUserId !== userId;

  return {
    profile: userId && loadedUserId === userId ? profile : null,
    isLoading,
    error,
    createProfile,
    refetch: load,
    checkUsername,
  };
}