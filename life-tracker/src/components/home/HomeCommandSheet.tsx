import React, { useMemo, useRef, useState } from 'react';
import { CalendarDays, Mic, MicOff, Sparkles, ChevronDown, Copy } from 'lucide-react';
import { CommandInfo } from './CommandInfo';
import { BottomSheet } from '../ui/BottomSheet';
import { MosaicSelect } from '../ui/MosaicSelect';
import type { CategoryDocument, TaskDocument } from '../../db/schema';
import { previewBulkMoveCommand, type BulkMoveDraft } from '../../lib/taskBulkCommandPreview';
import { previewBulkMutationCommand, type MutationDraft } from '../../lib/taskBulkMutations';
import { previewTaskClipboardCommand, formatTasksForClipboard, type ClipboardDraft } from '../../lib/taskBulkClipboard';
import { useBulkCommandMoves, type BulkMoveReceipt,
  type BulkMutationReceipt } from '../../hooks/useBulkCommandMoves';
import { parseTaskCommandPreview, isValidCommandDate } from '../../lib/taskCommands';
import { ADD_TASKS_TO_TOP_SETTING_KEY } from '../../lib/preferences';
import { useSettings } from '../../hooks/useSettings';
import { useBrowserSpeechInput, BRAVE_SPEECH_GUIDANCE } from '../../hooks/useBrowserSpeechInput';
import { useLocalWhisperInput } from '../../hooks/useLocalWhisperInput';
import { useLocalIntent } from '../../hooks/useLocalIntent';

type TaskDraft = {
  title: string;
  categoryId: string;
  date: string;
  newCategoryName?: string;
};
type Props = {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string | null;
  categories: CategoryDocument[];
  tasks?: TaskDocument[];
  isLoading: boolean;
  onCreate: (task: TaskDraft, position: 'top' | 'bottom') => Promise<void>;
  onBulkMove?: (draft: BulkMoveDraft, selectedIds: string[], options: {
    cancelled: () => boolean; onProgress: (done: number, total: number) => void;
  }) => Promise<BulkMoveReceipt>;
  onBulkRecent?: () => BulkMoveReceipt | null;
  onBulkUndo?: (receipt: BulkMoveReceipt) => Promise<{ applied: unknown[];
    conflicts: string[]; failures: string[]; cancelled: boolean }>;
};
type Review = TaskDraft & { unscheduled: boolean; ownerId: string };
const NEW_CATEGORY = '__command_create_category__';
const fieldClass = 'w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-accent';
function localDate(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')].join('-');
}

