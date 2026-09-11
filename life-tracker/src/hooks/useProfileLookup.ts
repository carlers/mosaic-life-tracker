import { useState, useEffect, useRef, useCallback } from 'react';
import { searchProfiles, type ProfileCard } from '../lib/social';
import { useAuth } from './useAuth';

export interface UseProfileLookupReturn {
  results: ProfileCard[];
  isSearching: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
}

export function useProfileLookup(debounceMs = 300): UseProfileLookupReturn {
  const { user } = useAuth();
  const userId = user?.$id;

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
    if (!trimmed || !userId) return;

    const uid = userId;
    let effectIsActive = true;

    timerRef.current = setTimeout(async () => {
      if (!effectIsActive) return;

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
  }, [query, userId, debounceMs]);

  return { results, isSearching, error, query, setQuery, clear };
}