import React, { useState, useMemo } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPalettePicker } from '../ui/ColorPalettePicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Plus,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Users,
  RotateCcw,
} from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useTasks } from '../../hooks/useTasks';

type Visibility = 'private' | 'followers' | 'public';

export const CategoryManagerSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    isLoading,
  } = useCategories();
  const { tasks, updateTask } = useTasks();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newVisibility, setNewVisibility] = useState<Visibility>('private');
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  // Count of tasks in each category that currently have an explicit (non-inheriting) visibility
  const overriddenTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (task.visibility === '') continue;
      counts[task.categoryId] = (counts[task.categoryId] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  const handleSaveNew = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      await addCategory({
        name: newName.trim(),
        color: newColor,
        visibility: newVisibility,
        order: categories.length,
      });
      resetForm();
    } catch (error) {
      console.error('[CategoryManagerSheet] Failed to save category:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string, name: string, visibility: Visibility) => {
    await updateCategory(id, { name: name.trim(), visibility });
    setEditingId(null);
    showFeedback('Category updated');
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setIsDeleting(true);
    try {
      await deleteCategory(pendingDeleteId);
      setPendingDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setPendingDeleteId(null);
  };

  const handleResetTasks = async (categoryId: string) => {
    const toReset = tasks.filter(
      (t) => t.categoryId === categoryId && t.visibility !== ''
    );
    if (toReset.length === 0) return;
    setIsResetting(true);
    try {
      await Promise.all(toReset.map((t) => updateTask(t.id, { visibility: '' })));
      showFeedback(
        `Reset ${toReset.length} task${toReset.length === 1 ? '' : 's'}`
      );
    } catch (err) {
      console.error('[CategoryManagerSheet] Reset failed:', err);
      showFeedback('Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setNewName('');
    setNewColor('#3B82F6');
    setNewVisibility('private');
  };

  const handleEditStart = (cat: {
    id: string;
    name: string;
    visibility?: Visibility;
  }) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditVisibility(cat.visibility || 'private');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
    setEditVisibility('private');
  };

  const getVisibilityIcon = (v: Visibility) => {
    switch (v) {
      case 'public':
        return <Eye size={14} className="text-gray-400" />;
      case 'followers':
        return <Users size={14} className="text-gray-400" />;
      case 'private':
        return <EyeOff size={14} className="text-gray-400" />;
    }
  };

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title="Lists & Categories"
        height="auto"
        isLocked={!!pendingDeleteId}
      >
        <div className="pt-2 pb-8 px-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {!isAdding && (
                <div className="space-y-3 mb-6">
                  {categories.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No categories yet. Create your first one below!
                    </div>
                  ) : (
                    categories.map((cat) => {
                      const isEditing = editingId === cat.id;
                      const overriddenCount = overriddenTaskCounts[cat.id] || 0;
                      return (
                        <div
                          key={cat.id}
                          className="bg-[#1E1E1E] rounded-xl border border-[#333333] p-3"
                        >
                          {isEditing ? (
                            <div className="space-y-3">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="text-sm py-2"
                              />
                              <div className="flex items-center justify-between">
                                <div className="flex bg-[#111111] rounded-lg p-0.5 border border-[#333333]">
                                  {(
                                    ['private', 'followers', 'public'] as Visibility[]
                                  ).map((v) => (
                                    <button
                                      key={v}
                                      onClick={() => setEditVisibility(v)}
                                      className={`p-1.5 rounded-md transition-colors ${
                                        editVisibility === v
                                          ? 'bg-[#2A2A2A] text-white'
                                          : 'text-gray-500'
                                      }`}
                                      title={v}
                                    >
                                      {getVisibilityIcon(v)}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    className="p-2"
                                    onClick={handleEditCancel}
                                  >
                                    <X size={16} />
                                  </Button>
                                  <Button
                                    variant="primary"
                                    className="p-2"
                                    onClick={() =>
                                      handleUpdate(cat.id, editName, editVisibility)
                                    }
                                  >
                                    <Save size={16} />
                                  </Button>
                                </div>
                              </div>

                              {overriddenCount > 0 && (
                                <div className="pt-2 border-t border-[#333333]">
                                  <button
                                    onClick={() => handleResetTasks(cat.id)}
                                    disabled={isResetting}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                                  >
                                    {isResetting ? (
                                      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <RotateCcw size={12} />
                                    )}
                                    <span>
                                      Reset {overriddenCount} task
                                      {overriddenCount === 1 ? '' : 's'} to follow
                                      this category
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="flex-1 text-sm font-medium text-white truncate">
                                {cat.name}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider">
                                {getVisibilityIcon(cat.visibility || 'private')}
                                <span>{cat.visibility || 'private'}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  className="p-2 h-8 w-8"
                                  onClick={() => handleEditStart(cat)}
                                >
                                  <span className="text-xs font-bold">Edit</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="p-2 h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                  onClick={() => handleDeleteRequest(cat.id)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {isAdding ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <Input
                    label="Category Name"
                    placeholder="e.g., Work, Fitness, Reading"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 ml-1">
                      Color
                    </label>
                    <ColorPalettePicker
                      selectedColor={newColor}
                      onSelect={setNewColor}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 ml-1">
                      Visibility
                    </label>
                    <div className="flex bg-[#111111] rounded-lg p-1 border border-[#333333]">
                      {(
                        ['private', 'followers', 'public'] as Visibility[]
                      ).map((v) => (
                        <button
                          key={v}
                          onClick={() => setNewVisibility(v)}
                          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                            newVisibility === v
                              ? 'bg-[#2A2A2A] text-white'
                              : 'text-gray-500'
                          }`}
                        >
                          {getVisibilityIcon(v)}
                          <span className="capitalize">{v}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="ghost" className="flex-1" onClick={resetForm}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={handleSaveNew}
                      disabled={!newName.trim() || isSaving}
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Create Category'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  className="w-full gap-2 py-3"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus size={18} />
                  Add New Category
                </Button>
              )}
            </>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={!!pendingDeleteId}
        onClose={handleCancelDelete}
        title="Delete Category"
        height="auto"
        isLocked={true}
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-gray-300 text-sm text-center mb-6 leading-relaxed">
            Are you sure you want to delete this category? Its tasks will be hidden.
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancelDelete}
              disabled={isDeleting}
              className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </BottomSheet>

      {feedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          {feedback}
        </div>
      )}
    </>
  );
};