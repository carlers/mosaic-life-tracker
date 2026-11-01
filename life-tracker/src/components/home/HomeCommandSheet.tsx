import React, { useMemo, useRef, useState } from 'react';
import { CalendarDays, Mic, MicOff, Sparkles } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { MosaicSelect } from '../ui/MosaicSelect';
import type { CategoryDocument } from '../../db/schema';
import { parseTaskCommandPreview, isValidCommandDate } from '../../lib/taskCommands';
import { ADD_TASKS_TO_TOP_SETTING_KEY } from '../../lib/preferences';
import { useSettings } from '../../hooks/useSettings';
import { useBrowserSpeechInput, BRAVE_SPEECH_GUIDANCE } from '../../hooks/useBrowserSpeechInput';

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
  isLoading: boolean;
  onCreate: (task: TaskDraft, position: 'top' | 'bottom') => Promise<void>;
};
type Review = TaskDraft & { unscheduled: boolean; ownerId: string };
const NEW_CATEGORY = '__command_create_category__';
const fieldClass = 'w-full min-w-0 rounded-xl border border-[#414141] bg-[#202020] px-3 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';
function localDate(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')].join('-');
}

export const HomeCommandSheet: React.FC<Props> = ({
  isOpen, onClose, ownerId, categories, isLoading, onCreate,
}) => {
  const [input, setInput] = useState('');
  const [reviewState, setReviewState] = useState<Review | null>(null);
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
    setMessage('Transcript captured. Review the words before creating anything.');
  });
  const dismiss = () => {
    if (pendingRef.current) return;
    voice.stop();
    onClose();
  };
  const reviewCommand = () => {
    voice.stop();
    if (isLoading || !ownerId) {
      setMessage('Your categories are still loading.');
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
      <div className="space-y-4 p-4 pb-10 text-white" data-testid="home-command-sheet">
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#1B1B1B] p-3">
          <Sparkles size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-400"/>
          <p className="text-sm text-gray-300">
            Type or dictate one task. Nothing is saved until you confirm.
          </p>
        </div>
        <div>
          <label htmlFor="command-input" className="mb-2 block text-sm font-medium">Command</label>
          <textarea id="command-input" value={input} rows={3} maxLength={1024}
            placeholder="Add do physics to School"
            className={fieldClass}
            onChange={e => { setInput(e.target.value); setReviewState(null); setMessage(''); }} />
          <p className="mt-1.5 text-xs text-gray-400">
            Dates are optional. Example: Add buy milk to Errands tomorrow.
          </p>
        </div>
        {voice.available ? (
          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            <label className="flex items-start gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={consent} className="mt-0.5"
                onChange={e => {
                  setConsent(e.target.checked);
                  if (!e.target.checked) voice.stop();
                }} />
              Allow browser speech recognition. Audio may be sent to your browser provider;
              voice input may not work offline.
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
        {!review ? (
          <button type="button" disabled={!input.trim() || working || isLoading || !ownerId}
            onClick={reviewCommand}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
            Review command
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-white/10 bg-[#191919] p-3">
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
        )}
        {message && <p role="status" className="text-sm text-gray-300">{message}</p>}
      </div>
    </BottomSheet>
  );
};
