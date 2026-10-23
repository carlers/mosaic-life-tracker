import React, { useEffect, useRef, useState } from 'react';
import { fetchOwnerDiaryReactions } from '../../../lib/friendData';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2, X, ImagePlus, MessageSquare, SmilePlus } from 'lucide-react';
import { ReactionRow } from '../../messages/ReactionRow';
import { EmojiPickerSheet } from '../../messages/EmojiPickerSheet';
import { parseReactions, hasUserReacted } from '../../../lib/reactionUtils';
import { useAuth } from '../../../hooks/useAuth';
import { parseDiaryPhotos, serializeDiaryPhotos } from '../../../lib/diaryPhotos';
import { saveDiaryImage } from '../../../lib/storage';
import { DiaryPhotoGallery } from './DiaryPhotoGallery';
import type { DiaryDocument } from '../../../db/schema';
import { diaryMarker } from '../../../lib/diaryMarker';
import { BottomSheet } from '../../ui/BottomSheet';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { MOSAIC_FEATURE_PROFILE } from '../../../lib/backendCapabilities';

const CHOICES = ['😀','🥰','😌','😢','😴','😎','🥳','😤','❤️','🌞','🌙','🌧️','🌸','🍀','⭐','💪','📖','🎉','💭','🏆','🧘','🤍','✨','🫶'];

interface DiaryEntrySheetProps {
  date: string;
  entry?: DiaryDocument & { reactions?: string };
  author: string;
  onClose: () => void;
  onSave?: (date: string, content: string, visibility: DiaryDocument['visibility'], emoji: string, photos: string) => Promise<void>;
  onDelete?: (date: string) => Promise<void>;
  friendUserId?: string;
  onReact?: (emoji: string, op: 'add' | 'remove') => Promise<void>;
  onReply?: (content: string) => Promise<void>;
  initialEditing?: boolean;
  /** Retain the sheet through its close animation in modern Day View. */
  isOpen?: boolean;
  onExitComplete?: () => void;
}

