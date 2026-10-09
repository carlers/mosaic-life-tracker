import React, { useState, useMemo, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPalettePicker } from '../ui/ColorPalettePicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { useSheetSaveAction } from '../../hooks/useSheetSaveAction';
import { Pencil, Plus, Trash2, GripVertical } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useTasks } from '../../hooks/useTasks';
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
    <p className="mb-2 text-xs text-gray-400">Visibility</p>
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
  onDeleteRequest: (id: string) => void;
  onReorderEnd: () => void;
  disabled: boolean;
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  cat,
  overriddenCount,
  onEditStart,
  onDeleteRequest,
  onReorderEnd,
  disabled,
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onReorderEnd}
      className="flex items-center gap-3 py-3 px-2 bg-[#1A1A1A] rounded-lg"
    >
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
      >
        <Pencil size={16} />
      </button>
      <button
        onClick={() => onDeleteRequest(cat.id)}
        disabled={disabled}
        className="p-2 text-gray-400"
        aria-label="Delete category"
      >
        <Trash2 size={16} />
      </button>
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
    deleteCategory,
    reorderCategories,
  } = useCategories();
  const { tasks = [] } = useTasks();
  const { save, reset, isSaving, error } = useSheetSaveAction();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newVisibility, setNewVisibility] = useState<Visibility>('private');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');

  const [deleteId, setDeleteId] = useState<string | null>(null);
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

  const [syncedIsOpen, setSyncedIsOpen] = useState(isOpen);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
    if (isOpen) {
      setOrderedIds(categories.map((cat) => cat.id));
      reset();
    }
    if (!isOpen) {
      setIsAdding(false);
      setNewName('');
      setNewColor('#3B82F6');
      setNewVisibility('private');
      setEditingId(null);
      setEditName('');
      setEditVisibility('private');
      setDeleteId(null);
    }
  }

  const overriddenCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.visibility) {
        map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  const handleSaveNew = async () => {
    if (!newName.trim()) return;
    await save(
      () =>
        addCategory({
          name: newName.trim(),
          color: newColor,
          visibility: newVisibility,
          order: categories.length,
          icon: '',
        }),
      () => {
        setIsAdding(false);
        setNewName('');
        setNewColor('#3B82F6');
        setNewVisibility('private');
      },
      'Could not add category. Try again.'
    );
  };

  const handleUpdate = async (
    id: string,
    name: string,
    visibility: Visibility
  ) => {
    await save(
      () => updateCategory(id, { name, visibility }),
      () => setEditingId(null),
      'Could not update category. Try again.'
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await save(
      () => deleteCategory(deleteId),
      () => setDeleteId(null),
      'Could not delete category. Try again.'
    );
  };

  const handleCancelDelete = () => {
    setDeleteId(null);
  };

  const resetForm = () => {
    setIsAdding(false);
    setNewName('');
    setNewColor('#3B82F6');
    setNewVisibility('private');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
    setEditVisibility('private');
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Categories" height="full" preventDismiss={isSaving}>
      <div className="pt-2 pb-8 px-4">
        <SheetErrorBanner message={error} />
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
              overriddenCount={overriddenCounts.get(cat.id) ?? 0}
              onEditStart={(c) => {
                setEditingId(c.id);
                setEditName(c.name);
                setEditVisibility(c.visibility);
              }}
              onDeleteRequest={(id) => setDeleteId(id)}
              onReorderEnd={() => {
                if (!isSaving) void reorderCategories(pendingOrder.current);
              }}
              disabled={isSaving}
            />
          ))}
        </Reorder.Group>

        {editingId && (
          <div className="mt-4 p-3 bg-[#1A1A1A] rounded-lg space-y-3">
            <Input
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <VisibilityPicker
              value={editVisibility}
              onChange={setEditVisibility}
            />
            <Button
              onClick={() => handleUpdate(editingId, editName, editVisibility)}
              disabled={!editName.trim() || isSaving}
            >
              Save Changes
            </Button>
            <Button variant="ghost" onClick={handleEditCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
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
            onClick={() => setIsAdding(true)}
            disabled={isSaving}
            className="mt-4 w-full"
          >
            <Plus size={16} />
            Add Category
          </Button>
        )}

        {deleteId && (
          <div className="mt-4 p-3 bg-[#1A1A1A] rounded-lg space-y-3">
            <p className="text-white">Delete this category?</p>
            <p className="text-sm text-gray-400">
              Tasks in this category will be moved to the default category.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleCancelDelete} className="flex-1" disabled={isSaving}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} className="flex-1" disabled={isSaving}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
