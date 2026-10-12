import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import type { DiaryDocument } from '../../../db/schema';
import { diaryMarker } from '../../../lib/diaryMarker';
import { BottomSheet } from '../../ui/BottomSheet';
import { ConfirmSheet } from '../../ui/ConfirmSheet';

const CHOICES = ['😀','🥰','😌','😢','😴','😎','🥳','😤','❤️','🌞','🌙','🌧️','🌸','🍀','⭐','💪','📖','🎉','💭','🏆','🧘','🤍','✨','🫶'];

interface DiaryEntrySheetProps {
  date: string;
  entry?: DiaryDocument;
  author: string;
  onClose: () => void;
  onSave?: (date: string, content: string, visibility: DiaryDocument['visibility'], emoji: string) => Promise<void>;
  onDelete?: (date: string) => Promise<void>;
}

/** Read-only for friends; local-first editing for the signed-in owner. */
export const DiaryEntrySheet: React.FC<DiaryEntrySheetProps> = ({
  date, entry, author, onClose, onSave, onDelete,
}) => {
  const [editing, setEditing] = useState(!entry && !!onSave);
  const [body, setBody] = useState(entry?.content || '');
  const [emoji, setEmoji] = useState(entry?.emoji || '');
  const [visibility, setVisibility] = useState<DiaryDocument['visibility']>(entry?.visibility || 'private');
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'discard' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = body !== (entry?.content || '') || emoji !== (entry?.emoji || '') ||
    visibility !== (entry?.visibility || 'private');

  useEffect(() => {
    setEditing(!entry && !!onSave);
    setBody(entry?.content || '');
    setEmoji(entry?.emoji || '');
    setVisibility(entry?.visibility || 'private');
    setPicker(false);
    setMenu(false);
    setError('');
  }, [date, entry?.id, onSave]);

  const close = () => {
    if (busy) return;
    if (editing && changed) setConfirm('discard');
    else onClose();
  };
  const save = async () => {
    if (!onSave || busy) return;
    setBusy(true); setError('');
    try { await onSave(date, body, visibility, emoji); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save diary'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!onDelete || busy) return;
    setBusy(true); setError('');
    try { await onDelete(date); setConfirm(null); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete diary'); setConfirm(null); }
    finally { setBusy(false); }
  };
  const dayLabel = format(parseISO(date), 'EEEE, MMMM d, yyyy');
  return (
    <>
      <BottomSheet isOpen onClose={close} title="Diary" height={editing ? 'full' : 'auto'}
        isLocked={busy || !!confirm} preventDismiss={busy || !!confirm} contentMode={editing ? 'fixed' : 'scroll'}>
        <div className={editing ? 'flex min-h-0 flex-1 flex-col px-5 pb-5' : 'px-5 pb-8'} data-testid="diary-entry-sheet">
          <div className="flex items-center justify-between gap-3 py-3">
            <button type="button" onClick={close} aria-label="Close diary" className="rounded-lg p-2 focus-visible:outline"> <X size={22}/> </button>
            <span className="text-base font-semibold">{dayLabel}</span>
            {editing ? (
              <button type="button" disabled={busy || (!body.trim() && !emoji)} onClick={save}
                className="rounded-lg px-3 py-2 font-semibold disabled:opacity-40">Done</button>
            ) : onSave ? (
              <button type="button" aria-label="Diary actions" onClick={() => setMenu(value => !value)}
                className="rounded-lg p-2"><MoreHorizontal size={22}/></button>
            ) : <span className="w-10" />}
          </div>
          {menu && !editing && (
            <div role="group" aria-label="Diary actions" className="mb-3 flex justify-end gap-3">
              <button type="button" onClick={() => { setMenu(false); setEditing(true); }}
                className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2"><Pencil size={16}/> Edit</button>
              {onDelete && <button type="button" onClick={() => { setMenu(false); setConfirm('delete'); }}
                className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-red-500"><Trash2 size={16}/> Delete</button>}
            </div>
          )}
          {editing ? (
            <>
              <button type="button" onClick={() => setPicker(value => !value)}
                className="mx-auto my-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surfaceHighlight text-5xl"
                aria-label="Choose diary emoji">{emoji || '＋'}</button>
              {picker && (
                <div className="grid grid-cols-8 gap-1 rounded-xl bg-surfaceHighlight p-2" role="group" aria-label="Choose an emoji">
                  <button type="button" aria-label="Clear emoji" onClick={() => {setEmoji(''); setPicker(false);}}>✕</button>
                  {CHOICES.map(choice => <button type="button" key={choice} className="rounded p-1 text-2xl"
                    aria-label={`Use ${choice} emoji`} onClick={() => {setEmoji(choice); setPicker(false);}}>{choice}</button>)}
                </div>
              )}
              <div className="my-4 flex items-center gap-2">
                <span className="text-sm text-gray-400">Visibility</span>
                <select aria-label="Diary visibility" value={visibility} onChange={e => setVisibility(e.target.value as DiaryDocument['visibility'])}
                  className="rounded-lg bg-surfaceHighlight p-2 text-white">
                  <option value="private">Private</option>
                  <option value="followers">Friends</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <textarea aria-label="Diary text" value={body} onChange={e=>setBody(e.target.value)}
                placeholder="How was your day?" className="min-h-28 flex-1 resize-none rounded-xl bg-transparent p-2 text-base text-white outline-offset-2"
                autoFocus />
            </>
          ) : (
            <>
              <div aria-hidden="true" className="my-5 text-center text-6xl">{entry ? diaryMarker(entry) || '📝' : '📝'}</div>
              <div className="text-sm text-gray-400">{author} · {dayLabel} · {visibility === 'followers' ? 'Friends' : visibility === 'public' ? 'Public' : 'Private'}</div>
              <div className="min-h-16 whitespace-pre-wrap break-words py-5 text-base">{entry?.content}</div>
            </>
          )}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        </div>
      </BottomSheet>
      <ConfirmSheet isOpen={confirm !== null} onClose={() => setConfirm(null)}
        title={confirm === 'delete' ? 'Delete diary?' : 'Discard changes?'}
        message={confirm === 'delete' ? 'This diary entry will be deleted.' : 'Your unsaved diary changes will be lost.'}
        destructive confirmLabel={confirm === 'delete' ? 'Delete' : 'Discard'}
        isProcessing={busy} onConfirm={() => { if (confirm === 'delete') void remove(); else {setConfirm(null); onClose();} }} />
    </>
  );
};
