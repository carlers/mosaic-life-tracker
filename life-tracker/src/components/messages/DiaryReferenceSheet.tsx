
import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { DiaryEntrySheet } from '../home/views/DiaryEntrySheet';
import { fetchFriendDiaryMonth, type FriendDiaryDocument } from '../../lib/friendData';
import { useDiary } from '../../hooks/useDiary';
import { useAuth } from '../../hooks/useAuth';

export interface DiaryReference {
  id: string;
  ownerId: string;
  date: string;
}

/** Mounted only when a quote is opened; every remote read rechecks friend authorization. */
export const DiaryReferenceSheet: React.FC<{
  reference: DiaryReference;
  isOpen: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
}> = ({ reference, isOpen, onClose, onExitComplete }) => {
  const { user } = useAuth();
  const userId = user?.$id ?? '';
  const isOwner = userId === reference.ownerId;
  const { getEntryByDate, isLoading: ownerLoading } = useDiary(isOwner);
  const [remote, setRemote] = useState<{ status: 'loading' | 'available' | 'unavailable'; entry?: FriendDiaryDocument }>({ status: 'loading' });

  useEffect(() => {
    if (!isOpen || !userId || isOwner) return;
    let current = true;
    fetchFriendDiaryMonth(userId, reference.ownerId, reference.date.slice(0, 7))
      .then(entries => {
        if (!current) return;
        const entry = entries.find(item => item.id === reference.id && item.date === reference.date);
        setRemote(entry ? { status: 'available', entry } : { status: 'unavailable' });
      })
      .catch(() => { if (current) setRemote({ status: 'unavailable' }); });
    return () => { current = false; };
  }, [isOpen, userId, isOwner, reference.id, reference.ownerId, reference.date]);

  const ownedEntry = isOwner ? getEntryByDate(reference.date) : undefined;
  const entry = isOwner
    ? ownedEntry?.id === reference.id ? ownedEntry : undefined
    : remote.status === 'available' ? remote.entry : undefined;
  if (entry && userId) {
    return <DiaryEntrySheet isOpen={isOpen} onExitComplete={onExitComplete}
      date={reference.date} entry={entry}
      author={isOwner ? 'Me' : 'Friend'}
      friendUserId={isOwner ? undefined : reference.ownerId}
      onClose={onClose} />;
  }
  const loading = Boolean(userId && (isOwner ? ownerLoading : remote.status === 'loading'));
  return <BottomSheet isOpen={isOpen} onExitComplete={onExitComplete}
    onClose={onClose} title="Diary entry" height="auto">
    <div className="px-5 pb-8 pt-4" role="status">
      {loading ? 'Loading diary…' : 'Diary entry unavailable or no longer shared.'}
    </div>
  </BottomSheet>;
};
