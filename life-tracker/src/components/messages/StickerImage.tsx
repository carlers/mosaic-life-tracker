import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { loadStickerImage } from '../../lib/stickerStorage';
import { getConnectivitySnapshot, subscribeToConnectivity } from '../../lib/connectivity';

interface StickerImageProps {
  fileId: string;
  viewerId: string;
  label: string;
  size?: 'message' | 'picker';
  onReady?: (ready: boolean) => void;
}

/** Only download images close to the viewport. An older chat may have dozens
 * of messages referencing the same asset, and each download costs transfer. */
export function StickerImage({ fileId, viewerId, label, size = 'message', onReady }: StickerImageProps) {
  const [state, setState] = useState<{ key: string; url: string | null }>({ key: '', url: null });
  const [visibleKey, setVisibleKey] = useState<string | null>(null);
  const container = useRef<HTMLSpanElement>(null);
  const key = viewerId + ':' + fileId;

  useEffect(() => {
    const element = container.current;
    if (!element || !viewerId) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisibleKey(key);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisibleKey(key);
        observer.disconnect();
      }
    }, { rootMargin: '250px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [key, viewerId]);

  useEffect(() => {
    if (visibleKey !== key) return;
    let active = true;
    let loaded = false;
    let loading = false;
    let retryAfterLoad = false;
    let activeUrl: string | null = null;
    let previousStatus = getConnectivitySnapshot().status;
    onReady?.(false);

    const load = () => {
      if (!active || loading || loaded) return;
      loading = true;
      void loadStickerImage(fileId, viewerId).then(url => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          loaded = true;
          activeUrl = url;
          setState({ key, url });
          onReady?.(true);
        } else {
          setState({ key, url: null });
        }
      }).catch(() => {
        if (active) setState({ key, url: null });
      }).finally(() => {
        loading = false;
        if (retryAfterLoad && !loaded && active) {
          retryAfterLoad = false;
          load();
        }
      });
    };

    load(); // Reads IndexedDB even offline, without a network request.
    const unsubscribe = subscribeToConnectivity(() => {
      const next = getConnectivitySnapshot().status;
      if (next === 'online' && previousStatus !== 'online' && !loaded) {
        if (loading) retryAfterLoad = true;
        else load();
      }
      previousStatus = next;
    });

    return () => {
      active = false;
      unsubscribe();
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [key, visibleKey, viewerId, fileId, onReady]);

  const dimension = size === 'message' ? 'h-36 w-36' : 'h-20 w-20';
  const isReady = state.key === key && !!state.url;
  return (
    <span ref={container}
      className={'inline-flex shrink-0 items-center justify-center ' + dimension}>
      {isReady ? (
        <img alt={label} src={state.url!} draggable={false} decoding="async"
          className="h-full w-full object-contain pointer-events-none" />
      ) : (
        <span role="img" aria-label={visibleKey === key ? 'Sticker unavailable or loading: ' + label : 'Sticker pending: ' + label}
          className="flex h-full w-full items-center justify-center rounded-lg text-gray-400">
          <ImageOff size={20} aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
