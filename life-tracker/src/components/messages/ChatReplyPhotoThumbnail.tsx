import { useEffect, useState } from 'react';
import { getChatPhotoUrl } from '../../lib/chatPhotoStorage';

// A quote is a read-only preview of the existing authorized photo. It does not
// create a new upload or persist another copy of the image in message metadata.
export function ChatReplyPhotoThumbnail({ userId, fileId }: { userId: string; fileId: string }) {
  const [photo, setPhoto] = useState<{ userId: string; fileId: string; url: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    void getChatPhotoUrl(userId, fileId).then(value => {
      if (!active) {
        if (value) URL.revokeObjectURL(value);
        return;
      }
      url = value;
      setPhoto({ userId, fileId, url: value });
    }).catch(() => {
      if (active) setPhoto({ userId, fileId, url: null });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [userId, fileId]);
  const url = photo?.userId === userId && photo?.fileId === fileId ? photo.url : null;
  return url
    ? <img src={url} loading="lazy" alt="Quoted photo" draggable={false}
        className="h-11 w-11 shrink-0 rounded-md object-cover" />
    : <span aria-label="Quoted photo unavailable" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surfaceHighlight text-[10px] text-gray-400">
        Photo
      </span>;
}
