import React, { useState, useMemo } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPalettePicker } from '../ui/ColorPalettePicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, Save, GripVertical } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useTasks } from '../../hooks/useTasks';
import { visibilityIcon } from '../../lib/visibility';
import type { CategoryDocument } from '../../db/schema';

type Visibility = 'private' | 'followers' | 'public';

interface CategoryRowProps {
  cat: CategoryDocument;
  overriddenCount: number;
  onEditStart: (cat: CategoryDocument) => void;
  onDeleteRequest: (id: string) => void;
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  cat,
  overriddenCount,
  onEditStart,
  onDeleteRequest,
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-3 py-3 px-2 bg-[#1A1A1A] rounded-lg"
    >
      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          dragControls.start(e);
        }}
        className="text-gray-500 cursor-grab"
        aria-label="Drag to reorder"
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
          <span className="text-xs text-gray-500">
            {overriddenCount} task{overriddenCount === 1 ? '' : 's'} override
            visibility
          </span>
        )}
      </div>
      <button
        onClick={() => onEditStart(cat)}
        className="p-2 text-gray-400"
        aria-label="Edit category"
      >
        <Save size={16} />
      </button>
      <button
        onClick={() => onDeleteRequest(cat.id)}
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

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newVisibility, setNewVisibility] = useState<Visibility>('private');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [syncedIsOpen, setSyncedIsOpen] = useState(isOpen);
  if (isOpen !== syncedIsOpen) {
    setSyncedIsOpen(isOpen);
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
    await addCategory({
      name: newName.trim(),
      color: newColor,
      visibility: newVisibility,
      order: categories.length,
      icon: '',
    });
    setIsAdding(false);
    setNewName('');
    setNewColor('#3B82F6');
    setNewVisibility('private');
  };

  const handleUpdate = async (
    id: string,
    name: string,
    visibility: Visibility
  ) => {
    await updateCategory(id, { name, visibility });
    setEditingId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await deleteCategory(deleteId);
    setDeleteId(null);
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
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Categories" height="full">
      <div className="pt-2 pb-8 px-4">
        <Reorder.Group
          axis="y"
          values={categories}
          onReorder={(newOrder) => {
            reorderCategories(newOrder);
          }}
          className="space-y-2"
        >
          {categories.map((cat) => (
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
            <Button
              onClick={() => handleUpdate(editingId, editName, editVisibility)}
              disabled={!editName.trim()}
            >
              Save Changes
            </Button>
            <Button variant="ghost" onClick={handleEditCancel}>
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
            <Button onClick={handleSaveNew} disabled={!newName.trim()}>
              Add Category
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setIsAdding(true)}
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
              <Button variant="ghost" onClick={handleCancelDelete} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} className="flex-1">
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