export const HomeCommandSheet: React.FC<Props> = ({
  isOpen, onClose, ownerId, categories, tasks = [], isLoading, onCreate,
  onBulkMove, onBulkUndo, onBulkRecent,
}) => {
  // The command sheet is lazy-loaded; keep bulk write adapters out of Home startup.
  const builtinBulk = useBulkCommandMoves();
  const executeMove = onBulkMove ?? builtinBulk.runMove;
  const undoMove = onBulkUndo ?? builtinBulk.undoMove;
  const recentMove = onBulkRecent ?? builtinBulk.readRecent;
  const [input, setInput] = useState('');
  const [reviewState, setReviewState] = useState<Review | null>(null);
  const [bulkPreview, setBulkPreview] = useState<BulkMoveDraft | null>(null);
  const [mutationPreview, setMutationPreview] = useState<MutationDraft | null>(null);
  const [clipboardPreview, setClipboardPreview] = useState<ClipboardDraft | null>(null);
  const [voiceExpanded, setVoiceExpanded] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState('');
  const [bulkProgress, setBulkProgress] = useState('');
  const [bulkReceipt, setBulkReceipt] = useState<BulkMoveReceipt | null>(() => {
    const receipt = recentMove();
    return receipt && receipt.ownerId === ownerId && receipt.expiresAt > Date.now() &&
      receipt.outcome.applied.length ? receipt : null;
  });
  const [mutationReceipt, setMutationReceipt] = useState<BulkMutationReceipt | null>(() => {
    const receipt = builtinBulk.readRecentMutation();
    return receipt && receipt.ownerId === ownerId && receipt.expiresAt > Date.now() &&
      receipt.outcome.applied.length ? receipt : null;
  });
  const bulkCancel = useRef(false);
  const review = reviewState?.ownerId === ownerId ? reviewState : null;
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [consent, setConsent] = useState(false);
  const pendingRef = useRef(false);
  const { getSetting } = useSettings();
  const ownedCategories = useMemo(() =>
    categories.filter(c => !c.isDeleted && ownerId && c.userId === ownerId),
    [categories, ownerId]
  );
  const voice = useBrowserSpeechInput(transcript => {
    setInput(transcript);
    setReviewState(null);
    setBulkPreview(null);
    setMutationPreview(null);
    setClipboardPreview(null);
    setMessage('Transcript captured. Review the words before creating anything.');
  });
  const localVoice = useLocalWhisperInput(transcript => {
    setInput(transcript);
    setReviewState(null);
    setBulkPreview(null);
    setMutationPreview(null);
    setClipboardPreview(null);
    setMessage('Local transcript captured. Review before creating a task.');
  });
  const intent = useLocalIntent();
  const [intentConsent, setIntentConsent] = useState(false);
  const [localConsent, setLocalConsent] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<'en' | 'multi'>('en');
  const dismiss = () => {
    if (pendingRef.current) return;
    voice.stop();
    localVoice.cancel();
    intent.stop();
    onClose();
  };
  const reviewCommand = () => {
    voice.stop();
    if (localVoice.stage === 'recording' || localVoice.stage === 'transcribing') {
      setMessage('Finish local transcription or cancel recording before reviewing.');
      return;
    }
    if (isLoading || !ownerId) {
      setMessage('Your categories are still loading.');
      return;
    }
    const copy = previewTaskClipboardCommand(input, ownerId, ownedCategories, tasks);
    setClipboardPreview(copy);
    if (copy) {
      setReviewState(null);
      setBulkPreview(null);
      setMutationPreview(null);
      setMessage(copy.status === 'preview'
        ? 'Review the matching tasks before copying them outside Mosaic.' : copy.reason);
      return;
    }
    const mutation = previewBulkMutationCommand(input, ownerId, ownedCategories, tasks);
    setMutationPreview(mutation);
    setDeleteConfirmed(false);
    if (mutation) {
      setReviewState(null);
      setBulkPreview(null);
      setMutationReceipt(null);
      setBulkConfirm('');
      setBulkProgress('');
      setSelectedTaskIds(mutation.status === 'preview' && mutation.matches.length <= 20 ?
        mutation.matches.filter(t => !mutation.noOps.some(n => n.id === t.id))
          .map(t => t.id) : []);
      setMessage(mutation.status === 'preview' ?
        'Check every selected task and confirm the operation explicitly.' : mutation.reason);
      return;
    }
    setClipboardPreview(null);
    const bulk = previewBulkMoveCommand(input, ownerId, ownedCategories, tasks);
    setBulkPreview(bulk);
    setMutationPreview(null);
    setBulkConfirm('');
    setBulkReceipt(null);
    setBulkProgress('');
    setSelectedTaskIds(bulk?.status === 'preview' && bulk.matches.length <= 20 ?
      bulk.matches.filter(t => !bulk.noOps.some(n => n.id === t.id)).map(t => t.id) : []);
    if (bulk) {
      setReviewState(null);
      setMessage(bulk.status === 'preview' ?
        'Review the exact selected tasks. To execute, be online and complete Sync Now first.' : bulk.reason);
      return;
    }
    const parsed = parseTaskCommandPreview(input, ownedCategories.map(c => c.name));
    if (parsed.status === 'unsupported') {
      setReviewState(null);
      setMessage('This command is not supported yet. Only single-task creation is available.');
      return;
    }
    const matched = parsed.category
      ? ownedCategories.filter(c => c.name.toLocaleLowerCase() === parsed.category?.toLocaleLowerCase())
      : [];
    const categoryId = matched.length === 1 ? matched[0].id : matched.length > 1 ? '' : parsed.category ? NEW_CATEGORY : '';
    const newCategoryName = categoryId === NEW_CATEGORY ? parsed.category ?? '' : '';
    setReviewState({
      ownerId, title: parsed.title ?? '', categoryId, newCategoryName,
      date: parsed.date ?? '', unscheduled: parsed.date === '',
    });
    setMessage(parsed.title || parsed.category || parsed.date !== null
      ? 'Review the extracted fields. Missing details must be selected before saving.'
      : 'Could not reliably interpret the command. Enter the details manually.');
  };
  const executeBulk = async () => {
    if (bulkPreview?.status !== 'preview' || !executeMove || pendingRef.current ||
        !ownerId || bulkPreview.ownerId !== ownerId || !selectedTaskIds.length ||
        bulkConfirm !== 'MOVE ' + selectedTaskIds.length) return;
    pendingRef.current = true;
    bulkCancel.current = false;
    setWorking(true);
    setBulkProgress('Verifying current owner and task state…');
    try {
      const receipt = await executeMove(bulkPreview, selectedTaskIds, {
        cancelled: () => bulkCancel.current,
        onProgress: (done, total) => setBulkProgress(done + ' / ' + total + ' processed'),
      });
      setBulkReceipt(receipt);
      setBulkPreview(null);
      setSelectedTaskIds([]);
      setBulkConfirm('');
      const result = receipt.outcome;
      setBulkProgress(result.applied.length + ' moved, ' +
        result.conflicts.length + ' conflicted, ' + result.failures.length +
        ' failed, ' + result.noOps.length + ' skipped' +
        (result.cancelled ? ' (cancelled)' : ''));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bulk move failed. Review and retry.');
    } finally {
      pendingRef.current = false;
      setWorking(false);
    }
  };
  const undoBulk = async () => {
    if (!bulkReceipt || !undoMove || pendingRef.current || !ownerId ||
        bulkReceipt.ownerId !== ownerId) return;
    pendingRef.current = true;
    setWorking(true);
    try {
      const result = await undoMove(bulkReceipt);
      setBulkProgress('Undo: ' + result.applied.length + ' restored, ' +
        result.conflicts.length + ' conflicted, ' + result.failures.length + ' failed.');
      setBulkReceipt(recentMove());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to undo.');
    } finally { pendingRef.current = false; setWorking(false); }
  };
  const executeExtraBulk = async () => {
    if (mutationPreview?.status !== 'preview' || pendingRef.current || !ownerId ||
        mutationPreview.ownerId !== ownerId || !selectedTaskIds.length) return;
    const required = mutationPreview.kind.toUpperCase() + ' ' + selectedTaskIds.length;
    if (bulkConfirm !== required || (mutationPreview.kind === 'delete' && !deleteConfirmed))
      return;
    pendingRef.current = true;
    bulkCancel.current = false;
    setWorking(true);
    setBulkProgress('Verifying current tasks and ownership…');
    try {
      const receipt = await builtinBulk.runMutation(mutationPreview, selectedTaskIds, {
        cancelled: () => bulkCancel.current,
        onProgress: (done, total) =>
          setBulkProgress(done + ' / ' + total + ' tasks processed'),
      });
      setMutationReceipt(receipt);
      setMutationPreview(null);
      setSelectedTaskIds([]);
      setBulkConfirm('');
      setDeleteConfirmed(false);
      const result = receipt.outcome;
      setBulkProgress(result.applied.length + ' changed, ' +
        result.conflicts.length + ' conflicted, ' + result.failures.length +
        ' failed, ' + result.noOps.length + ' skipped' +
        (result.cancelled ? ' (cancelled)' : ''));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed. Review again.');
    } finally {pendingRef.current = false;setWorking(false);}
  };
  const undoExtraBulk = async () => {
    if (!mutationReceipt || pendingRef.current || mutationReceipt.ownerId !== ownerId) return;
    pendingRef.current = true;setWorking(true);
    try {
      const result = await builtinBulk.undoMutationReceipt(mutationReceipt);
      setBulkProgress('Undo: ' + result.applied.length + ' restored, ' +
        result.conflicts.length + ' conflicted, ' + result.failures.length + ' failed.');
      setMutationReceipt(builtinBulk.readRecentMutation());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Undo failed.');
    } finally {pendingRef.current = false;setWorking(false);}
  };
  const copyTasks = async () => {
    if (clipboardPreview?.status !== 'preview' || !ownerId ||
        clipboardPreview.ownerId !== ownerId || working || pendingRef.current ||
        !clipboardPreview.matches.length) return;
    const snapshot = clipboardPreview.matches;
    const scope = clipboardPreview.selection;
    const current = tasks.filter(t => t.userId === ownerId && !t.isDeleted &&
      (!scope.category || t.categoryId === scope.category.id) &&
      (scope.completionFilter === null || t.completed === scope.completionFilter) &&
      (!scope.dateWindow || (t.date >= scope.dateWindow.start && t.date < scope.dateWindow.end)));
    if (snapshot.length !== current.length || snapshot.some(t =>
      !current.some(row => row.id === t.id && row.updatedAt === t.updatedAt))) {
      setMessage('Tasks changed. Review the command again.');
      setClipboardPreview(null);
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setMessage('Clipboard is unavailable in this browser or permission context.');
      return;
    }
    try {
      await navigator.clipboard.writeText(formatTasksForClipboard(clipboardPreview, ownerId));
      setMessage(`Copied ${snapshot.length} tasks to the system clipboard.`);
      setClipboardPreview(null);
    } catch { setMessage('Clipboard permission denied. Nothing was copied.'); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!review || pendingRef.current || isLoading || !ownerId) return;
    const title = review.title.trim();
    const createNew = review.categoryId === NEW_CATEGORY;
    const name = review.newCategoryName?.trim() ?? '';
    const cat = ownedCategories.find(c => c.id === review.categoryId);
    const date = review.unscheduled ? '' : review.date;
    if (!title || title.length > 255 ||
      (!cat && !createNew) ||
      (createNew && (!name || name.length > 80 ||
        !/^[\p{L}\p{N}][\p{L}\p{N} _&+.'()-]*$/u.test(name))) ||
      (!review.unscheduled && !isValidCommandDate(date))) {
      setMessage('Enter a title, category, and valid date, or explicitly choose Backlogs.');
      return;
    }
    // Owner-specific ID must be stable from review through the submit callback.
    pendingRef.current = true;
    setWorking(true);
    setMessage('');
    try {
      await onCreate({
        title, categoryId: createNew ? '' : review.categoryId, date,
        ...(createNew ? { newCategoryName: name } : {}),
      }, getSetting(ADD_TASKS_TO_TOP_SETTING_KEY, false) === true ? 'top' : 'bottom');
      setInput('');
      setReviewState(null);
      voice.stop();
      localVoice.cancel();
      intent.stop();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message :
        'Task creation failed. Check existing tasks before retrying.');
    } finally {
      pendingRef.current = false;
      setWorking(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={dismiss} title="Task command"
      ariaLabel="Create task from a command" preventDismiss={working}>
      <div className="space-y-3 p-4 pb-8 text-white" data-testid="home-command-sheet">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label htmlFor="command-input" className="text-sm font-semibold text-white">Command</label>
            <CommandInfo label="Command examples">
              <p className="mb-1 font-semibold">Examples</p>
              <p>Add homework to School tomorrow</p>
              <p>Move all my School tasks to tomorrow</p>
              <p>Move all my tasks from last week to next Monday</p>
              <p>Delete all my Family tasks today</p>
              <p>Copy all my tasks today to clipboard</p>
              <p className="mt-2">Nothing changes until you review and confirm.</p>
            </CommandInfo>
          </div>
          <textarea id="command-input" value={input} rows={2} maxLength={1024}
            placeholder="Type a task or bulk command…"
            className={fieldClass}
            onChange={event => {
              setInput(event.target.value);
              setReviewState(null); setBulkPreview(null);
              setMutationPreview(null); setClipboardPreview(null); setMessage('');
            }} />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-expanded={voiceExpanded}
            onClick={() => {
              if (voiceExpanded) {
                voice.stop(); localVoice.cancel();
                setConsent(false); setLocalConsent(false);
              }
              setVoiceExpanded(!voiceExpanded);
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-gray-300 focus-visible:ring-2 focus-visible:ring-accent">
            <Mic size={16} aria-hidden="true" /> Voice
            <ChevronDown size={14} aria-hidden="true" className={voiceExpanded ? 'rotate-180' : ''}/>
          </button>
          <button type="button" aria-expanded={aiExpanded}
            onClick={() => {
              if (aiExpanded) { intent.stop(); setIntentConsent(false); }
              setAiExpanded(!aiExpanded);
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-gray-300 focus-visible:ring-2 focus-visible:ring-accent">
            <Sparkles size={16} aria-hidden="true" /> Local AI
            <ChevronDown size={14} aria-hidden="true" className={aiExpanded ? 'rotate-180' : ''}/>
          </button>
        </div>
        {voiceExpanded && (
          <div className="space-y-3">
        {voice.available ? (
          <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              Browser speech
              <CommandInfo label="Browser speech privacy">
                Audio may be sent to your browser's speech provider and may need internet.
                On Brave, this speech API may be unavailable.
              </CommandInfo>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={consent} className="mt-0.5"
                onChange={e => {
                  setConsent(e.target.checked);
                  if (!e.target.checked) voice.stop();
                }} />
              Allow browser speech recognition (may use cloud processing)
            </label>
            <button type="button" disabled={!consent || working}
              onClick={() => voice.listening ? voice.stop() : voice.start()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40">
              {voice.listening ? <MicOff size={17}/> : <Mic size={17}/>}
              {voice.listening ? 'Stop listening' : 'Speak command'}
            </button>
            {voice.isBrave && !voice.error && (
              <p role="note" className="text-xs text-amber-300">
                {BRAVE_SPEECH_GUIDANCE}
              </p>
            )}
            {voice.error && <p role="alert" className="text-xs text-amber-300">{voice.error}</p>}
            {voice.listening && <p role="status" className="text-xs text-emerald-300">Listening…</p>}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Voice input is unavailable in this browser. Typed commands still work.</p>
        )}
            <details className="rounded-xl border border-border bg-surface"
              onToggle={event => {
                if (!event.currentTarget.open && (localVoice.stage === 'recording' ||
                    localVoice.stage === 'loading' || localVoice.stage === 'transcribing')) {
                  localVoice.cancel(); setLocalConsent(false);
                }
              }}>
              <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                On-device Whisper · download details
                <ChevronDown size={14} className="float-right" aria-hidden="true"/>
              </summary>
              <div className="border-t border-border p-2">
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            Local Whisper <span className="ml-auto text-xs font-normal text-gray-400">q8 · ~41–70 MB weights</span>
            <CommandInfo label="On-device speech">
              Downloaded on demand; model file bytes appear during download. A shared ~27 MB
              ONNX runtime is also used. Microphone audio stays on your device.
              Accuracy varies by language and device.
            </CommandInfo>
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-300">
            <input type="checkbox" className="mt-0.5" checked={localConsent}
              onChange={event => {
                setLocalConsent(event.target.checked);
                if (!event.target.checked) localVoice.cancel();
              }} />
            Enable optional local model download and microphone recording
          </label>
          <MosaicSelect label="Local voice language" value={voiceLanguage}
            options={[{value:'en',label:'English'}, {value:'multi',label:'Multilingual / Filipino'}]}
            onChange={value => {
              localVoice.cancel();
              setVoiceLanguage(value === 'multi' ? 'multi' : 'en');
            }} />
          <div className="flex flex-wrap gap-2">
            {localVoice.stage === 'idle' || localVoice.stage === 'error' ? (
              <button type="button" disabled={!localConsent || working || localVoice.deleting}
                onClick={() => localVoice.prepare(voiceLanguage)}
                className="rounded-lg border border-emerald-500/50 px-3 py-2 text-sm disabled:opacity-40">
                Prepare local voice
              </button>
            ) : null}
            {localVoice.stage === 'ready' ? (
              <button type="button" disabled={!localConsent || working || localVoice.deleting}
                onClick={() => {voice.stop(); void localVoice.record();}}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-40">
                <Mic size={16}/> Record locally
              </button>
            ) : null}
            {localVoice.stage === 'recording' ? (
              <button type="button" onClick={() => void localVoice.stop()}
                className="rounded-lg border border-white/30 px-3 py-2 text-sm">
                Stop and transcribe
              </button>
            ) : null}
            {localVoice.stage !== 'idle' && (
              <button type="button" disabled={working} onClick={localVoice.cancel}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40">
                Cancel local voice
              </button>
            )}
            <button type="button" disabled={working || localVoice.deleting}
              onClick={() => void localVoice.deleteDownloadedModel()}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40">
              {localVoice.deleting ? 'Deleting Whisper…' : 'Delete downloaded Whisper models'}
            </button>
          </div>

          {localVoice.notice && <p role="status" className="text-xs text-emerald-200">{localVoice.notice}</p>}
        </div>
              </div>
            </details>
          </div>
        )}
        {aiExpanded && (
        <section className="space-y-2 rounded-xl border border-border bg-surface p-3"
          aria-label="Optional local AI model">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">Local AI suggestions</p>
            <span className="ml-auto text-xs text-gray-400">Qwen q4f16 · ~570 MB</span>
            <CommandInfo label="Local AI model">
              Requires WebGPU. Model weights are approximately 570 MB, plus tokenizer and runtime files.
              Exact transferred bytes appear during download. Suggestions never execute commands.
            </CommandInfo>
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={intentConsent}
              onChange={e=>{setIntentConsent(e.target.checked);
                if(!e.target.checked)intent.stop();}}/>
            Enable optional local AI model
          </label>
          <div className="flex flex-wrap gap-2">
            {(intent.stage==='idle'||intent.stage==='error')&&
              <button type="button" onClick={intent.prepare}
                disabled={!intentConsent||working||intent.deleting}
                className="rounded-lg border border-white/30 px-3 py-2 text-sm disabled:opacity-40">
                Prepare AI</button>}
            {intent.stage==='ready'&&
              <button type="button" onClick={()=>intent.suggest(input)}
                disabled={!input.trim()||working}
                className="rounded-lg border border-white/30 px-3 py-2 text-sm disabled:opacity-40">
                Suggest command</button>}
            {(intent.stage==='loading'||intent.stage==='working')&&
              <button type="button" onClick={intent.stop}
                className="rounded-lg border border-white/30 px-3 py-2 text-sm">
                Cancel AI</button>}
            <button type="button" disabled={intent.deleting||working}
              onClick={()=>void intent.deleteDownloadedModel()}
              className="rounded-lg border border-white/30 px-3 py-2 text-sm disabled:opacity-40">
              {intent.deleting?'Deleting AI model…':'Delete downloaded AI model'}</button>
          </div>
          {intent.suggestion&&<div className="space-y-2">
            <p className="text-xs text-gray-300">Suggestion: {intent.suggestion}</p>
            <button type="button" onClick={()=>{setInput(intent.suggestion);
              setReviewState(null);setBulkPreview(null);setMutationPreview(null);setClipboardPreview(null);setMessage(
                'Review this suggestion before saving.');}}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-sm">
              Use suggestion</button></div>}
          {intent.message&&<p role="status" className="text-xs text-gray-300">
            {intent.message}</p>}
        </section>
        )}
        {bulkPreview?.status === 'preview' && (
          <section aria-label="Bulk move preview" className="space-y-2 rounded-xl border border-white/20 p-3">
            <p className="text-sm font-semibold">Bulk move — review and confirm</p>
            <p className="text-sm text-gray-300">
              {bulkPreview.sourceCategory.name} → {bulkPreview.destination.type === 'backlogs' ?
                'Backlogs (unscheduled)' : bulkPreview.destination.category.name}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{bulkPreview.matches.length} matches · {bulkPreview.noOps.length} unchanged</span>
              <CommandInfo label="Bulk move safeguards">
                Sync first. Each write checks account, category and task version;
                changed tasks on other devices are not overwritten.
              </CommandInfo>
            </div>
            <ul className="max-h-52 space-y-1 overflow-y-auto text-xs text-gray-300">
              {bulkPreview.matches.slice(0, 100).map(t => {
                const unchanged = bulkPreview.noOps.some(n => n.id === t.id);
                return <li key={t.id} className="rounded-md border border-white/10 p-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" disabled={unchanged || working}
                      checked={selectedTaskIds.includes(t.id)}
                      onChange={event => {
                        setBulkConfirm('');
                        setSelectedTaskIds(prev => event.target.checked ?
                          prev.length >= 20 ? prev : [...prev, t.id] :
                          prev.filter(id => id !== t.id));
                      }}/>
                    <span>{t.title} · {t.date || 'Backlogs'} ·
                      {t.completed ? 'Completed' : 'Uncompleted'}
                      {unchanged ? ' · No change' : ''}</span>
                  </label>
                </li>;
              })}
            </ul>
            {bulkPreview.matches.length > 100 && <p className="text-xs text-amber-200">
              Showing 100 of {bulkPreview.matches.length} matches. Filter further before moving.
            </p>}
            <p className="text-xs text-gray-400">
              {selectedTaskIds.length} selected · maximum 20. Backlogs moves become private.
            </p>
            {<label className="block space-y-1 text-xs">
              <span>Type MOVE {selectedTaskIds.length} to confirm the selected tasks</span>
              <input className={fieldClass} value={bulkConfirm} maxLength={20}
                disabled={working}
                onChange={event => setBulkConfirm(event.target.value)}
                aria-label="Confirm bulk move"/>
            </label>}
            {<button type="button" onClick={() => void executeBulk()}
              disabled={working || !selectedTaskIds.length || bulkConfirm !==
                'MOVE ' + selectedTaskIds.length}
              className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-sm disabled:opacity-40">
              Move {selectedTaskIds.length} selected tasks
            </button>}
          </section>
        )}
        {mutationPreview?.status === 'preview' && (
          <section aria-label="Bulk task action review"
            className="space-y-2 rounded-xl border border-white/20 p-3">
            <p className="text-sm font-semibold">
              {mutationPreview.kind === 'complete' ? 'Complete' :
                mutationPreview.kind === 'reschedule' ? 'Reschedule' : 'Soft-delete'} tasks
            </p>
            <p className="text-xs text-gray-300">
              Category: {mutationPreview.category?.name ?? 'All categories'} ·
              {mutationPreview.matches.length} matching tasks
              {mutationPreview.dateWindow ? ' · ' + mutationPreview.dateWindow.label : ''}
              {mutationPreview.targetDate ? ' · New date: ' + mutationPreview.targetDate : ''}
            </p>
            <CommandInfo label="Bulk action safeguards">
              A recent successful Sync Now is required. Each task write checks owner and
              saved version, rejecting stale or foreign edits.
            </CommandInfo>
            <ul className="max-h-52 space-y-1 overflow-y-auto text-xs text-gray-300">
              {mutationPreview.matches.slice(0, 100).map(t => {
                const noOp = mutationPreview.noOps.some(n => n.id === t.id);
                return <li key={t.id} className="rounded-md border border-white/10 p-2">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" disabled={working || noOp}
                      checked={selectedTaskIds.includes(t.id)}
                      onChange={event => {
                        setBulkConfirm('');setDeleteConfirmed(false);
                        setSelectedTaskIds(prev => event.target.checked ?
                          prev.length >= 20 ? prev : [...prev, t.id] :
                          prev.filter(id => id !== t.id));
                      }}/>
                    <span>{t.title} · {t.date || 'Backlogs'} ·
                      {t.completed ? 'Completed' : 'Uncompleted'}
                      {noOp ? ' · No change' : ''}</span>
                  </label>
                </li>;
              })}
            </ul>
            {mutationPreview.matches.length > 100 && <p className="text-xs text-amber-300">
              Only the first 100 local matches are shown. Refine the command before acting.
            </p>}
            <p className="text-xs text-gray-300">{selectedTaskIds.length} selected,
              maximum 20 per confirmation.</p>
            {mutationPreview.kind === 'delete' && <>
              <div className="flex items-center gap-2 text-xs text-amber-300">
                Soft-delete · limited undo
                <CommandInfo label="Soft-delete">
                  Selected tasks disappear on synced devices. Undo is time-limited
                  and may fail after another edit.
                </CommandInfo>
              </div>
              <label className="flex gap-2 text-xs">
                <input type="checkbox" disabled={working} checked={deleteConfirmed}
                  onChange={event => setDeleteConfirmed(event.target.checked)}/>
                Confirm that I want to soft-delete these selected tasks
              </label>
            </>}
            <label className="block space-y-1 text-xs">
              <span>Type {mutationPreview.kind.toUpperCase()} {selectedTaskIds.length}
                to confirm</span>
              <input className={fieldClass} value={bulkConfirm} maxLength={30}
                disabled={working} onChange={event => setBulkConfirm(event.target.value)}
                aria-label="Confirm bulk task action"/>
            </label>
            <button type="button" onClick={() => void executeExtraBulk()}
              disabled={working || !selectedTaskIds.length ||
                bulkConfirm !== mutationPreview.kind.toUpperCase()+' '+selectedTaskIds.length ||
                (mutationPreview.kind === 'delete' && !deleteConfirmed)}
              className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-sm disabled:opacity-40">
              Confirm {mutationPreview.kind} for {selectedTaskIds.length} tasks
            </button>
          </section>
        )}
        {clipboardPreview?.status === 'preview' && (
          <section aria-label="Clipboard task review" className="space-y-2 rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Copy {clipboardPreview.matches.length} tasks</p>
              <CommandInfo label="Clipboard privacy">
                Only this explicit Copy action writes to the system clipboard.
                Other apps may access clipboard contents. Mosaic tasks are unchanged.
              </CommandInfo>
            </div>
            <p className="text-xs text-gray-400">
              {clipboardPreview.selection.category?.name ?? 'All categories'}
              {clipboardPreview.selection.dateWindow ? ' · ' + clipboardPreview.selection.dateWindow.label : ''}
            </p>
            <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-gray-300" aria-label="Tasks to copy">
              {clipboardPreview.matches.map(t => (
                <li key={t.id} className="rounded-lg border border-border p-2">
                  {t.title} · {t.date || 'Backlogs'}
                </li>
              ))}
            </ul>
            <button type="button" disabled={working || !clipboardPreview.matches.length}
              onClick={() => void copyTasks()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              <Copy size={16} aria-hidden="true"/> Copy {clipboardPreview.matches.length} tasks
            </button>
          </section>
        )}
        {mutationReceipt && mutationReceipt.ownerId === ownerId && (
          <button type="button" disabled={working} onClick={() => void undoExtraBulk()}
            className="rounded-xl border border-white/30 px-3 py-2 text-sm disabled:opacity-40">
            Undo recent bulk task action
          </button>
        )}
        {bulkReceipt && bulkReceipt.ownerId === ownerId && (
          <button type="button" disabled={working} onClick={() => void undoBulk()}
            className="rounded-xl border border-white/30 px-3 py-2 text-sm disabled:opacity-40">
            Undo recent bulk move
          </button>
        )}
        {working && (bulkPreview?.status === 'preview' ||
          mutationPreview?.status === 'preview') && (
          <button type="button" onClick={() => {bulkCancel.current = true;}}
            className="rounded-xl border border-amber-500/50 px-3 py-2 text-sm">
            Cancel remaining changes
          </button>
        )}
        {bulkProgress && <p role="status" className="text-xs text-gray-300">
          {bulkProgress}
        </p>}
        {!review && !bulkPreview && !mutationPreview && !clipboardPreview ? (
          <button type="button" disabled={!input.trim() || working || isLoading || !ownerId}
            onClick={reviewCommand}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
            Review command
          </button>
        ) : review ? (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-surface p-3">
            <p className="text-sm font-semibold">Review task</p>
            <div>
              <label htmlFor="command-title" className="mb-2 block text-sm font-medium">Task title</label>
              <input id="command-title" className={fieldClass} maxLength={255} value={review.title}
                onChange={e => setReviewState({ ...review, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-medium">Category</span>
              <MosaicSelect id="command-category" label="Category"
                className="w-full" value={review.categoryId}
                placeholder="Choose category" variant="default"
                options={[
                  ...ownedCategories.map(c => ({value:c.id,label:c.name,color:c.color})),
                  {value:NEW_CATEGORY,label:'Create new category…'},
                ]}
                onChange={value => setReviewState({
                  ...review, categoryId:value,
                  newCategoryName: value === NEW_CATEGORY ? review.newCategoryName : '',
                })} />
              {review.categoryId === NEW_CATEGORY && (
                <div className="space-y-1.5 rounded-lg border border-emerald-500/30 p-3">
                  <label htmlFor="command-new-category" className="block text-sm">
                    New category name
                  </label>
                  <input id="command-new-category" maxLength={80}
                    className={fieldClass} value={review.newCategoryName ?? ''}
                    onChange={e => setReviewState({...review,newCategoryName:e.target.value})}/>
                  <p className="text-xs text-gray-400">
                    Created as a private category only after task confirmation.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="command-date" className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays size={16} aria-hidden="true"/> Schedule
              </label>
              <div className="flex flex-wrap gap-2">
                {([{label:'Today',date:localDate(0)}, {label:'Tomorrow',date:localDate(1)},
                  {label:'Backlogs',date:''}] as const).map(item => (
                  <button type="button" key={item.label}
                    aria-pressed={review.unscheduled ? item.label === 'Backlogs' : review.date === item.date}
                    onClick={() => setReviewState({
                      ...review, date:item.date, unscheduled:item.label === 'Backlogs',
                    })}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs aria-pressed:border-emerald-500 aria-pressed:text-emerald-300">
                    {item.label}
                  </button>
                ))}
              </div>
              {!review.unscheduled && (
                <input id="command-date" type="date" className={fieldClass}
                  value={review.date} onChange={e => setReviewState({...review,date:e.target.value})} />
              )}
              {!review.unscheduled && !review.date && (
                <p className="text-xs text-amber-300">Choose a date or Backlogs to continue.</p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" disabled={working}
                onClick={() => {setReviewState(null);setMessage('');}}
                className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm">Edit command</button>
              <button type="submit" disabled={working || isLoading || !ownerId ||
                  (!review.date && !review.unscheduled)}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold disabled:opacity-40">
                {working ? 'Creating…' : 'Create task'}
              </button>
            </div>
          </form>
        ) : null}
        {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
      </div>
    </BottomSheet>
  );
};
