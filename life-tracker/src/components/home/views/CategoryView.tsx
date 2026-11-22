import React, { Suspense, lazy, useLayoutEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, Layers3, Plus, RotateCcw } from 'lucide-react';
import { MosaicSelect } from '../../ui/MosaicSelect';
import { TaskItem } from './TaskItem';
import { CategoryTaskActions, type CategoryTaskActionMode } from './CategoryTaskActions';
import { useTasks } from '../../../hooks/useTasks';
import { useSettings } from '../../../hooks/useSettings';
import { canAddNewTaskToCategory, categoryLifecycleStatus, localTodayDateKey } from '../../../lib/categoryLifecycle';
import {
  CATEGORY_VIEW_FILTER_SETTING_KEY, CATEGORY_VIEW_HEADER_SWIPE_SETTING_KEY,
  CATEGORY_VIEW_LEFT_SWIPE_SETTING_KEY, CATEGORY_VIEW_ORDER_SETTING_KEY,
  CATEGORY_VIEW_RIGHT_SWIPE_SETTING_KEY, CATEGORY_VIEW_SELECTED_SETTING_KEY,
  CATEGORY_VIEW_STICKY_ADD_SETTING_KEY, projectCategoryTasks,
  resolveCategoryFilter, resolveCategoryOrder, resolveCategorySwipe,
  type CategoryDateGroup,
} from '../../../lib/categoryViewPreferences';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

const CategoryManagerSheet = lazy(() =>
  import('../../modals/CategoryManagerSheet').then(m => ({ default: m.CategoryManagerSheet })));
const rememberedScroll = new Map<string, number>();

interface Props {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  userId: string;
}

interface RowProps {
  task: TaskDocument;
  userId: string;
  categoryColor: string;
  open: boolean;
  swipeLeft: 'off' | 'reveal';
  swipeRight: 'off' | 'reveal';
  onOpenRow: (task: TaskDocument) => void;
  onCloseRow: () => void;
  onActions: (task: TaskDocument, mode: CategoryTaskActionMode) => void;
  onDuplicate: (task: TaskDocument) => void;
  onToggle: (task: TaskDocument) => void;
  onEditStart: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument, mode: 'view' | 'edit') => void;
  onViewImage: (task: TaskDocument) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