/** Read-only for friends; local-first editing for the signed-in owner. */
export const DiaryEntrySheet: React.FC<DiaryEntrySheetProps> = ({
  date, entry, author, onClose, onSave, onDelete, friendUserId, onReact, onReply,
  initialEditing = false, isOpen = true, onExitComplete,
}) => {
  const { user } = useAuth();
  const personalOnly = MOSAIC_FEATURE_PROFILE === 'core-diary';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoIds, setPhotoIds] = useState(() => parseDiaryPhotos(entry?.photos));
  const [uploading, setUploading] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reactBusy, setReactBusy] = useState(false);
  const [ownerReactions, setOwnerReactions] = useState<string | null>(null);
  useEffect(() => {
    if (!onSave || !entry?.id || personalOnly) return;
    let current = true;
    void fetchOwnerDiaryReactions(entry.id)
      .then(reactions => { if (current) setOwnerReactions(reactions); })
      .catch(() => { if (current) setOwnerReactions(null); });
    return () => { current = false; };
  }, [onSave, entry?.id, personalOnly]);
  const [editing, setEditing] = useState(!!onSave && (initialEditing || !entry));
  const lastContentTap = useRef(0);
  const [body, setBody] = useState(entry?.content || '');
  const [emoji, setEmoji] = useState(entry?.emoji || '');
  const [visibility, setVisibility] = useState<DiaryDocument['visibility']>(entry?.visibility || 'private');
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'discard' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = body !== (entry?.content || '') || emoji !== (entry?.emoji || '') ||
    visibility !== (entry?.visibility || 'private') ||
    serializeDiaryPhotos(photoIds) !== serializeDiaryPhotos(parseDiaryPhotos(entry?.photos));

  const close = () => {
    if (busy || uploading) return;
    if (editing && changed) setConfirm('discard');
    else onClose();
  };
  const save = async () => {
    if (!onSave || busy || uploading) return;
    setBusy(true); setError('');
    try { await onSave(date, body, visibility, emoji, serializeDiaryPhotos(photoIds)); onClose(); }
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
  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length || !user?.$id || uploading) return;
    const selected = Array.from(files).slice(0, 5 - photoIds.length);
    if (!selected.length) { setError('Maximum five diary photos.'); return; }
    setUploading(true); setError('');
    const added: string[] = [];
    try {
      for (const file of selected) added.push(await saveDiaryImage(file, user.$id));
      setPhotoIds(existing => [...existing, ...added]);
    } catch (cause) {
      setPhotoIds(existing => [...existing, ...added]);
      setError(cause instanceof Error ? cause.message : 'Photo upload failed.');
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const toggleReaction = async (emoji: string) => {
    if (!onReact || !entry || reactBusy) return;
    const op = hasUserReacted(parseReactions(entry.reactions), emoji, user?.$id || '') ? 'remove' : 'add';
    setReactBusy(true); setError('');
    try { await onReact(emoji, op); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not react.'); }
    finally { setReactBusy(false); }
  };
  const sendReply = async () => {
    if (!onReply || !replyText.trim() || busy) return;
    setBusy(true); setError('');
    try { await onReply(replyText.trim()); setReplyOpen(false); setReplyText(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send reply.'); }
    finally { setBusy(false); }
  };
  const dayLabel = format(parseISO(date), 'EEEE, MMMM d, yyyy');
  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={close} onExitComplete={onExitComplete} title="Diary" height={editing ? 'full' : 'auto'}
        isLocked={busy || !!confirm} preventDismiss={busy || !!confirm} contentMode={editing ? 'fixed' : 'scroll'}>
        <div className={editing ? 'flex min-h-0 flex-1 flex-col px-5 pb-5' : 'px-5 pb-8'} data-testid="diary-entry-sheet">
          <div className="flex items-center justify-between gap-3 py-3">
            <button type="button" onClick={close} aria-label="Close diary" className="rounded-lg p-2 focus-visible:outline"> <X size={22}/> </button>
            <span className="text-base font-semibold">{dayLabel}</span>
            {editing ? (
              <button type="button" disabled={busy || uploading || (!body.trim() && !emoji && photoIds.length === 0)} onClick={save}
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
              {personalOnly ? (
                <div className="my-4 text-sm text-gray-400" aria-label="Diary visibility">Private diary</div>
              ) : (
                <>
                <div className="my-4 flex items-center gap-2">
                  <span className="text-sm text-gray-400">Visibility</span>
                  <select aria-label="Diary visibility" value={visibility} onChange={e => setVisibility(e.target.value as DiaryDocument['visibility'])}
                    className="rounded-lg bg-surfaceHighlight p-2 text-white">
                    <option value="private">Private</option>
                    <option value="followers">Friends</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  aria-label="Choose diary photos" onChange={e => void uploadPhotos(e.target.files)}/>
                <button type="button" disabled={busy || uploading || photoIds.length >= 5} onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg p-2 text-sm text-gray-300 disabled:opacity-40">
                  <ImagePlus size={19}/> {uploading ? 'Uploading…' : `Add photos (${photoIds.length}/5)`}
                </button>
                <DiaryPhotoGallery date={date} photoIds={photoIds} editable onChange={setPhotoIds}/>
                </>
              )}
              <textarea aria-label="Diary text" value={body} onChange={e=>setBody(e.target.value)}
                placeholder="How was your day?" className="min-h-28 flex-1 resize-none rounded-xl bg-transparent p-2 text-base text-white outline-offset-2"
                autoFocus />
            </>
          ) : (
            <>
              <div aria-hidden="true" className="my-5 text-center text-6xl">{entry ? diaryMarker(entry) || '📝' : '📝'}</div>
              <div className="text-sm text-gray-400">{author} · {dayLabel} · {visibility === 'followers' ? 'Friends' : visibility === 'public' ? 'Public' : 'Private'}</div>
              <div className="min-h-16 whitespace-pre-wrap break-words py-5 text-base"
                onClick={() => {
                  if (!onSave) return;
                  const now = Date.now();
                  if (now - lastContentTap.current < 280) setEditing(true);
                  lastContentTap.current = now;
                }}
                onDoubleClick={onSave ? () => setEditing(true) : undefined}>{entry?.content}</div>
              <DiaryPhotoGallery date={date} photoIds={photoIds} friendUserId={friendUserId} diaryId={entry?.id}/>
              {onSave && ownerReactions && <div className="mt-3 flex flex-col gap-2" aria-label="Diary reactions">
                <div className="flex flex-wrap gap-2">
                  {parseReactions(ownerReactions).map(item => (
                    <span key={item.emoji} className="rounded-full bg-surfaceHighlight px-2 py-1 text-xs"
                      title={item.userIds.join(', ')}>{item.emoji} {item.userIds.length}</span>
                  ))}
                </div>
              </div>}
              {onReact && <div className="mt-3 flex flex-col gap-3">
                <ReactionRow reactions={parseReactions(entry?.reactions)} currentUserId={user?.$id ?? ''} isOutgoing={false}
                  onToggle={emoji => void toggleReaction(emoji)} />
                <div className="flex gap-3">
                  <button type="button" disabled={reactBusy} onClick={() => setReactionsOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm"><SmilePlus size={16}/> React</button>
                  {onReply && <button type="button" onClick={() => setReplyOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm"><MessageSquare size={16}/> Reply</button>}
                </div>
              </div>}
            </>
          )}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        </div>
      </BottomSheet>
      <EmojiPickerSheet isOpen={reactionsOpen} onClose={() => setReactionsOpen(false)}
        onPick={emoji => void toggleReaction(emoji)} />
      {replyOpen && <BottomSheet isOpen onClose={() => setReplyOpen(false)} title={`Reply to ${author}`} height="auto">
        <div className="px-4 pb-8 pt-3">
          <p className="mb-3 text-sm text-gray-400">Reply privately about the diary from {date}.</p>
          <textarea aria-label="Diary reply" value={replyText} onChange={e => setReplyText(e.target.value)}
            placeholder="Write a private reply…" className="min-h-28 w-full resize-none rounded-xl bg-surfaceHighlight p-3 text-white" />
          <button type="button" disabled={busy || !replyText.trim()} onClick={() => void sendReply()}
            className="mt-3 w-full rounded-lg bg-surfaceHighlight py-3 font-semibold disabled:opacity-40">Send reply</button>
        </div>
      </BottomSheet>}
      <ConfirmSheet isOpen={confirm !== null} onClose={() => setConfirm(null)}
        title={confirm === 'delete' ? 'Delete diary?' : 'Discard changes?'}
        message={confirm === 'delete' ? 'This diary entry will be deleted.' : 'Your unsaved diary changes will be lost.'}
        destructive confirmLabel={confirm === 'delete' ? 'Delete' : 'Discard'}
        isProcessing={busy} onConfirm={() => { if (confirm === 'delete') void remove(); else {setConfirm(null); onClose();} }} />
    </>
  );
};
