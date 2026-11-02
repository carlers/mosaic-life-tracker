import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPalettePicker } from '../ui/ColorPalettePicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { useSheetSaveAction } from '../../hooks/useSheetSaveAction';
import { Archive, ArrowDownUp, ArrowRightLeft, Pencil, Plus, RotateCcw, Trash2, GripVertical } from 'lucide-react';
import { MosaicSelect } from '../ui/MosaicSelect';
import { format } from 'date-fns';
import { validLocalDateKey } from '../../lib/categoryLifecycle';
import { categoryLifecycleInventory, executeCategoryLifecycle, type CategoryLifecycleInventory } from '../../lib/categoryLifecycleAction';
import { useCategories } from '../../hooks/useCategories';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureEnabled } from '../../hooks/useFeatureEnabled';
import { isFeatureEnabled } from '../../lib/featureControls';
import { findTasksWithoutActiveCategory } from '../../lib/categoryOrphans';
import {
  labelForVisibility,
  visibilityIcon,
} from '../../lib/visibility';
import type { CategoryDocument } from '../../db/schema';

type Visibility = 'private' | 'followers' | 'public';

const VISIBILITIES: Visibility[] = ['private', 'followers', 'public'];

interface VisibilityPickerProps {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
}

const VisibilityPicker: React.FC<VisibilityPickerProps> = ({
  value,
  onChange,
}) => (
  <div>
    <p className="mosaic-sheet-text mb-2 text-xs text-gray-400">Visibility</p>
    <div
      role="group"
      aria-label="Visibility"
      className="flex rounded-lg border border-[#333333] bg-[#111111] p-1"
    >
      {VISIBILITIES.map((visibility) => (
        <button
          key={visibility}
          type="button"
          aria-pressed={value === visibility}
          onClick={() => onChange(visibility)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
            value === visibility
              ? 'bg-[#2A2A2A] text-white'
              : 'text-gray-500'
          }`}
        >
          {visibilityIcon(visibility, 14)}
          {labelForVisibility(visibility)}
        </button>
      ))}
    </div>
  </div>
);

interface CategoryRowProps {
  cat: CategoryDocument;
  overriddenCount: number;
  onEditStart: (cat: CategoryDocument) => void;
  onManageRetirement: (cat: CategoryDocument) => void;
  onMoveTasks: (cat: CategoryDocument) => void;
  onManageDeletion: (cat: CategoryDocument) => void;
  onReorderEnd: () => void;
  disabled: boolean;
  isEditing: boolean;
  isRetiring: boolean;
  isMoving: boolean;
  isDeleting: boolean;
  orderSignature: string | string[];
  children?: React.ReactNode;
}

export const CategoryRow: React.FC<CategoryRowProps> = ({
  cat,
  overriddenCount,
  onEditStart,
  onManageRetirement,
  onMoveTasks,
  onManageDeletion,
  onReorderEnd,
  disabled,
  isEditing,
  isRetiring,
  isMoving,
  isDeleting,
  orderSignature,
  children,
}) => {
  const dragControls = useDragControls();
  const [exitContent, setExitContent] = useState(children);
  if ((isEditing || isRetiring || isMoving || isDeleting) && exitContent !== children) setExitContent(children);

  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      layout="position"
      layoutDependency={orderSignature}
      dragControls={dragControls}
      onDragEnd={onReorderEnd}
      aria-label={`${cat.name} category`}
      data-category-manager-id={cat.id}
      className="relative bg-[#1A1A1A] rounded-lg"
    >
      <div className="flex items-center gap-3 py-3 px-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!disabled && isFeatureEnabled('mosaic_disable_category_reorder')) dragControls.start(e);
          }}
          className="p-1 -ml-1 text-gray-400 touch-none cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
          disabled={disabled}
        >
          <GripVertical size={18} />
        </button>
        <div
          className="w-4 h-4 rounded-full shrink-0"
          style={{ backgroundColor: cat.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white truncate">{cat.name}</span>
            {visibilityIcon(cat.visibility)}
            {cat.retiredOn && <span className="text-xs text-gray-400">Last active {cat.retiredOn}</span>}
          </div>
          {overriddenCount > 0 && (
            <span className="text-xs text-gray-400">
              {overriddenCount} task{overriddenCount === 1 ? '' : 's'} override
              visibility
            </span>
          )}
        </div>
        <button
          onClick={() => onEditStart(cat)}
          disabled={disabled}
          className="p-2 text-gray-400"
          aria-label="Edit category"
          aria-expanded={isEditing}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={() => onManageRetirement(cat)}
          disabled={disabled}
          className="p-2 text-gray-400"
          aria-label={`Manage retirement for ${cat.name}`}
          aria-expanded={isRetiring}
        >
          {cat.retiredOn ? <RotateCcw size={16} /> : <Archive size={16} />}
        </button>
        <button type="button" onClick={() => onMoveTasks(cat)} disabled={disabled}
          className="p-2 text-gray-400" aria-label={`Move tasks from ${cat.name}`}
          aria-expanded={isMoving}>
          <ArrowRightLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onManageDeletion(cat)}
          disabled={disabled}
          className="p-2 text-gray-400"
          aria-label={`Manage deletion for ${cat.name}`}
          aria-expanded={isDeleting}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: isEditing || isRetiring || isMoving || isDeleting ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden" inert={!isEditing && !isRetiring && !isMoving && !isDeleting} aria-hidden={!isEditing && !isRetiring && !isMoving && !isDeleting}>
          <div className="mx-2 mb-2 border-t border-[#333333] px-1 pt-3 pb-1 space-y-3">
            {isEditing || isRetiring || isMoving || isDeleting ? children : exitContent}
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
};

type CategoryViewFilter = 'all' | 'active' | 'retired';

const isRetiredCategory = (cat: CategoryDocument, today: string) =>
  Boolean(cat.retiredOn && cat.retiredOn < today);

interface CategoryManagerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional Day View shortcut: reveal this category and open its inline edit controls. */
  initialCategoryId?: string | null;
}

export const CategoryManagerSheet: React.FC<CategoryManagerSheetProps> = ({
  isOpen,
  onClose,
  initialCategoryId = null,
}) => {
  const {
    categories = [],
    isLoading: categoriesLoading,
    addCategory,
    updateCategory,
    retireCategory,
    restoreCategory,
    reorderCategories,
  } = useCategories();
  const { tasks = [], isLoading: tasksLoading, moveCategoryTasks } = useTasks();
  const { user } = useAuth();
  const [orphanLimit, setOrphanLimit] = useState(25);
  const orphanedTasks = useMemo(() =>
    categoriesLoading || tasksLoading ? [] :
      findTasksWithoutActiveCategory(tasks, categories, user?.$id),
    [tasks, categories, user?.$id, categoriesLoading, tasksLoading]);
  const { save, reset, isSaving, error } = useSheetSaveAction();

  const [viewFilter, setViewFilter] = useState<CategoryViewFilter>('all');
  const [search, setSearch] = useState('');
  const [targetAppliedId, setTargetAppliedId] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');
  const activeCount = categories.filter(cat => !cat.isDeleted && !isRetiredCategory(cat, today)).length;
  const retiredCount = categories.filter(cat => !cat.isDeleted && isRetiredCategory(cat, today)).length;
  const canReorder = viewFilter === 'all' && search.trim() === '';

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newVisibility, setNewVisibility] = useState<Visibility>('private');

  const [retireId, setRetireId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteInventory, setDeleteInventory] = useState<CategoryLifecycleInventory | null>(null);
  const [deleteInventoryError, setDeleteInventoryError] = useState('');
  const [deleteProgress, setDeleteProgress] = useState<number | null>(null);
  const [moveToId, setMoveToId] = useState('');
  const [lastActiveDate, setLastActiveDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');

  const [orderedIds, setOrderedIds] = useState(() =>
    categories.map((cat) => cat.id)
  );
  const orderedCategories = useMemo(() => {
    const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));
    return [...categories].sort((a, b) => {
      const aIndex = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex || a.order - b.order;
    });
  }, [categories, orderedIds]);
  const pendingOrder = useRef(orderedCategories);
  const visibleCategories = useMemo(() => orderedCategories.filter(cat => {
    if (viewFilter === 'active' && isRetiredCategory(cat, today)) return false;
    if (viewFilter === 'retired' && !isRetiredCategory(cat, today)) return false;
    return cat.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [orderedCategories, viewFilter, search, today]);

  // Apply an incoming category request before painting the manager, including
  // after a slow local category hydrate. This is a guarded prop/state sync,
  // rather than a cascading state update inside an effect.
  if (isOpen && initialCategoryId && targetAppliedId !== initialCategoryId) {
    const target = categories.find(cat => cat.id === initialCategoryId && !cat.isDeleted);
    if (target) {
      setTargetAppliedId(initialCategoryId);
      setViewFilter(isRetiredCategory(target, today) ? 'retired' : 'active');
      setSearch('');
      setEditingId(target.id);
      setRetireId(null);
      setMoveId(null);
      setDeleteId(null);
      setEditName(target.name);
      setEditColor(target.color);
      setEditVisibility(target.visibility);
    }
  }

  useEffect(() => {
    if (!isOpen || !initialCategoryId || targetAppliedId !== initialCategoryId) return;
    const frame = window.requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll<HTMLElement>('[data-category-manager-id]'))
        .find(element => element.dataset.categoryManagerId === initialCategoryId);
      row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, initialCategoryId, targetAppliedId, visibleCategories]);

  const resetForm = () => {
    setIsAdding(false);
    setNewName('');
    setNewColor('#3B82F6');
    setNewVisibility('private');
  };

  const [syncedIsOpen, setSyncedIsOpen] = useState(isOpen);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
    if (isOpen) {
      setOrderedIds(categories.map((cat) => cat.id));
      setViewFilter('all');
      setSearch('');
      setTargetAppliedId(null);
      reset();
    }
    if (!isOpen) {
      resetForm();
      setEditingId(null);
      setRetireId(null);
      setMoveId(null);
      setDeleteId(null);
      setMoveToId('');
    }
  }

  useEffect(() => {
    if (!isOpen || !deleteId) return;
    let cancelled = false;
    void categoryLifecycleInventory(deleteId).then(
      inventory => { if (!cancelled) setDeleteInventory(inventory); },
      () => { if (!cancelled) setDeleteInventoryError('Could not verify tasks on the server. Check sync and retry.'); },
    );
    return () => { cancelled = true; };
  }, [isOpen, deleteId]);

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(task => {
      if (task.userId === user?.$id && !task.isDeleted) counts[task.categoryId] = (counts[task.categoryId] || 0) + 1;
    });
    return counts;
  }, [tasks, user?.$id]);

  const overriddenCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.visibility) counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const handleSaveNew = () => {
    if (newName.trim()) void save(
      () => addCategory({ name: newName.trim(), color: newColor, visibility: newVisibility, order: categories.length, icon: '' }),
      resetForm,
      'Could not add category. Try again.'
    );
  };

  const categoryReorderEnabled = useFeatureEnabled('mosaic_disable_category_reorder');
  const handleReverse = () => {
    if (!isFeatureEnabled('mosaic_disable_category_reorder')) return;
    if (isSaving || !canReorder || orderedCategories.length < 2) return;
    const reversed = [...orderedCategories].reverse();
    void save(
      () => reorderCategories(reversed),
      () => {
        pendingOrder.current = reversed;
        setOrderedIds(reversed.map((cat) => cat.id));
      },
      'Could not reverse category order. Try again.'
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Categories" height="full" preventDismiss={isSaving}>
      <div className="pt-2 pb-8 px-4">
        {!editingId && !retireId && !moveId && !deleteId && <SheetErrorBanner message={error} />}
        <div role="group" aria-label="Filter categories"
          className="mb-3 flex flex-wrap gap-1 rounded-lg border border-[#333333] bg-surface p-1">
          {([
            ['all', 'All', categories.length],
            ['active', 'Active', activeCount],
            ['retired', 'Retired', retiredCount],
          ] as const).map(([value, label, count]) => (
            <button key={value} type="button" aria-pressed={viewFilter === value}
              onClick={() => {
                setViewFilter(value);
                setEditingId(null);
                setRetireId(null);
                setMoveId(null);
                setDeleteId(null);
              }}
              className={`flex-1 min-w-20 rounded-md px-2 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                viewFilter === value ? 'bg-surfaceHighlight text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {label} ({count})
            </button>
          ))}
        </div>
        <input type="search" aria-label="Search categories" placeholder="Search categories"
          value={search} onChange={event => setSearch(event.target.value)}
          className="mb-3 w-full rounded-lg border border-[#333333] bg-surface px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        {categoryReorderEnabled && <div className="mb-3 flex justify-end">
          <Button
            variant="ghost"
            onClick={handleReverse}
            disabled={isSaving || !canReorder || !categoryReorderEnabled || orderedCategories.length < 2}
          >
            <ArrowDownUp size={16} />
            <span className="mosaic-sheet-text">Reverse order</span>
          </Button>
        </div>}
        <Reorder.Group
          axis="y"
          values={visibleCategories}
          onReorder={(newOrder) => {
            if (isSaving || !canReorder || !isFeatureEnabled('mosaic_disable_category_reorder')) return;
            pendingOrder.current = newOrder;
            setOrderedIds(newOrder.map((cat) => cat.id));
          }}
          className="space-y-2"
        >
          {visibleCategories.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              overriddenCount={overriddenCounts[cat.id] || 0}
              isEditing={editingId === cat.id}
              isRetiring={retireId === cat.id}
              isMoving={moveId === cat.id}
              isDeleting={deleteId === cat.id}
              orderSignature={orderedIds}
              onEditStart={(c) => {
                reset();
                setIsAdding(false);
                setRetireId(null);
                setMoveId(null);
                setDeleteId(null);
                setEditingId(c.id);
                setEditName(c.name);
                setEditColor(c.color);
                setEditVisibility(c.visibility);
              }}
              onManageRetirement={(category) => {
                reset();
                setEditingId(null);
                setIsAdding(false);
                setMoveId(null);
                setDeleteId(null);
                setRetireId(category.id);
                setLastActiveDate(category.retiredOn || format(new Date(), 'yyyy-MM-dd'));
              }}
              onMoveTasks={(category) => {
                reset();
                setEditingId(null);
                setRetireId(null);
                setIsAdding(false);
                setDeleteId(null);
                setMoveId(category.id);
                setMoveToId('');
              }}
              onManageDeletion={(category) => {
                reset();
                setEditingId(null);
                setRetireId(null);
                setMoveId(null);
                setIsAdding(false);
                setDeleteInventory(null);
                setDeleteInventoryError('');
                setDeleteConfirmName('');
                setDeleteTargetId('');
                setDeleteProgress(null);
                setDeleteId(current => current === category.id ? null : category.id);
              }}
              onReorderEnd={() => {
                if (!isSaving && canReorder && isFeatureEnabled('mosaic_disable_category_reorder')) {
                  void save(
                    () => reorderCategories(pendingOrder.current),
                    () => {},
                    'Could not reorder categories. Try again.'
                  );
                }
              }}
              disabled={isSaving || !canReorder || !categoryReorderEnabled}
            >
              {editingId === cat.id && (
                <>
                  <SheetErrorBanner message={error} />
                  <Input
                    key={editingId}
                    autoFocus
                    label="Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <ColorPalettePicker
                    key={cat.id}
                    selectedColor={editColor}
                    onSelect={setEditColor}
                    ariaLabel="Category color"
                  />
                  <VisibilityPicker
                    value={editVisibility}
                    onChange={setEditVisibility}
                  />
                  <Button
                    onClick={() => void save(
                      () => updateCategory(cat.id, { name: editName.trim(), color: editColor, visibility: editVisibility }),
                      () => setEditingId(null), 'Could not update category. Try again.'
                    )}
                    disabled={!editName.trim() || isSaving}
                  >
                    Save Changes
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    reset();
                    setEditingId(null);
                  }} disabled={isSaving}>
                    Cancel
                  </Button>
                </>
              )}
              {moveId === cat.id && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-white">Move tasks from {cat.name}</p>
                  <p className="text-xs text-gray-400">
                    {taskCounts[cat.id] || 0} tasks available on this device, including completed tasks,
                    future dates and Backlogs. The original category is preserved for offline devices.
                  </p>
                  <MosaicSelect label="Move to category" value={moveToId} onChange={setMoveToId}
                    placeholder="Select destination category"
                    disabled={isSaving || tasksLoading || categoriesLoading}
                    options={orderedCategories.filter(c => c.id !== cat.id && !c.isDeleted && !c.retiredOn)
                      .map(c => ({ value: c.id, label: c.name, color: c.color }))} />
                  <p className="text-xs text-gray-400">
                    This preserves each task's effective visibility and date. To remove the original
                    category from future days, retire it separately. This is not a category deletion.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!moveToId || isSaving || tasksLoading || categoriesLoading ||
                        !taskCounts[cat.id] || !orderedCategories.some(c => c.id === moveToId && !c.retiredOn)}
                      onClick={() => void save(
                        () => moveCategoryTasks(cat.id, moveToId),
                        () => { setMoveId(null); setMoveToId(''); },
                        'Task move incomplete. Some tasks may have moved; review the remaining tasks before retrying.'
                      )}>
                      Move {taskCounts[cat.id] || 0} tasks
                    </Button>
                    <Button variant="ghost" disabled={isSaving} onClick={() => setMoveId(null)}>Cancel</Button>
                  </div>
                  <SheetErrorBanner message={error} />
                </div>
              )}
              {deleteId === cat.id && (
                <section className="space-y-3" aria-label={`Category deletion options for ${cat.name}`}>
                  <p className="text-sm font-semibold text-white">Remove {cat.name}</p>
                  {deleteInventory?.categoryId === cat.id ? (
                    <p className="text-xs text-gray-400">
                      {deleteInventory.persistedTaskCount} server-synced task{deleteInventory.persistedTaskCount === 1 ? '' : 's'}
                      {' '}across all dates and Backlogs, including completed tasks.
                    </p>
                  ) : <p className="text-xs text-gray-400">Checking affected tasks on the server…</p>}
                  {deleteInventoryError && <p role="alert" className="text-xs text-red-400">{deleteInventoryError}</p>}
                  {deleteProgress !== null && <p role="status" className="text-xs text-gray-300">
                    Processing category; {deleteProgress} tasks remaining. If interrupted, retry the same operation.
                  </p>}
                  <MosaicSelect label="Move tasks to category before deleting" value={deleteTargetId}
                    onChange={setDeleteTargetId} placeholder="Choose destination"
                    disabled={isSaving}
                    options={orderedCategories.filter(c => c.id !== cat.id && !c.isDeleted && !c.retiredOn)
                      .map(c => ({value:c.id,label:c.name,color:c.color}))} />
                  <Input label={`Type ${cat.name} to confirm deletion`} value={deleteConfirmName}
                    onChange={event => setDeleteConfirmName(event.target.value)} />
                  <p className="text-xs text-gray-400">
                    Deleting all tasks also revokes task shares and removes Bucket List task links.
                    Task and category tombstones are retained for recovery. Do not start while another
                    device has unsynced changes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isSaving || !user?.$id || !deleteInventory?.safeToDelete ||
                        deleteInventory.categoryId !== cat.id || deleteConfirmName !== cat.name ||
                        !deleteTargetId}
                      onClick={() => void save(
                        () => executeCategoryLifecycle(user!.$id, cat.id, cat.name, 'move', deleteTargetId, setDeleteProgress),
                        () => { setDeleteId(null); setDeleteProgress(null); },
                        'Migration incomplete. Retry with the same destination to resume safely.'
                      )}>
                      Move tasks &amp; delete category
                    </Button>
                    <Button disabled={isSaving || !user?.$id || !deleteInventory?.safeToDelete ||
                        deleteInventory.categoryId !== cat.id || deleteConfirmName !== cat.name}
                      onClick={() => void save(
                        () => executeCategoryLifecycle(user!.$id, cat.id, cat.name, 'delete', '', setDeleteProgress),
                        () => { setDeleteId(null); setDeleteProgress(null); },
                        'Deletion incomplete. Retry Delete All to resume safely.'
                      )}>
                      Delete category and all tasks
                    </Button>
                    <Button variant="ghost" disabled={isSaving} onClick={() => {
                      setDeleteId(null);
                      setRetireId(cat.id);
                      setLastActiveDate(cat.retiredOn || format(new Date(), 'yyyy-MM-dd'));
                    }}>Retire instead</Button>
                    <Button variant="ghost" disabled={isSaving} onClick={() => setDeleteId(null)}>Cancel</Button>
                  </div>
                  <SheetErrorBanner message={error} />
                </section>
              )}
              {retireId === cat.id && (
              <div className="mt-4 rounded-xl border border-[#333333] bg-[#1A1A1A] p-3 space-y-3">
                <p className="text-sm font-semibold text-white">{cat.retiredOn ? 'Manage retirement' : 'Retire category'}: {cat.name}</p>
                <label className="block text-xs text-gray-400" htmlFor={`category-last-active-date-${cat.id}`}>Last active date (inclusive)</label>
                <input id={`category-last-active-date-${cat.id}`} type="date" value={lastActiveDate}
                  onChange={event => setLastActiveDate(event.target.value)}
                  className="w-full rounded-lg border border-[#444444] bg-surface px-3 py-2 text-sm text-white" />
                <p className="text-xs text-gray-400">The category stays visible on this date and earlier. Existing tasks on later dates and in Backlogs remain accessible; new later tasks use active categories.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void save(
                    () => retireCategory(cat.id, lastActiveDate),
                    () => setRetireId(null),
                    'Could not retire category. Try again.'
                  )} disabled={isSaving || !validLocalDateKey(lastActiveDate)}>
                    {cat.retiredOn ? 'Update last active date' : 'Retire category'}
                  </Button>
                  {cat.retiredOn && (
                    <Button variant="ghost" disabled={isSaving} onClick={() => void save(
                      () => restoreCategory(cat.id),
                      () => setRetireId(null),
                      'Could not restore category. Try again.'
                    )}>Restore category</Button>
                  )}
                  <Button variant="ghost" disabled={isSaving} onClick={() => setRetireId(null)}>Cancel</Button>
                </div>
                <SheetErrorBanner message={error} />
              </div>
            )}
            </CategoryRow>
          ))}
        </Reorder.Group>
        {visibleCategories.length === 0 && (
          <p className="rounded-lg bg-surface px-3 py-4 text-center text-sm text-gray-400">
            No matching categories.
          </p>
        )}
        {isAdding ? (
          <div className="mt-4 p-3 bg-[#1A1A1A] rounded-lg space-y-3">
            <Input
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <ColorPalettePicker
              selectedColor={newColor}
              onSelect={setNewColor}
            />
            <VisibilityPicker
              value={newVisibility}
              onChange={setNewVisibility}
            />
            <Button onClick={handleSaveNew} disabled={!newName.trim() || isSaving}>
              Add Category
            </Button>
            <Button variant="ghost" onClick={resetForm} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              setEditingId(null);
              setRetireId(null);
              setMoveId(null);
              setDeleteId(null);
              setViewFilter('all');
              setSearch('');
              setIsAdding(true);
            }}
            disabled={isSaving}
            className="mt-4 w-full"
          >
            <Plus size={16} />
            Add Category
          </Button>
        )}

        {!categoriesLoading && !tasksLoading && user?.$id && orphanedTasks.length > 0 && (
          <details className="mt-4 rounded-lg border border-[#333333] bg-[#1A1A1A] p-3">
            <summary className="cursor-pointer text-sm text-white">
              Tasks without an active category ({orphanedTasks.length})
            </summary>
            <p className="mt-2 text-xs text-gray-400">
              These tasks are preserved. Category deletion is disabled while recovery is prepared.
            </p>
            <ul className="mt-3 space-y-2" aria-label="Tasks without an active category">
              {orphanedTasks.slice(0, orphanLimit).map(task => (
                <li key={task.id} className="rounded-md bg-[#111111] px-3 py-2">
                  <p className="text-sm text-white break-words">{task.title}</p>
                  <p className="text-xs text-gray-400">
                    {task.date || 'Backlogs'} · {task.completed ? 'Completed' : 'Not completed'}
                  </p>
                </li>
              ))}
            </ul>
            {orphanedTasks.length > orphanLimit && (
              <Button variant="ghost" onClick={() => setOrphanLimit(limit => limit + 25)}>
                Show more preserved tasks
              </Button>
            )}
          </details>
        )}
      </div>
    </BottomSheet>
  );
};
