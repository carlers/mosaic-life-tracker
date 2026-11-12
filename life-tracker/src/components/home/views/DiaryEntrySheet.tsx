import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './diaryEditor.css';
import { fetchOwnerDiaryReactions } from '../../../lib/friendData';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2, X, ImagePlus, MessageSquare, SmilePlus } from 'lucide-react';
import { ReactionRow } from '../../messages/ReactionRow';
import { EmojiPickerSheet } from '../../messages/EmojiPickerSheet';
import { parseReactions, hasUserReacted } from '../../../lib/reactionUtils';
import { useAuth } from '../../../hooks/useAuth';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import { isFeatureEnabled } from '../../../lib/featureControls';
import { parseDiaryPhotos, serializeDiaryPhotos } from '../../../lib/diaryPhotos';
import { saveDiaryImage } from '../../../lib/storage';
import { DiaryPhotoGallery } from './DiaryPhotoGallery';
import type { DiaryDocument } from '../../../db/schema';
import { diaryMarker } from '../../../lib/diaryMarker';
import { BottomSheet } from '../../ui/BottomSheet';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { ConfirmSheet } from '../../ui/ConfirmSheet';

const CHOICES = ['😀','🥰','😌','😢','😴','😎','🥳','😤','❤️','🌞','🌙','🌧️','🌸','🍀','⭐','💪','📖','🎉','💭','🏆','🧘','🤍','✨','🫶'];

interface DiaryEntrySheetProps {
  date: string;
  entry?: DiaryDocument & { reactions?: string };
  author: string;
  onClose: () => void;
  /** Keep the rendered entry through BottomSheet exit rather than unmounting the portal. */
  isOpen: boolean;
  onExitComplete?: () => void;
  onSave?: (date: string, content: string, visibility: DiaryDocument['visibility'], emoji: string, photos: string) => Promise<void>;
  onDelete?: (date: string) => Promise<void>;
  friendUserId?: string;
  onReact?: (emoji: string, op: 'add' | 'remove') => Promise<void>;
  onReply?: (content: string) => Promise<void>;
  initialEditing?: boolean;
}

/** Measure the actual insertion line, not the bottom of an auto-sized textarea.
 * The editor's parent is the only vertical scroller; native textarea caret
 * scrolling cannot reveal lines inside an already expanded textarea. */
function keepDiaryCaretVisible(page: HTMLDivElement | null, input: HTMLTextAreaElement | null): void {
  if (!page || !input || document.activeElement !== input || page.clientHeight === 0) return;
  const style = window.getComputedStyle(input);
  const mirror = document.createElement('div');
  mirror.style.position = 'fixed';
  mirror.style.top = '-100000px';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.width = input.getBoundingClientRect().width + 'px';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  for (const property of [
    'box-sizing', 'padding', 'border', 'font', 'letter-spacing',
    'line-height', 'text-align', 'text-indent', 'word-spacing', 'word-break', 'tab-size',
  ]) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  const position = input.selectionDirection === 'backward' ? input.selectionStart : input.selectionEnd;
  mirror.append(document.createTextNode(input.value.slice(0, position)));
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  const lineOffset = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
  mirror.remove();

  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
  const caretTop = input.getBoundingClientRect().top + lineOffset;
  const visible = page.getBoundingClientRect();
  const upper = visible.top + 16;
  const lower = visible.bottom - 20;
  if (caretTop + lineHeight > lower) page.scrollTop += caretTop + lineHeight - lower;
  else if (caretTop < upper) page.scrollTop -= upper - caretTop;
}

