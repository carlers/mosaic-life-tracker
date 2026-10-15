import React, { lazy, Suspense, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { parseDiaryPhotos } from '../../../lib/diaryPhotos';
import { fetchFriendDiaryPhoto } from '../../../lib/friendData';

const ImageViewer = lazy(() => import('./ImageViewer').then(m => ({ default: m.ImageViewer })));

interface GalleryProps {
  photoIds: readonly string[];
  editable?: boolean;
  onChange?: (ids: string[]) => void;
  date: string;
  friendUserId?: string;
  diaryId?: string;
}

const DiaryPhoto: React.FC<{
  id: string; date: string; friendUserId?: string; diaryId?: string;
  editable?: boolean; onRemove?: () => void;
  onMoveBefore?: () => void; onMoveAfter?: () => void;
}> = ({ id, date, friendUserId, diaryId, editable, onRemove, onMoveBefore, onMoveAfter }) => {
  const [open, setOpen] = useState(false);
  const ownerImage = useTaskImage(id, !friendUserId);
  const [friendImage, setFriendImage] = useState<string | null>(null);
  const [friendLoading, setFriendLoading] = useState(Boolean(friendUserId));
  const [friendFailed, setFriendFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!friendUserId || !diaryId) return;
    let active = true; let localUrl: string | null = null;
    void fetchFriendDiaryPhoto(friendUserId, diaryId, id).then(blob => {
      if (!active) return;
      localUrl = URL.createObjectURL(blob);
      setFriendImage(localUrl);
    }).catch(() => { if (active) setFriendFailed(true); }).finally(() => { if (active) setFriendLoading(false); });
    return () => { active = false; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [friendUserId, diaryId, id, retry]);
  const imageUrl = friendUserId ? friendImage : ownerImage.imageUrl;
  const isLoading = friendUserId ? friendLoading : ownerImage.isLoading;
  const retryImage = () => { if (friendUserId) { setFriendFailed(false); setFriendLoading(true); setRetry(r => r + 1); } else ownerImage.retryImage(); };
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl bg-surfaceHighlight">
      <button type="button" aria-label="View diary photo" disabled={!imageUrl}
        onClick={() => setOpen(true)} className="flex aspect-square w-full items-center justify-center overflow-hidden">
        {imageUrl ? <img src={imageUrl} alt="Diary attachment" loading="lazy" className="h-full w-full object-cover"/>
          : <span className="text-xs text-gray-400">{isLoading ? 'Loading…' : 'Photo unavailable'}</span>}
      </button>
      {!imageUrl && !isLoading && (friendFailed || !friendUserId) && <button type="button" onClick={retryImage} className="text-xs">Retry</button>}
      {editable && (
        <div className="flex items-center justify-around gap-1 p-1">
          <button type="button" aria-label="Move diary photo left" disabled={!onMoveBefore}
            onClick={onMoveBefore}><ChevronLeft size={15}/></button>
          <button type="button" aria-label="Remove diary photo" onClick={onRemove}><X size={15}/></button>
          <button type="button" aria-label="Move diary photo right" disabled={!onMoveAfter}
            onClick={onMoveAfter}><ChevronRight size={15}/></button>
        </div>
      )}
      {open && imageUrl && <Suspense fallback={null}><ImageViewer isOpen imageUrl={imageUrl}
        taskTitle="Diary photo" taskDate={date} onClose={() => setOpen(false)} /></Suspense>}
    </div>
  );
};

export const DiaryPhotoGallery: React.FC<GalleryProps> = ({ photoIds, editable, onChange, date, friendUserId, diaryId }) => {
  const ids = parseDiaryPhotos(JSON.stringify(photoIds));
  if (!ids.length) return null;
  const move = (from: number, to: number) => {
    const next = [...ids]; const [id] = next.splice(from, 1); next.splice(to, 0, id); onChange?.(next);
  };
  return <div aria-label="Diary photos" className="grid grid-cols-3 gap-2 py-3">
    {ids.map((id, index) => <DiaryPhoto key={`${friendUserId || ''}:${diaryId || ''}:${id}`} id={id} date={date} editable={editable} friendUserId={friendUserId} diaryId={diaryId}
      onRemove={() => onChange?.(ids.filter(photoId => photoId !== id))}
      onMoveBefore={index > 0 ? () => move(index, index - 1) : undefined}
      onMoveAfter={index < ids.length - 1 ? () => move(index, index + 1) : undefined}/>)}
  </div>;
};
