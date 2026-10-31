import { useEffect, useState } from 'react';
import { ImageViewer } from '../home/views/ImageViewer';
import { getChatPhotoUrl } from '../../lib/chatPhotoStorage';

interface Props { userId: string; fileId: string; caption: string }
export function ChatPhotoAttachment({ userId, fileId, caption }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    void getChatPhotoUrl(userId, fileId).then(value => {
      if (!active) { if (value) URL.revokeObjectURL(value); return; }
      objectUrl = value;
      setUrl(value);
    });
    return () => {
      active = false; setOpen(false);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, fileId]);
  return (
    <>
      <button type="button" disabled={!url} aria-label={url ? 'View attached photo' : 'Photo unavailable'}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); setOpen(true); }}
        className="mb-1 block w-full overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-emerald-500">
        {url
          ? <img loading="lazy" src={url} alt={caption || 'Chat photo'} className="block max-h-72 w-full object-contain" />
          : <span className="block min-h-28 min-w-36 p-4 text-center text-xs text-gray-400">Photo unavailable offline</span>}
      </button>
      <ImageViewer isOpen={open && Boolean(url)} imageUrl={url}
        taskTitle={caption || 'Chat photo'} onClose={() => setOpen(false)} />
    </>
  );
}
