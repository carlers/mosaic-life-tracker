import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { loadStickerImage } from '../../lib/stickerStorage';

interface StickerImageProps {
  fileId: string;
  viewerId: string;
  label: string;
  size?: 'message' | 'picker';
  onReady?: (ready: boolean) => void;
}

export function StickerImage({ fileId, viewerId, label, size = 'message', onReady }: StickerImageProps) {
  const [state, setState] = useState<{ key: string; url: string | null }>({ key: '', url: null });
  const key = viewerId + ':' + fileId;
  useEffect(() => {
    let active = true;
    let activeUrl: string | null = null;
    onReady?.(false);
    loadStickerImage(fileId, viewerId).then(url => {
      if (!active) { if (url) URL.revokeObjectURL(url); return; }
      activeUrl = url;
      setState({ key, url });
      onReady?.(!!url);
    }).catch(() => {
      if (active) {
        setState({ key, url: null });
        onReady?.(false);
      }
    });
    return () => {
      active = false;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [key, viewerId, fileId, onReady]);
  const dimension = size === 'message' ? 'h-36 w-36' : 'h-20 w-20';
  if (state.key !== key || !state.url) {
    return <span role="img" aria-label={'Sticker unavailable: ' + label}
      className={'flex items-center justify-center rounded-lg text-gray-400 ' + dimension}>
      <ImageOff size={20} aria-hidden="true" />
    </span>;
  }
  return <img alt={label} src={state.url} draggable={false} decoding="async"
    className={'object-contain pointer-events-none ' + dimension} />;
}