const CategoryTaskRow: React.FC<RowProps> = ({
  task, userId, categoryColor, open, swipeLeft, swipeRight, onOpenRow, onCloseRow,
  onActions, onDuplicate, onToggle, onEditStart, onOpenMemo, onViewImage,
  isEditing, editValue, onEditChange, onEditSave, onEditCancel,
}) => {
  const gesture = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
  const suppressClick = useRef(false);
  return <div className="relative overflow-hidden rounded-lg"
    data-category-task-row={task.id}
    style={{ touchAction: 'pan-y' }}
    onTouchStartCapture={event => {
      const touch = event.touches[0];
      if (!touch) return;
      gesture.current = { x: touch.clientX, y: touch.clientY, swiped: false };
      suppressClick.current = false;
      // The task row owns horizontal touch gestures, not Home route navigation.
      event.stopPropagation();
    }}
    onTouchMoveCapture={event => {
      const touch = event.touches[0];
      const start = gesture.current;
      if (!touch || !start) return;
      if (Math.abs(touch.clientX - start.x) > 14 &&
        Math.abs(touch.clientX - start.x) > Math.abs(touch.clientY - start.y) * 1.3) {
        start.swiped = true;
        event.stopPropagation();
      }
    }}
    onTouchEndCapture={event => {
      const start = gesture.current;
      const touch = event.changedTouches[0];
      gesture.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 52 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
      suppressClick.current = true;
      if ((dx < 0 && swipeLeft === 'reveal') || (dx > 0 && swipeRight === 'reveal')) onOpenRow(task);
      else onCloseRow();
      window.setTimeout(() => { suppressClick.current = false; }, 350);
      event.stopPropagation();
    }}
    onTouchCancelCapture={() => { gesture.current = null; }}
    onClickCapture={event => {
      if (!suppressClick.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    }}>
    <div className="absolute inset-y-0 right-0 flex items-stretch gap-1 bg-surfaceHighlight"
      aria-hidden={!open}>
      <button type="button" tabIndex={open ? 0 : -1} aria-label={'Change date for ' + task.title}
        className="w-14 text-xs text-white focus-visible:outline" onClick={() => { onActions(task, 'actions'); onCloseRow(); }}>
        Move
      </button>
      <button type="button" tabIndex={open ? 0 : -1} aria-label={'Duplicate ' + task.title}
        className="w-16 text-xs text-white focus-visible:outline" onClick={() => { onDuplicate(task); onCloseRow(); }}>
        Copy
      </button>
      <button type="button" tabIndex={open ? 0 : -1} aria-label={'Delete ' + task.title}
        className="w-14 text-xs text-red-400 focus-visible:outline" onClick={() => { onActions(task, 'confirm-delete'); onCloseRow(); }}>
        Delete
      </button>
    </div>
    <div className="relative bg-surface py-1 transition-transform duration-150"
      style={{ transform: open ? 'translateX(-184px)' : undefined }}>
      <TaskItem task={task} currentUserId={userId} categoryColor={categoryColor}
        onToggle={() => onToggle(task)} onOpenActions={t => onActions(t, 'actions')}
        onOpenMemo={onOpenMemo} onViewImage={onViewImage}
        onEditStart={onEditStart} isEditing={isEditing} editValue={editValue}
        onEditChange={onEditChange} onEditSave={onEditSave} onEditCancel={onEditCancel}
        disableLayoutAnimation />
    </div>
  </div>;
};

function readableDate(key: string): string {
  return format(new Date(key + 'T12:00:00'), 'EEE, MMM d, yyyy');
}

export const CategoryView: React.FC<Props> = ({ tasks, categories, userId }) => {
  const { getSetting, setSetting } = useSettings();
  // Subscription comes from the Home owner; consume only mutation hooks here.
  const { addTask, updateTask, deleteTask, toggleTaskCompletion, removeTaskPhoto, replaceTaskPhoto } = useTasks(false);
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const storedCategory = getSetting(CATEGORY_VIEW_SELECTED_SETTING_KEY, '');
  const selectedId = categoryOverride ?? (typeof storedCategory === 'string' ? storedCategory : '');
  const category = categories.find(item => item.id === selectedId && item.userId === userId) ??
    categories.find(item => item.userId === userId && !item.isDeleted) ?? null;
  const selectedCategoryId = category?.id ?? '';
  const [todayKey, setTodayKey] = useState(localTodayDateKey);
  const [newDate, setNewDate] = useState(localTodayDateKey);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<CategoryTaskActionMode>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pastCount, setPastCount] = useState(18);
  const [upcomingCount, setUpcomingCount] = useState(12);
  const scrollRef = useRef<HTMLElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const upcomingRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headerGesture = useRef<{ x: number; y: number } | null>(null);
  const suppressHeaderClick = useRef(false);
  const order = resolveCategoryOrder(getSetting(CATEGORY_VIEW_ORDER_SETTING_KEY, 'newest'));
  const filter = resolveCategoryFilter(getSetting(CATEGORY_VIEW_FILTER_SETTING_KEY, 'all'));
  const sticky = getSetting(CATEGORY_VIEW_STICKY_ADD_SETTING_KEY, true) !== false;
  const swipeLeft = resolveCategorySwipe(getSetting(CATEGORY_VIEW_LEFT_SWIPE_SETTING_KEY, 'reveal'), 'reveal');
  const swipeRight = resolveCategorySwipe(getSetting(CATEGORY_VIEW_RIGHT_SWIPE_SETTING_KEY, 'off'), 'off');
  const headerSwipe = getSetting(CATEGORY_VIEW_HEADER_SWIPE_SETTING_KEY, false) === true;
  const selectedPosition = categories.findIndex(item => item.id === selectedCategoryId);
  const activeTask = tasks.find(item => item.id === activeTaskId && item.userId === userId && !item.isDeleted) ?? null;
  const activeTaskCategory = categories.find(item => item.id === activeTask?.categoryId) ?? null;
  const groups = projectCategoryTasks(tasks, selectedCategoryId, userId, todayKey, filter, order);
  const creationAllowed = !!category && canAddNewTaskToCategory(category, newDate, todayKey);

  const selectCategory = (id: string) => {
    if (!categories.some(item => item.id === id && item.userId === userId)) return;
    setCategoryOverride(id);
    setOpenSwipeId(null);
    setPastCount(18);
    setUpcomingCount(12);
    void setSetting(CATEGORY_VIEW_SELECTED_SETTING_KEY, id).catch(() => setError('Could not remember category selection'));
  };
  useLayoutEffect(() => {
    const key = userId + ':' + selectedCategoryId;
    if (scrollRef.current) scrollRef.current.scrollTop = rememberedScroll.get(key) ?? 0;
  }, [userId, selectedCategoryId]);
  const goToday = () => {
    setTodayKey(localTodayDateKey());
    todayRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const quickAddOnDate = (date: string) => {
    setNewDate(date);
    inputRef.current?.focus();
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = title.trim();
    if (!value || !category || !creationAllowed || saving) return;
    setSaving(true);
    setError('');
    try {
      const id = await addTask({ title: value, categoryId: category.id, date: newDate, completed: false, visibility: '' });
      if (!id) throw new Error('Task was not saved');
      setTitle('');
      inputRef.current?.focus();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create task'); }
    finally { setSaving(false); }
  };
  const toggle = (task: TaskDocument) => {
    void toggleTaskCompletion(task.id, !task.completed)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not update completion'));
  };
  const editStart = (task: TaskDocument) => { setEditingTaskId(task.id); setEditValue(task.title); };
  const editSave = () => {
    const id = editingTaskId, value = editValue.trim();
    if (!id || !value) { setEditingTaskId(null); return; }
    void updateTask(id, { title: value }).then(() => setEditingTaskId(null))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not edit task'));
  };
  const showActions = (task: TaskDocument, mode: CategoryTaskActionMode) => {
    setActiveTaskId(task.id);
    setActionMode(mode);
    setOpenSwipeId(null);
  };
  const duplicate = (task: TaskDocument) => {
    void addTask({ title: task.title, categoryId: task.categoryId, date: task.date, completed: false,
      memo: task.memo, visibility: task.visibility }).then(() => setError('Task duplicated (photo not copied)'))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not duplicate task'));
  };
  const headerDate = (date: string, text: string, count: number) =>
    <div className="sticky top-0 z-[1] flex items-center justify-between bg-surface/95 px-2 py-2"
      data-category-date={date}>
      <span className="mosaic-general-text text-xs font-semibold uppercase tracking-wide text-gray-400">{text} · {count}</span>
      {date && <button type="button" aria-label={'Add task on ' + text} onClick={() => quickAddOnDate(date)}
        disabled={!category || !canAddNewTaskToCategory(category, date, todayKey)}
        className="mosaic-action-icon rounded-lg p-1.5 text-gray-300 disabled:opacity-30"><Plus size={16}/></button>}
    </div>;
  const renderTasks = (list: TaskDocument[]) => list.map(task =>
    <CategoryTaskRow key={task.id} task={task} userId={userId} categoryColor={category?.color ?? '#6B7280'}
      open={openSwipeId === task.id} swipeLeft={swipeLeft} swipeRight={swipeRight}
      onOpenRow={t => setOpenSwipeId(t.id)} onCloseRow={() => setOpenSwipeId(null)}
      onActions={showActions} onDuplicate={duplicate} onToggle={toggle}
      onEditStart={editStart} onOpenMemo={(t,mode) => showActions(t, mode === 'view' ? 'memo-view' : 'memo-edit')}
      onViewImage={t => showActions(t, 'image-view')}
      isEditing={editingTaskId === task.id} editValue={editValue}
      onEditChange={setEditValue} onEditSave={editSave} onEditCancel={() => setEditingTaskId(null)} />
  );
  const renderGroup = (group: CategoryDateGroup) =>
    <section key={group.date} className="mb-2">
      {headerDate(group.date, readableDate(group.date), group.tasks.length)}
      {renderTasks(group.tasks)}
    </section>;

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="category-view">
    <section ref={scrollRef} className="swiper-no-swiping min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-12"
      aria-label="Category tasks across dates"
      onScroll={event => { if (selectedCategoryId) rememberedScroll.set(userId + ':' + selectedCategoryId, event.currentTarget.scrollTop); }}>
      <div className="flex items-center gap-2 py-3"
        onTouchStartCapture={event => {
          const t = event.touches[0]; if (t) { headerGesture.current = { x: t.clientX, y: t.clientY }; event.stopPropagation(); }
        }}
        onTouchEndCapture={event => {
          const t = event.changedTouches[0], start = headerGesture.current; headerGesture.current = null;
          if (!headerSwipe || !t || !start) return;
          const dx = t.clientX - start.x, dy = t.clientY - start.y;
          if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
          const next = categories[selectedPosition + (dx < 0 ? 1 : -1)];
          suppressHeaderClick.current = true;
          window.setTimeout(() => { suppressHeaderClick.current = false; }, 300);
          if (next) selectCategory(next.id);
          event.stopPropagation();
        }}
        onClickCapture={event => {
          if (suppressHeaderClick.current) {
            event.preventDefault(); event.stopPropagation(); suppressHeaderClick.current = false;
          }
        }}>
        <Layers3 size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
        <MosaicSelect label="Choose category" variant="category" value={selectedCategoryId}
          onChange={selectCategory} placeholder="Choose a category"
          options={categories.filter(item => item.userId === userId && !item.isDeleted).map(item => ({
            value: item.id, label: item.name, color: item.color,
            description: categoryLifecycleStatus(item, todayKey) === 'active'
              ? undefined : categoryLifecycleStatus(item, todayKey) === 'upcoming' ? 'Not started' : 'Ended',
          }))} className="max-w-[min(70vw,22rem)]" />
        <button type="button" onClick={() => setManagerOpen(true)} aria-label="Manage categories"
          className="mosaic-action-icon ml-auto rounded-lg p-2 text-gray-300"><Plus size={16}/></button>
        {headerSwipe && <>
          <button type="button" aria-label="Previous category" disabled={selectedPosition <= 0}
            onClick={() => selectCategory(categories[selectedPosition - 1].id)}
            className="rounded-lg p-1 text-gray-400 disabled:opacity-30"><ChevronLeft size={17}/></button>
          <button type="button" aria-label="Next category" disabled={selectedPosition < 0 || selectedPosition >= categories.length - 1}
            onClick={() => selectCategory(categories[selectedPosition + 1].id)}
            className="rounded-lg p-1 text-gray-400 disabled:opacity-30"><ChevronRight size={17}/></button>
        </>}
      </div>
      {category ? <>
        <form onSubmit={event => { void create(event); }}
          className={'z-10 mb-3 rounded-xl border border-[#444444] bg-surface px-3 py-2 shadow-sm ' +
            (sticky ? 'sticky top-0' : '')} aria-label="Quick add category task">
          <div className="flex items-center gap-2">
            <Plus size={18} className="shrink-0 text-gray-400"/>
            <input ref={inputRef} value={title} onChange={event => setTitle(event.target.value)}
              aria-label="New task title" placeholder={'Add task to ' + category.name}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm text-white outline-none" />
            <button type="submit" disabled={saving || !creationAllowed || !title.trim()}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
          <label className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <CalendarDays size={14} aria-hidden="true"/>
            <span>Date</span>
            <input type="date" aria-label="New task date" value={newDate}
              onChange={event => setNewDate(event.target.value)}
              className="max-w-[10rem] rounded-md border border-[#444444] bg-transparent px-1 py-1 text-xs text-white" />
          </label>
          {!creationAllowed && <p role="status" className="pt-1 text-xs text-amber-300">
            This category is not active on the selected date.
          </p>}
        </form>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-400"><ArrowUpDown size={14} />
            <select aria-label="Category date order" value={order}
              onChange={e => void setSetting(CATEGORY_VIEW_ORDER_SETTING_KEY, e.target.value)}
              className="rounded-lg border border-[#444444] bg-surface px-2 py-1.5 text-white">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            </select>
          </label>
          <select aria-label="Category completion filter" value={filter}
            onChange={e => void setSetting(CATEGORY_VIEW_FILTER_SETTING_KEY, e.target.value)}
            className="rounded-lg border border-[#444444] bg-surface px-2 py-1.5 text-xs text-white">
            <option value="all">All tasks</option><option value="incomplete">Incomplete</option>
            <option value="completed">Completed</option>
          </select>
          <button type="button" onClick={goToday}
            className="rounded-lg border border-[#444444] px-2 py-1.5 text-xs text-gray-300"><RotateCcw size={13} className="mr-1 inline"/>Today</button>
          {groups.upcoming.length > 0 && <button type="button" onClick={() => upcomingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="rounded-lg border border-[#444444] px-2 py-1.5 text-xs text-gray-300">Upcoming ({groups.upcoming.length})</button>}
        </div>
        {order === 'oldest' && <h3 className="px-2 py-2 text-xs font-semibold uppercase text-gray-400">Past dates</h3>}
        {order === 'oldest' && groups.past.slice(0, pastCount).map(renderGroup)}
        <div ref={todayRef} className="scroll-mt-24">
          {headerDate(todayKey, 'Today · ' + readableDate(todayKey), groups.today.length)}
          {groups.today.length ? renderTasks(groups.today) :
            <p className="px-3 py-2 text-sm text-gray-500">No matching tasks today.</p>}
        </div>
        {order === 'newest' && groups.past.length > 0 &&
          <h3 className="mt-4 px-2 py-2 text-xs font-semibold uppercase text-gray-400">Past dates</h3>}
        {order === 'newest' && groups.past.slice(0, pastCount).map(renderGroup)}
        {groups.past.length > pastCount && <button type="button" className="w-full rounded-lg py-3 text-sm text-gray-300"
          onClick={() => setPastCount(count => count + 18)}>Load more past dates</button>}
        <div ref={upcomingRef} className="scroll-mt-24">
          {groups.upcoming.length > 0 && <h3 className="mt-4 px-2 py-2 text-xs font-semibold uppercase text-gray-400">Upcoming</h3>}
          {groups.upcoming.slice(0, upcomingCount).map(renderGroup)}
          {groups.upcoming.length > upcomingCount && <button type="button" className="w-full rounded-lg py-3 text-sm text-gray-300"
            onClick={() => setUpcomingCount(count => count + 12)}>Load more upcoming dates</button>}
        </div>
        {groups.undated.length > 0 && <section className="mt-4">
          {headerDate('', 'Undated / Backlogs', groups.undated.length)}{renderTasks(groups.undated)}
        </section>}
        {groups.invalid.length > 0 && <section className="mt-4">
          {headerDate('', 'Tasks with invalid dates', groups.invalid.length)}{renderTasks(groups.invalid)}
        </section>}
      </> : <div className="rounded-xl border border-[#444444] p-5 text-center">
        <p className="mb-3 text-sm text-gray-400">Create your first category to start organizing tasks.</p>
        <button className="rounded-lg bg-white px-4 py-2 text-sm text-black" type="button"
          onClick={() => setManagerOpen(true)}>Create category</button>
      </div>}
      {error && <div role="status" className="mt-3 rounded-lg border border-[#444444] px-3 py-2 text-sm text-amber-300">
        {error} <button type="button" className="ml-2 underline" onClick={() => setError('')}>Dismiss</button>
      </div>}
    </section>
    <CategoryTaskActions task={activeTask} category={activeTaskCategory} mode={actionMode}
      setMode={setActionMode} onEdit={editStart} onError={setError}
      updateTask={updateTask} deleteTask={deleteTask}
      removeTaskPhoto={removeTaskPhoto} replaceTaskPhoto={replaceTaskPhoto} />
    <Suspense fallback={null}>
      {managerOpen && <CategoryManagerSheet isOpen onClose={() => setManagerOpen(false)} />}
    </Suspense>
  </div>;
};
