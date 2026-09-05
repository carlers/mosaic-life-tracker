import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPalettePicker } from '../ui/ColorPalettePicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, Save, X, Eye, EyeOff, Users } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';

type Visibility = 'private' | 'followers' | 'public';

export const CategoryManagerSheet: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const { categories, addCategory, updateCategory, deleteCategory, isLoading } = useCategories();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newVisibility, setNewVisibility] = useState<Visibility>('private');

  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<Visibility>('private');

  const handleSaveNew = async () => {
    if (!newName.trim()) return;
    await addCategory({
      name: newName.trim(),
      color: newColor,
      visibility: newVisibility,
      order: categories.length,
    });
    resetForm();
  };

  const handleUpdate = async (id: string, name: string, visibility: Visibility) => {
    await updateCategory(id, { name: name.trim(), visibility });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure? This will hide the category and its tasks.')) {
      await deleteCategory(id);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setNewName('');
    setNewColor('#3B82F6');
    setNewVisibility('private');
  };

  const handleEditStart = (cat: { id: string; name: string; visibility?: Visibility }) => {
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
      case 'public': return <Eye size={14} className="text-gray-400" />;
      case 'followers': return <Users size={14} className="text-gray-400" />;
      case 'private': return <EyeOff size={14} className="text-gray-400" />;
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Lists & Categories" height="auto">
      <div className="pt-2 pb-8 px-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* FIX: Category List or Empty State */}
            {!isAdding && (
              <div className="space-y-3 mb-6">
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No categories yet. Create your first one below!
                  </div>
                ) : (
                  categories.map((cat) => {
                    const isEditing = editingId === cat.id;
                    return (
                      <div key={cat.id} className="bg-[#1E1E1E] rounded-xl border border-[#333333] p-3">
                        {isEditing ? (
                          <div className="space-y-3">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="text-sm py-2"
                            />
                            <div className="flex items-center justify-between">
                              <div className="flex bg-[#111111] rounded-lg p-0.5 border border-[#333333]">
                                {(['private', 'followers', 'public'] as Visibility[]).map((v) => (
                                  <button
                                    key={v}
                                    onClick={() => setEditVisibility(v)}
                                    className={`p-1.5 rounded-md transition-colors ${editVisibility === v ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}
                                    title={v}
                                  >
                                    {getVisibilityIcon(v)}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Button variant="ghost" className="p-2" onClick={handleEditCancel}>
                                  <X size={16} />
                                </Button>
                                <Button variant="primary" className="p-2" onClick={() => handleUpdate(cat.id, editName, editVisibility)}>
                                  <Save size={16} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="flex-1 text-sm font-medium text-white truncate">{cat.name}</span>
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider">
                              {getVisibilityIcon(cat.visibility || 'private')}
                              <span>{cat.visibility || 'private'}</span>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" className="p-2 h-8 w-8" onClick={() => handleEditStart(cat)}>
                                <span className="text-xs font-bold">Edit</span>
                              </Button>
                              <Button variant="ghost" className="p-2 h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => handleDelete(cat.id)}>
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

            {/* FIX: Add Category Form or Button (Always visible at the bottom) */}
            {isAdding ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <Input
                  label="Category Name"
                  placeholder="e.g., Work, Fitness, Reading"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <div>
                  <label className="block text-xs text-gray-500 mb-2 ml-1">Color</label>
                  <ColorPalettePicker selectedColor={newColor} onSelect={setNewColor} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-2 ml-1">Visibility</label>
                  <div className="flex bg-[#111111] rounded-lg p-1 border border-[#333333]">
                    {(['private', 'followers', 'public'] as Visibility[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setNewVisibility(v)}
                        className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${newVisibility === v ? 'bg-[#2A2A2A] text-white' : 'text-gray-500'}`}
                      >
                        {getVisibilityIcon(v)}
                        <span className="capitalize">{v}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="ghost" className="flex-1" onClick={resetForm}>Cancel</Button>
                  <Button variant="primary" className="flex-1" onClick={handleSaveNew} disabled={!newName.trim()}>
                    Create Category
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="primary" className="w-full gap-2 py-3" onClick={() => setIsAdding(true)}>
                <Plus size={18} />
                Add New Category
              </Button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
};