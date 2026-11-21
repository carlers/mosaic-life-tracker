import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPalettePicker } from '../ui/ColorPalettePicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { useSheetSaveAction } from '../../hooks/useSheetSaveAction';
import { ArrowDownUp, ArrowRightLeft, Pencil, Plus, Trash2, GripVertical, MoreHorizontal } from 'lucide-react';
import { MosaicSelect } from '../ui/MosaicSelect';
import { format } from 'date-fns';
import { categoryLifecycleStatus, validCategoryDateRange } from '../../lib/categoryLifecycle';
import { categoryLifecycleInventory, executeCategoryLifecycle,
  listRecoverableCategories, recoverDeletedCategory,
  type RecoverableCategory, type CategoryLifecycleInventory } from '../../lib/categoryLifecycleAction';
import { useCategories } from '../../hooks/useCategories';
import { useTasks } from '../../hooks/useTasks';
import type { BulkTaskActionProgress } from '../../lib/bulkTaskActions';
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
  onMoveTasks: (cat: CategoryDocument) => void;
  onManageDeletion: (cat: CategoryDocument) => void;
  onReorderEnd: () => void;
  disabled: boolean;
  reorderDisabled: boolean;
  isEditing: boolean;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onDismissMenu: () => void;
  isMoving: boolean;
  isDeleting: boolean;
  orderSignature: string | string[];
  today: string;
  children?: React.ReactNode;
}

