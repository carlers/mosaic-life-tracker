import { useState, useEffect } from 'react';
import { getLocalImageUrl } from '../lib/storage';

export function useTaskImage(fileId: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let currentUrl: string | null = null;

    if (!fileId) {
      setImageUrl(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    getLocalImageUrl(fileId).then((url) => {
      if (isMounted) {
        currentUrl = url;
        setImageUrl(url);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      // CRITICAL: Revoke the object URL to prevent memory leaks
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [fileId]);

  return { imageUrl, isLoading };
}