/** Read-only for friends; local-first editing for the signed-in owner. */
export const DiaryEntrySheet: React.FC<DiaryEntrySheetProps> = ({
  date, entry, author, onClose, isOpen, onExitComplete,
  onSave, onDelete, friendUserId, onReact, onReply, initialEditing = false,
}) => {
  const { user } = useAuth();
  const diaryPhotoUploadEnabled = useFeatureEnabled('mosaic_disable_diary_photo_upload');
  const diaryEmojiEnabled = useFeatureEnabled('mosaic_disable_diary_emoji_picker');
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const writingPageRef = useRef<HTMLDivElement>(null);
  const caretFrameRef = useRef(0);
  const [photoIds, setPhotoIds] = useState(() => parseDiaryPhotos(entry?.photos));
  const [uploading, setUploading] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reactBusy, setReactBusy] = useState(false);
  const [ownerReactions, setOwnerReactions] = useState<string | null>(null);
  useEffect(() => {
    if (!onSave || !entry?.id) return;
    let current = true;
    void fetchOwnerDiaryReactions(entry.id)
      .then(reactions => { if (current) setOwnerReactions(reactions); })
      .catch(() => { if (current) setOwnerReactions(null); });
    return () => { current = false; };
  }, [onSave, entry?.id]);
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

  // Keep only this owner-writing sheet inside the visible keyboard-reduced viewport.
  // At pinch zoom, leave document geometry alone; without VisualViewport, use 100dvh.
  const [diaryViewportStyle, setDiaryViewportStyle] = useState<React.CSSProperties>();
  useLayoutEffect(() => {
    if (!isOpen || !editing) return;
    const visual = window.visualViewport;
    if (!visual) return;
    let frame = 0;
    const measure = () => {
      const next: React.CSSProperties | undefined = Math.abs(visual.scale - 1) > 0.01
        ? undefined
        : { top: visual.offsetTop, bottom: 'auto', height: visual.height };
      setDiaryViewportStyle(previous =>
        previous?.height === next?.height && previous?.top === next?.top &&
        previous?.bottom === next?.bottom ? previous : next
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    visual.addEventListener('resize', schedule);
    visual.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      visual.removeEventListener('resize', schedule);
      visual.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [isOpen, editing]);

  const scheduleCaretReveal = useCallback(() => {
    cancelAnimationFrame(caretFrameRef.current);
    caretFrameRef.current = requestAnimationFrame(() => {
      keepDiaryCaretVisible(writingPageRef.current, editorRef.current);
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(caretFrameRef.current), [scheduleCaretReveal]);

  // Let the diary page scroll as one surface instead of scrolling inside the textarea.
  useLayoutEffect(() => {
    if (!editing || !editorRef.current) return;
    const input = editorRef.current;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
    scheduleCaretReveal();
  }, [body, editing, scheduleCaretReveal]);
  useEffect(() => {
    if (!editing) return;
    const resize = () => {
      const input = editorRef.current;
      if (!input) return;
      input.style.height = 'auto';
      input.style.height = String(input.scrollHeight) + 'px';
      scheduleCaretReveal();
    };
    const visual = window.visualViewport;
    window.addEventListener('resize', resize);
    visual?.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      visual?.removeEventListener('resize', resize);
    };
  }, [editing, scheduleCaretReveal]);
  useLayoutEffect(() => {
    if (editing) scheduleCaretReveal();
  }, [editing, diaryViewportStyle, scheduleCaretReveal]);

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
    if (!isFeatureEnabled('mosaic_disable_diary_photo_upload')) {
      setError('Diary photo uploads are currently unavailable.');
      return;
    }
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
    if (!isFeatureEnabled('mosaic_disable_all_social') || !onReact || !entry || reactBusy) return;
    const op = hasUserReacted(parseReactions(entry.reactions), emoji, user?.$id || '') ? 'remove' : 'add';
    setReactBusy(true); setError('');
    try { await onReact(emoji, op); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not react.'); }
    finally { setReactBusy(false); }
  };
  const sendReply = async () => {
    if (!isFeatureEnabled('mosaic_disable_all_social') || !onReply || !replyText.trim() || busy) return;
    setBusy(true); setError('');
    try { await onReply(replyText.trim()); setReplyOpen(false); setReplyText(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send reply.'); }
    finally { setBusy(false); }
  };
  const dayLabel = format(parseISO(date), 'EEEE, MMMM d, yyyy');
  return (
    <>
      <BottomSheet isOpen={isOpen} onExitComplete={onExitComplete} onClose={close} title="Diary" height={editing ? 'full' : 'auto'}
        isLocked={busy || !!confirm} preventDismiss={busy || !!confirm} contentMode={editing ? 'fixed' : 'scroll'}
        surfaceStyle={editing ? diaryViewportStyle : undefined}>
        <div className={editing ? 'mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-5' : 'px-5 pb-8'} data-testid="diary-entry-sheet">
          <div className="flex shrink-0 items-center justify-between gap-3 py-3">
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
            <div ref={writingPageRef} data-testid="diary-writing-page" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
              {diaryEmojiEnabled && <button type="button" onClick={() => { if (isFeatureEnabled('mosaic_disable_diary_emoji_picker')) setPicker(value => !value); }}
                className="my-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surfaceHighlight text-3xl"
                aria-label="Choose diary emoji">{emoji || '＋'}</button>}
              {diaryEmojiEnabled && picker && (
                <div className="grid grid-cols-8 gap-1 rounded-xl bg-surfaceHighlight p-2" role="group" aria-label="Choose an emoji">
                  <button type="button" aria-label="Clear emoji" onClick={() => {setEmoji(''); setPicker(false);}}>✕</button>
                  {CHOICES.map(choice => <button type="button" key={choice} className="rounded p-1 text-2xl"
                    aria-label={`Use ${choice} emoji`} onClick={() => {setEmoji(choice); setPicker(false);}}>{choice}</button>)}
                </div>
              )}
              <div className="my-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-400">Visibility</span>
                <MosaicSelect
                  label="Diary visibility"
                  value={visibility}
                  onChange={value => setVisibility(value as DiaryDocument['visibility'])}
                  options={[
                    { value: 'private', label: 'Private' },
                    { value: 'followers', label: 'Friends' },
                    { value: 'public', label: 'Public' },
                  ]}
                />
              </div>
              {diaryPhotoUploadEnabled && <><input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                aria-label="Choose diary photos" onChange={e => void uploadPhotos(e.target.files)}/>
              <button type="button" disabled={busy || uploading || photoIds.length >= 5} onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg p-2 text-sm text-gray-300 disabled:opacity-40">
                <ImagePlus size={19}/> {uploading ? 'Uploading…' : `Add photos (${photoIds.length}/5)`}
              </button></>}
              <DiaryPhotoGallery date={date} photoIds={photoIds} editable onChange={setPhotoIds}/>
              <textarea ref={editorRef} aria-label="Diary text" value={body} onChange={e => setBody(e.target.value)}
                onFocus={scheduleCaretReveal} onSelect={scheduleCaretReveal} onClick={scheduleCaretReveal}
                onKeyUp={scheduleCaretReveal} onCompositionEnd={scheduleCaretReveal}
                placeholder="How was your day?"
                className="min-h-[55dvh] w-full grow shrink-0 resize-none overflow-hidden bg-transparent px-1 py-3 text-base leading-relaxed text-white outline-offset-2"
                autoFocus />
            </div>
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
                  onToggle={socialEnabled ? emoji => void toggleReaction(emoji) : undefined} />
                {socialEnabled && <div className="flex gap-3">
                  <button type="button" disabled={reactBusy} onClick={() => setReactionsOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm"><SmilePlus size={16}/> React</button>
                  {onReply && <button type="button" onClick={() => setReplyOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-surfaceHighlight px-3 py-2 text-sm"><MessageSquare size={16}/> Reply</button>}
                </div>}
              </div>}
            </>
          )}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        </div>
      </BottomSheet>
      <EmojiPickerSheet isOpen={isOpen && socialEnabled && reactionsOpen} onClose={() => setReactionsOpen(false)}
        onPick={emoji => void toggleReaction(emoji)} />
      <BottomSheet isOpen={isOpen && socialEnabled && replyOpen} onClose={() => setReplyOpen(false)} title={`Reply to ${author}`} height="auto">
        <div className="px-4 pb-8 pt-3">
          <p className="mb-3 text-sm text-gray-400">Reply privately about the diary from {date}.</p>
          <textarea aria-label="Diary reply" value={replyText} onChange={e => setReplyText(e.target.value)}
            placeholder="Write a private reply…" className="min-h-28 w-full resize-none rounded-xl bg-surfaceHighlight p-3 text-white" />
          <button type="button" disabled={busy || !replyText.trim()} onClick={() => void sendReply()}
            className="mt-3 w-full rounded-lg bg-surfaceHighlight py-3 font-semibold disabled:opacity-40">Send reply</button>
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