export const CategoryRow: React.FC<CategoryRowProps> = ({
  cat,
  overriddenCount,
  onEditStart,
  onMoveTasks,
  onManageDeletion,
  onReorderEnd,
  disabled,
  reorderDisabled,
  isEditing,
  isMenuOpen,
  onToggleMenu,
  onDismissMenu,
  isMoving,
  isDeleting,
  orderSignature,
  today,
  children,
}) => {
  const dragControls = useDragControls();
  const actionsRef = useRef<HTMLDivElement>(null);
  const [menuAbove, setMenuAbove] = useState(false);
  useEffect(() => {
    if (!isMenuOpen) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) onDismissMenu();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissMenu();
    };
    document.addEventListener('pointerdown', onOutsidePointer);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointer);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isMenuOpen, onDismissMenu]);
  const actionClass = 'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-white hover:bg-surfaceHighlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const [exitContent, setExitContent] = useState(children);
  if ((isEditing || isMoving || isDeleting) && exitContent !== children) setExitContent(children);

  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      layout="position"
      layoutDependency={orderSignature}
      dragControls={dragControls}
      onDragEnd={() => { onDismissMenu(); onReorderEnd(); }}
      aria-label={`${cat.name} category`}
      data-category-manager-id={cat.id}
      className="relative bg-[#1A1A1A] rounded-lg"
      style={{ zIndex: isMenuOpen ? 20 : 'auto' }}
    >
      <div className="flex items-center gap-2 py-3 px-2">
        <button
          type="button"
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!disabled && !reorderDisabled && isFeatureEnabled('mosaic_disable_category_reorder')) dragControls.start(event);
          }}
          className="p-1 -ml-1 text-gray-400 touch-none cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
          disabled={disabled || reorderDisabled}
        >
          <GripVertical size={18} />
        </button>
        <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate whitespace-nowrap text-white" title={cat.name}>{cat.name}</span>
            <span className="shrink-0">{visibilityIcon(cat.visibility)}</span>
          </div>
          {(cat.startedOn || cat.retiredOn) && (
            <div className="flex flex-wrap gap-x-2 text-xs text-gray-400">
              {cat.startedOn && <span>Start: {cat.startedOn}</span>}
              {cat.retiredOn && <span>End: {cat.retiredOn}</span>}
            </div>
          )}
          {overriddenCount > 0 && (
            <span className="text-xs text-gray-400">
              {overriddenCount} task{overriddenCount === 1 ? '' : 's'} override visibility
            </span>
          )}
        </div>
        <div className="relative shrink-0" ref={actionsRef}>
          <button type="button"
            onClick={event => {
              setMenuAbove(window.innerHeight - event.currentTarget.getBoundingClientRect().bottom < 185);
              onToggleMenu();
            }}
            onPointerDown={event => event.stopPropagation()}
            disabled={disabled}
            className="rounded-lg p-2 text-gray-400 hover:bg-surfaceHighlight hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Options for ${cat.name}`}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            aria-controls={isMenuOpen ? `category-actions-${cat.id}` : undefined}
          ><MoreHorizontal size={20} /></button>
          {isMenuOpen && (
            <div id={`category-actions-${cat.id}`} role="group" aria-label={`${cat.name} actions`}
              className={`absolute right-0 z-30 w-44 rounded-xl border border-[#444444] bg-surface p-1 shadow-xl ${menuAbove ? 'bottom-full mb-1' : 'top-full mt-1'}`}
              onPointerDown={event => event.stopPropagation()}
            >
              <button type="button" className={actionClass} onClick={() => { onDismissMenu(); onEditStart(cat); }}>
                <Pencil size={16} aria-hidden="true" /> Edit category
              </button>
              <button type="button" className={actionClass} onClick={() => { onDismissMenu(); onMoveTasks(cat); }}>
                <ArrowRightLeft size={16} aria-hidden="true" /> Move tasks
              </button>
              <button type="button" className={actionClass} onClick={() => { onDismissMenu(); onManageDeletion(cat); }}>
                <Trash2 size={16} aria-hidden="true" /> Delete category
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: isEditing || isMoving || isDeleting ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden" inert={!isEditing && !isMoving && !isDeleting} aria-hidden={!isEditing && !isMoving && !isDeleting}>
          <div className="mx-2 mb-2 border-t border-[#333333] px-1 pt-3 pb-1 space-y-3">
            {isEditing || isMoving || isDeleting ? children : exitContent}
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
};

type CategoryViewFilter = 'all' | 'active' | 'upcoming' | 'retired' | 'deleted';

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
  const activeCount = categories.filter(cat => !cat.isDeleted && categoryLifecycleStatus(cat, today) === 'active').length;
  const upcomingCount = categories.filter(cat => !cat.isDeleted && categoryLifecycleStatus(cat, today) === 'upcoming').length;
  const retiredCount = categories.filter(cat => !cat.isDeleted && categoryLifecycleStatus(cat, today) === 'retired').length;
  const canReorder = viewFilter === 'all' && search.trim() === '';

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newVisibility, setNewVisibility] = useState<Visibility>('private');
  const [newStartedOn, setNewStartedOn] = useState(today);
  const [newRetiredOn, setNewRetiredOn] = useState('');

  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveProgress, setMoveProgress] = useState<(BulkTaskActionProgress & { label: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteInventory, setDeleteInventory] = useState<CategoryLifecycleInventory | null>(null);
  const [deleteInventoryError, setDeleteInventoryError] = useState('');
  const [deleteProgress, setDeleteProgress] = useState<number | null>(null);
  const [recoverable, setRecoverable] = useState<RecoverableCategory[]>([]);
  const [recoveryOwnerId, setRecoveryOwnerId] = useState<string | null>(null);
  const [recoveryCursor, setRecoveryCursor] = useState<string | null>(null);
  const visibleRecoverable = recoveryOwnerId === user?.$id ? recoverable : [];
  const [recoverError, setRecoverError] = useState('');
  const [recoveryTarget, setRecoveryTarget] = useState<string | null>(null);
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryProgress, setRecoveryProgress] = useState<number | null>(null);
  const filteredRecoverable = visibleRecoverable.filter(category =>
    category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  const loadRecoverable = async (cursor?: string) => {
    const page = await listRecoverableCategories(cursor);
    setRecoverable(current => cursor ? [...current,...page.categories] : page.categories);
    setRecoveryCursor(page.nextCursor);
    setRecoverError('');
  };
  useEffect(() => {
    if (!isOpen || !user?.$id) return;
    let cancelled=false;
    void listRecoverableCategories().then(page => {
      if (cancelled) return;
      setRecoverable(page.categories);
      setRecoveryOwnerId(user.$id);
      setRecoveryCursor(page.nextCursor);
      setRecoveryTarget(null);
      setRecoverError('');
    }, () => {
      if (!cancelled) setRecoverError('Recovery is unavailable until the server upgrade is complete.');
    });
    return () => { cancelled=true; };
  }, [isOpen, user?.$id]);

  const [moveToId, setMoveToId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');
  const [editStartedOn, setEditStartedOn] = useState('');
  const [editRetiredOn, setEditRetiredOn] = useState('');

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
    if (viewFilter === 'deleted') return false;
    const status = categoryLifecycleStatus(cat, today);
    if (viewFilter === 'active' && status !== 'active') return false;
    if (viewFilter === 'upcoming' && status !== 'upcoming') return false;
    if (viewFilter === 'retired' && status !== 'retired') return false;
    return cat.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [orderedCategories, viewFilter, search, today]);

  // Apply an incoming category request before painting the manager, including
  // after a slow local category hydrate. This is a guarded prop/state sync,
  // rather than a cascading state update inside an effect.
  if (isOpen && initialCategoryId && targetAppliedId !== initialCategoryId) {
    const target = categories.find(cat => cat.id === initialCategoryId && !cat.isDeleted);
    if (target) {
      setTargetAppliedId(initialCategoryId);
      const status = categoryLifecycleStatus(target, today);
      setViewFilter(status === 'retired' ? 'retired' : status === 'upcoming' ? 'upcoming' : status === 'invalid' ? 'all' : 'active');
      setSearch('');
      setEditingId(target.id);
      setMoveId(null);
      setDeleteId(null);
      setEditName(target.name);
      setEditColor(target.color);
      setEditVisibility(target.visibility);
      setEditStartedOn(target.startedOn || '');
      setEditRetiredOn(target.retiredOn || '');
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
    setNewStartedOn(today);
    setNewRetiredOn('');
  };

  const [syncedIsOpen, setSyncedIsOpen] = useState(isOpen);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
    if (isOpen) {
      setOrderedIds(categories.map((cat) => cat.id));
      setViewFilter('all');
      setSearch('');
      setActionMenuId(null);
      setTargetAppliedId(null);
      reset();
    }
    if (!isOpen) {
      setActionMenuId(null);
      resetForm();
      setEditingId(null);
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
      () => addCategory({ name: newName.trim(), color: newColor, visibility: newVisibility, order: categories.length, icon: '', startedOn: newStartedOn, retiredOn: newRetiredOn }),
      resetForm,
      'Could not add category. Try again.'
    );
  };

  const categoryReorderEnabled = useFeatureEnabled('mosaic_disable_category_reorder');
  const handleReverse = () => {
    if (isSaving || !canReorder || !isFeatureEnabled('mosaic_disable_category_reorder') || orderedCategories.length < 2) return;
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
        {!editingId && !moveId && !deleteId && <SheetErrorBanner message={error} />}
        <div role="group" aria-label="Filter categories"
          className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-[#333333] bg-surface p-1">
          {([
            ['all', 'All', categories.length],
            ['active', 'Active', activeCount],
            ['upcoming', 'Upcoming', upcomingCount],
            ['retired', 'Ended', retiredCount],
            ['deleted', 'Recently deleted', visibleRecoverable.length],
          ] as const).map(([value, label, count]) => (
            <button key={value} type="button" aria-pressed={viewFilter === value}
              onClick={() => {
                setActionMenuId(null);
                setViewFilter(value);
                setSearch('');
                setEditingId(null);
                setMoveId(null);
                setDeleteId(null);
                setIsAdding(false);
                setRecoveryTarget(null);
              }}
              className={`shrink-0 flex-1 min-w-max whitespace-nowrap rounded-md px-2 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                viewFilter === value ? 'bg-surfaceHighlight text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {label} ({count})
            </button>
          ))}
        </div>
        <input type="search" aria-label="Search categories" placeholder="Search categories"
          value={search} onChange={event => { setActionMenuId(null); setSearch(event.target.value); }}
          className="mb-3 w-full rounded-lg border border-[#333333] bg-surface px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
        {viewFilter === 'deleted' && (
          <section aria-label="Recently deleted categories" className="space-y-3">
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Recover Delete All operations created after recovery tracking was enabled.
                Previously deleted tasks are not resurrected. Revoked task shares and
                removed Bucket List links are not automatically restored.
              </p>
              {recoverError && <p role="alert" className="text-xs text-gray-400">{recoverError}</p>}
              {filteredRecoverable.length===0 && !recoverError && <p className="text-xs text-gray-400">{search.trim() ? 'No matching deleted categories.' : 'No recoverable categories.'}</p>}
              {filteredRecoverable.map(category => (
                <div key={category.id} className="space-y-2 rounded-lg bg-surface px-3 py-3">
                  <p className="text-sm text-white">{category.name}</p>
                  <p className="text-xs text-gray-400">Deleted {category.deletedAt}</p>
                  {recoveryTarget === category.id && (
                    <Input label={`Type ${category.name} to confirm recovery`}
                      value={recoveryConfirm} onChange={event => setRecoveryConfirm(event.target.value)} />
                  )}
                  {recoveryTarget === category.id && recoveryProgress !== null &&
                    <p role="status" className="text-xs text-gray-300">
                      {recoveryProgress} tasks remaining. Retry recovery if interrupted.
                    </p>}
                  {recoveryTarget !== category.id ? (
                    <Button disabled={isSaving} onClick={() => {
                      setRecoveryTarget(category.id); setRecoveryConfirm('');setRecoveryProgress(null);
                    }}>Recover category</Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving || !user?.$id || recoveryConfirm !== category.name}
                        onClick={() => void save(
                          () => recoverDeletedCategory(user!.$id,category.id,category.name,setRecoveryProgress),
                          () => {
                            setRecoveryTarget(null);setRecoveryProgress(null);
                            void loadRecoverable().catch(() => setRecoverError('Could not refresh recoverable categories.'));
                          },
                          'Recovery incomplete. Retry the same category to resume safely.',
                        )}>Restore category and tasks</Button>
                      <Button variant="ghost" disabled={isSaving}
                        onClick={() => setRecoveryTarget(null)}>Cancel</Button>
                    </div>
                  )}
                </div>
              ))}
              {recoveryCursor && <Button variant="ghost" disabled={isSaving}
                onClick={() => void loadRecoverable(recoveryCursor).catch(
                  () => setRecoverError('Could not load more recoverable categories.'))}>
                Load more deleted categories
              </Button>}
            </div>
          </section>
        )}
        {viewFilter !== 'deleted' && (<>
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
              isMenuOpen={actionMenuId === cat.id}
              onToggleMenu={() => setActionMenuId(id => id === cat.id ? null : cat.id)}
              onDismissMenu={() => setActionMenuId(null)}
              isMoving={moveId === cat.id}
              isDeleting={deleteId === cat.id}
              orderSignature={orderedIds}
              today={today}
              onEditStart={(c) => {
                reset();
                setIsAdding(false);
                setMoveId(null);
                setDeleteId(null);
                setEditingId(c.id);
                setEditName(c.name);
                setEditColor(c.color);
                setEditVisibility(c.visibility);
                setEditStartedOn(c.startedOn || '');
                setEditRetiredOn(c.retiredOn || '');
              }}
              onMoveTasks={(category) => {
                reset();
                setEditingId(null);
                setIsAdding(false);
                setDeleteId(null);
                setMoveProgress(null);
                setMoveId(category.id);
                setMoveToId('');
              }}
              onManageDeletion={(category) => {
                reset();
                setEditingId(null);
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
              disabled={isSaving}
              reorderDisabled={!canReorder || !categoryReorderEnabled}
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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400" htmlFor={`category-start-date-${cat.id}`}>Start date</label>
                      <input id={`category-start-date-${cat.id}`} type="date" value={editStartedOn}
                        onChange={event => setEditStartedOn(event.target.value)}
                        className="w-full rounded-lg border border-[#444444] bg-surface px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400" htmlFor={`category-end-date-${cat.id}`}>End date</label>
                      <input id={`category-end-date-${cat.id}`} type="date" value={editRetiredOn}
                        onChange={event => setEditRetiredOn(event.target.value)}
                        className="w-full rounded-lg border border-[#444444] bg-surface px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Dates are inclusive. Leave a date blank for no limit. Existing tasks remain accessible.</p>
                  {!validCategoryDateRange(editStartedOn, editRetiredOn) && (
                    <p role="alert" className="text-xs text-red-400">End date must be on or after Start date.</p>
                  )}
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
                      () => updateCategory(cat.id, { name: editName.trim(), color: editColor, visibility: editVisibility, startedOn: editStartedOn, retiredOn: editRetiredOn }),
                      () => setEditingId(null), 'Could not update category. Try again.'
                    )}
                    disabled={!editName.trim() || isSaving || !validCategoryDateRange(editStartedOn, editRetiredOn)}
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
                    options={orderedCategories.filter(c => c.id !== cat.id && !c.isDeleted)
                      .map(c => ({ value: c.id, label: c.name, color: c.color }))} />
                  <p className="text-xs text-gray-400">
                    This preserves each task's effective visibility and date. To remove the original
                    category from future days, set an end date in Edit category. This is not a category deletion.
                  </p>
                  {moveProgress && moveProgress.total > 0 && (
                    <div className="space-y-1">
                      <p role="status" aria-live="off" className="text-xs text-gray-300">
                        {moveProgress.label === 'Preparing move'
                          ? 'Preparing to move ' + moveProgress.total + ' tasks…'
                          : moveProgress.completed === moveProgress.total && moveProgress.failed > 0
                            ? 'Moved ' + (moveProgress.completed - moveProgress.failed) + ' of ' +
                              moveProgress.total + ' tasks; ' + moveProgress.failed + ' failed. Retry to continue.'
                            : 'Moving tasks: ' + moveProgress.completed + ' of ' + moveProgress.total +
                              ' processed' + (moveProgress.failed > 0 ? ' · ' + moveProgress.failed + ' failed' : '')}
                      </p>
                      <div
                        role="progressbar"
                        aria-label="Category task move progress"
                        aria-valuemin={0}
                        aria-valuemax={moveProgress.total}
                        aria-valuenow={moveProgress.completed}
                        aria-valuetext={moveProgress.completed + ' of ' + moveProgress.total + ' tasks processed'}
                        className="h-1.5 overflow-hidden rounded-full bg-[#333333]"
                      >
                        <div className="h-full rounded-full bg-accent transition-[width] duration-150"
                          style={{ width: Math.round(moveProgress.completed / moveProgress.total * 100) + '%' }} />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!moveToId || isSaving || tasksLoading || categoriesLoading ||
                        !taskCounts[cat.id] || !orderedCategories.some(c => c.id === moveToId && !c.isDeleted)}
                      onClick={() => {
                        setMoveProgress({ label: 'Preparing move', completed: 0, total: taskCounts[cat.id] || 0, failed: 0 });
                        void save(async () => {
                          try {
                            await moveCategoryTasks(cat.id, moveToId, progress =>
                              setMoveProgress({ ...progress, label: 'Moving tasks' })
                            );
                          } catch (moveError) {
                            setMoveProgress(current => current?.label === 'Preparing move' ? null : current);
                            throw moveError;
                          }
                        }, () => {
                          setMoveId(null);
                          setMoveToId('');
                          setMoveProgress(null);
                        }, 'Task move incomplete. Some tasks may have moved; review the remaining tasks before retrying.');
                      }}>
                      {isSaving ? 'Moving tasks…' : 'Move ' + (taskCounts[cat.id] || 0) + ' tasks'}
                    </Button>
                    <Button variant="ghost" disabled={isSaving} onClick={() => {
                      setMoveId(null);
                      setMoveProgress(null);
                    }}>Cancel</Button>
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
                    options={orderedCategories.filter(c => c.id !== cat.id && !c.isDeleted && categoryLifecycleStatus(c, today) !== 'invalid')
                      .map(c => ({value:c.id,label:c.name,color:c.color}))} />
                  <p className="text-xs text-gray-400">All task dates, including Backlogs, must fit the destination's active dates. If any do not, the server cancels the move before changing tasks.</p>
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
                        () => { setDeleteId(null); setDeleteProgress(null); void loadRecoverable().catch(() => {}); },
                        'Migration incomplete. Retry with the same destination to resume safely.'
                      )}>
                      Move tasks &amp; delete category
                    </Button>
                    <Button disabled={isSaving || !user?.$id || !deleteInventory?.safeToDelete ||
                        deleteInventory.categoryId !== cat.id || deleteConfirmName !== cat.name}
                      onClick={() => void save(
                        () => executeCategoryLifecycle(user!.$id, cat.id, cat.name, 'delete', '', setDeleteProgress),
                        () => { setDeleteId(null); setDeleteProgress(null); setSearch(''); setViewFilter('deleted'); void loadRecoverable().catch(() => {}); },
                        'Deletion incomplete. Retry Delete All to resume safely.'
                      )}>
                      Delete category and all tasks
                    </Button>
                    <Button variant="ghost" disabled={isSaving} onClick={() => {
                      reset();
                      setDeleteId(null);
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color);
                      setEditVisibility(cat.visibility);
                      setEditStartedOn(cat.startedOn || '');
                      setEditRetiredOn(cat.retiredOn || '');
                    }}>Set end date instead</Button>
                    <Button variant="ghost" disabled={isSaving} onClick={() => setDeleteId(null)}>Cancel</Button>
                  </div>
                  <SheetErrorBanner message={error} />
                </section>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-400" htmlFor="category-start-date-new">Start date</label>
                <input id="category-start-date-new" type="date" value={newStartedOn}
                  onChange={event => setNewStartedOn(event.target.value)}
                  className="w-full rounded-lg border border-[#444444] bg-surface px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400" htmlFor="category-end-date-new">End date</label>
                <input id="category-end-date-new" type="date" value={newRetiredOn}
                  onChange={event => setNewRetiredOn(event.target.value)}
                  className="w-full rounded-lg border border-[#444444] bg-surface px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Dates are inclusive. Leave End date blank for an ongoing category.</p>
            {!validCategoryDateRange(newStartedOn, newRetiredOn) && (
              <p role="alert" className="text-xs text-red-400">End date must be on or after Start date.</p>
            )}
            <ColorPalettePicker
              selectedColor={newColor}
              onSelect={setNewColor}
            />
            <VisibilityPicker
              value={newVisibility}
              onChange={setNewVisibility}
            />
            <Button onClick={handleSaveNew} disabled={!newName.trim() || isSaving || !validCategoryDateRange(newStartedOn, newRetiredOn)}>
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
        </>)}
      </div>
    </BottomSheet>
  );
};
