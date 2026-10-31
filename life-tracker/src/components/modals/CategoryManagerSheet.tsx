import React, { useState, useMemo, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPalettePicker } from '../ui/ColorPalettePicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { useSheetSaveAction } from '../../hooks/useSheetSaveAction';
import { ArrowDownUp, Pencil, Plus, Trash2, GripVertical } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
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
  onReorderEnd: () => void;
  disabled: boolean;
  isEditing: boolean;
  orderSignature: string | string[];
  children?: React.ReactNode;
}

export const CategoryRow: React.FC<CategoryRowProps> = ({
  cat,
  overriddenCount,
  onEditStart,
  onReorderEnd,
  disabled,
  isEditing,
  orderSignature,
  children,
}) => {
  const dragControls = useDragControls();
  const [exitContent, setExitContent] = useState(children);
  if (isEditing && exitContent !== children) setExitContent(children);

  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      layout="position"
      layoutDependency={orderSignature}
      dragControls={dragControls}
      onDragEnd={onReorderEnd}
      aria-label={`${cat.name} category`}
      className="relative bg-[#1A1A1A] rounded-lg"
    >
      <div className="flex items-center gap-3 py-3 px-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!disabled) dragControls.start(e);
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
          disabled
          title="Deletion temporarily unavailable to protect tasks"
          className="p-2 text-gray-500"
          aria-label="Delete category (temporarily unavailable)"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div
        className="grid transition-all duration-200 ease-in-out"
        style={{ gridTemplateRows: isEditing ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden" inert={!isEditing} aria-hidden={!isEditing}>
          <div className="mx-2 mb-2 border-t border-[#333333] px-1 pt-3 pb-1 space-y-3">
            {isEditing ? children : exitContent}
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
};

interface CategoryManagerSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategoryManagerSheet: React.FC<CategoryManagerSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    categories = [],
    addCategory,
    updateCategory,
    reorderCategories,
  } = useCategories();
  const { tasks = [], isLoading: tasksLoading } = useTasks();
  const { user } = useAuth();
  const { isLoading: categoriesLoading } = useCategories(false);
  const [orphanLimit, setOrphanLimit] = useState(25);
  const orphanedTasks = useMemo(() =>
    categoriesLoading || tasksLoading ? [] :
      findTasksWithoutActiveCategory(tasks, categories, user?.$id),
    [tasks, categories, user?.$id, categoriesLoading, tasksLoading]);
  const { save, reset, isSaving, error } = useSheetSaveAction();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newVisibility, setNewVisibility] = useState<Visibility>('private');

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
      reset();
    }
    if (!isOpen) {
      resetForm();
      setEditingId(null);
    }
  }

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

  const handleReverse = () => {
    if (isSaving || orderedCategories.length < 2) return;
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
        {!editingId && <SheetErrorBanner message={error} />}
        <div className="mb-3 flex justify-end">
          <Button
            variant="ghost"
            onClick={handleReverse}
            disabled={isSaving || orderedCategories.length < 2}
          >
            <ArrowDownUp size={16} />
            <span className="mosaic-sheet-text">Reverse order</span>
          </Button>
        </div>
        <Reorder.Group
          axis="y"
          values={orderedCategories}
          onReorder={(newOrder) => {
            if (isSaving) return;
            pendingOrder.current = newOrder;
            setOrderedIds(newOrder.map((cat) => cat.id));
          }}
          className="space-y-2"
        >
          {orderedCategories.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              overriddenCount={overriddenCounts[cat.id] || 0}
              isEditing={editingId === cat.id}
              orderSignature={orderedIds}
              onEditStart={(c) => {
                reset();
                setIsAdding(false);
                setEditingId(c.id);
                setEditName(c.name);
                setEditColor(c.color);
                setEditVisibility(c.visibility);
              }}
              onReorderEnd={() => {
                if (!isSaving) {
                  void save(
                    () => reorderCategories(pendingOrder.current),
                    () => {},
                    'Could not reorder categories. Try again.'
                  );
                }
              }}
              disabled={isSaving}
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
            </CategoryRow>
          ))}
        </Reorder.Group>

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
