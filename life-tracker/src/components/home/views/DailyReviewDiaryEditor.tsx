import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { parseDiaryPhotos } from '../../../lib/diaryPhotos';
import { captureAccountWorkGeneration, isAccountWorkCurrent } from '../../../lib/accountWorkScope';
import type { DiaryDocument } from '../../../db/schema';

type Visibility = DiaryDocument['visibility'];
type SaveDiary = (date: string, content: string, visibility: Visibility, emoji: string, photos?: string) => Promise<void>;
interface Props {
  date: string;
  userId: string;
  entry?: DiaryDocument;
  onSave: SaveDiary;
  onOpenFull: () => void;
}
type Snapshot = {
  date: string; userId: string; content: string; visibility: Visibility;
  emoji: string; photos?: string; sourceUpdatedAt: string; generation: number | null; sequence: number;
};
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'empty' | 'conflict';

export const DailyReviewDiaryEditor: React.FC<Props> = ({ date, userId, entry, onSave, onOpenFull }) => {
  const [text, setText] = useState(entry?.content ?? '');
  const [visibility, setVisibility] = useState<Visibility>(entry?.visibility ?? 'private');
  const [status, setStatus] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Snapshot | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const sequenceRef = useRef(0);
  const latestEntryRef = useRef(entry);
  const ownSavedRef = useRef<string | null>(null);
  useEffect(() => { latestEntryRef.current = entry; }, [entry]);

  const persist = useCallback((snapshot: Snapshot) => {
    const save = async () => {
      if (snapshot.userId !== userId || snapshot.generation === null ||
          !isAccountWorkCurrent(snapshot.userId, snapshot.generation)) return;
      const latest = latestEntryRef.current;
      if (latest && latest.updatedAt !== snapshot.sourceUpdatedAt &&
          latest.content !== ownSavedRef.current) {
        if (mountedRef.current) setStatus('conflict');
        return;
      }
      if (!snapshot.content.trim() && !snapshot.emoji.trim() &&
        parseDiaryPhotos(snapshot.photos).length === 0) {
        if (mountedRef.current) setStatus('empty');
        return;
      }
      if (mountedRef.current && snapshot.sequence === sequenceRef.current) setStatus('saving');
      await onSave(snapshot.date, snapshot.content, snapshot.visibility, snapshot.emoji, snapshot.photos);
      ownSavedRef.current = snapshot.content;
      if (mountedRef.current && snapshot.sequence === sequenceRef.current) {
        dirtyRef.current = false;
        setStatus('saved');
      }
    };
    queueRef.current = queueRef.current.catch(() => {}).then(save);
    void queueRef.current.catch(cause => {
      if (mountedRef.current && snapshot.sequence === sequenceRef.current) {
        setStatus('error');
        setError(cause instanceof Error ? cause.message : 'Diary could not be saved.');
      }
    });
  }, [onSave, userId]);

  const flush = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    const snapshot = pendingRef.current;
    pendingRef.current = null;
    if (snapshot) persist(snapshot);
  }, [persist]);

  const schedule = (nextText: string, nextVisibility: Visibility) => {
    dirtyRef.current = true;
    sequenceRef.current += 1;
    setStatus('pending');
    setError('');
    pendingRef.current = {
      date, userId, content: nextText, visibility: nextVisibility,
      emoji: entry?.emoji ?? '', photos: entry?.photos,
      sourceUpdatedAt: entry?.updatedAt ?? '',
      generation: captureAccountWorkGeneration(userId),
      sequence: sequenceRef.current,
    };
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 650);
  };

  useEffect(() => {
    if (!dirtyRef.current) {
      setText(entry?.content ?? '');
      setVisibility(entry?.visibility ?? 'private');
    } else if (entry && entry.updatedAt !== pendingRef.current?.sourceUpdatedAt &&
      entry.content !== ownSavedRef.current && pendingRef.current) {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current = null;
      setStatus('conflict');
    }
  }, [entry]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    const pending = pendingRef.current;
    pendingRef.current = null;
    // The snapshot retains the original account/date; never commit to the newly selected day.
    if (pending && pending.generation !== null &&
      isAccountWorkCurrent(pending.userId, pending.generation)) persist(pending);
  }, [persist]);

  const reload = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null; pendingRef.current = null;
    dirtyRef.current = false; ownSavedRef.current = null;
    setText(entry?.content ?? ''); setVisibility(entry?.visibility ?? 'private');
    setStatus('idle');
  };

  const saveOverConflict = () => {
    const next = {
      date, userId, content: text, visibility, emoji: entry?.emoji ?? '',
      photos: entry?.photos, sourceUpdatedAt: entry?.updatedAt ?? '',
      generation: captureAccountWorkGeneration(userId), sequence: ++sequenceRef.current,
    };
    setStatus('pending');
    persist(next);
  };

  return <div className="mt-3 rounded-lg bg-surfaceHighlight p-3" aria-label="Diary editor">
    <textarea aria-label="Diary text" value={text}
      onChange={event => { setText(event.target.value); schedule(event.target.value, visibility); }}
      onBlur={flush} placeholder="How was your day?"
      className="swiper-no-swiping min-h-36 w-full resize-y rounded-lg border border-[#444444] bg-surface px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2"
      style={{ touchAction: 'pan-y' }} />
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <MosaicSelect variant="compact" label="Diary visibility"
        value={visibility} onChange={value => {
          const next = value as Visibility;
          setVisibility(next); schedule(text, next);
        }}
        options={[{value:'private',label:'Private'},{value:'followers',label:'Friends'},{value:'public',label:'Public'}]} />
      <button type="button" onClick={onOpenFull}
        className="rounded-lg px-2 py-1.5 text-xs text-gray-300 focus-visible:outline">Emoji · Photos · More</button>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400" role="status" aria-live="polite">
      <span>{status === 'saved' ? 'Saved locally' : status === 'saving' ? 'Saving…' :
        status === 'pending' ? 'Unsaved changes' : status === 'error' ? 'Save failed' :
        status === 'empty' ? 'Empty entries cannot be saved' :
        status === 'conflict' ? 'Diary changed elsewhere' : ''}</span>
      {status === 'error' && <button type="button" onClick={saveOverConflict}
        className="underline">Retry</button>}
      {status === 'conflict' && <span className="inline-flex gap-3">
        <button type="button" onClick={reload} className="underline">Reload latest</button>
        <button type="button" onClick={saveOverConflict} className="underline">Keep my edit</button>
      </span>}
    </div>
    {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
  </div>;
};
