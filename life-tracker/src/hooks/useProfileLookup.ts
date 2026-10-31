import { useState, useEffect, useRef, useCallback } from 'react';
import { searchProfiles, type ProfileCard } from '../lib/social';
import { useAuth } from './useAuth';
import { useConnectivity } from './useConnectivity';
import { useFeatureEnabled } from './useFeatureEnabled';
import { isFeatureEnabled } from '../lib/featureControls';

export interface UseProfileLookupReturn {
  results: ProfileCard[];
  isSearching: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
}

export function useProfileLookup(debounceMs = 300): UseProfileLookupReturn {
  const discoveryEnabled = useFeatureEnabled('friendDiscovery');
  const { user } = useAuth();
  const userId = user?.$id;
  const connectivity = useConnectivity();

  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<ProfileCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render-body reset on user switch (canonical pattern from conventions §9)
  const [trackedUserId, setTrackedUserId] = useState<string | undefined>(userId);
  if (userId !== trackedUserId) {
    setTrackedUserId(userId);
    setQueryState('');
    setResults([]);
    setIsSearching(false);
    setError(null);
  }

  const setQuery = useCallback((q: string) => {
    if (!isFeatureEnabled('friendDiscovery')) return;
    setQueryState(q);
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setError(null);
    } else {
      setIsSearching(true);
      setError(null);
    }
  }, []);

  const clear = useCallback(() => {
    setQueryState('');
    setResults([]);
    setIsSearching(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (!discoveryEnabled || !trimmed || !userId) return;

    const uid = userId;
    let effectIsActive = true;

    timerRef.current = setTimeout(async () => {
      if (!effectIsActive || !isFeatureEnabled('friendDiscovery')) return;

      if (connectivity.status !== 'online') {
        setError('You need to be online to search.');
        setIsSearching(false);
        return;
      }

      try {
        const res = await searchProfiles(trimmed, uid);
        if (!effectIsActive) return;
        setResults(res);
        setIsSearching(false);
      } catch (err) {
        if (!effectIsActive) return;
        console.error('[useProfileLookup] Search failed:', err);
        setError('Search failed. Try again.');
        setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      effectIsActive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connectivity.status, query, userId, debounceMs, discoveryEnabled]);

  return {
    results: discoveryEnabled ? results : [],
    isSearching: discoveryEnabled && isSearching,
    error: discoveryEnabled ? error : null,
    query: discoveryEnabled ? query : '',
    setQuery, clear,
  };
}