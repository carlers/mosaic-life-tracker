import { useState, useEffect } from 'react';
import { getLocalImageUrl } from '../lib/storage';

interface ImageState {
  url: string | null;
  isLoading: boolean;
}

export function useTaskImage(fileId: string | undefined) {
  const [trackedFileId, setTrackedFileId] = useState<string | undefined>(fileId);
  const [state, setState] = useState<ImageState>(() => ({
    url: null,
    isLoading: !!fileId,
  }));

  // When fileId changes (including to undefined), invalidate the previously
  // cached URL immediately. Without this, closing then reopening a viewer for
  // the same fileId would hand out a stale blob URL that the effect cleanup
  // had already revoked. This is the documented "adjust state when a prop
  // changes" pattern — see react.dev/learn/you-might-not-need-an-effect.
  if (fileId !== trackedFileId) {
    setTrackedFileId(fileId);
    setState({ url: null, isLoading: !!fileId });
  }

  useEffect(() => {
    if (!fileId) return;

    let isMounted = true;
    let currentUrl: string | null = null;

    getLocalImageUrl(fileId).then((url) => {
      if (!isMounted) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      currentUrl = url;
      setState({ url, isLoading: false });
    });

    return () => {
      isMounted = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [fileId]);

  return { imageUrl: state.url, isLoading: state.isLoading };
}