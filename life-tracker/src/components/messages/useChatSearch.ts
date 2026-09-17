import { useCallback, useState } from 'react';

interface UseChatSearchReturn {
  isSearching: boolean;
  searchQuery: string;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (q: string) => void;
}

export function useChatSearch(): UseChatSearchReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const openSearch = useCallback(() => {
    setIsSearching(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearching(false);
    setSearchQuery('');
  }, []);

  return {
    isSearching,
    searchQuery,
    openSearch,
    closeSearch,
    setSearchQuery,
  };
}
