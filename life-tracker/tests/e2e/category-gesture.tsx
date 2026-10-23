import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { DayViewCategoryReorder } from '../../src/components/home/views/DayViewCategoryReorder';
import { CategorySection } from '../../src/components/home/views/CategorySection';
import type { CategoryDocument } from '../../src/db/schema';

const original: CategoryDocument[] = ['Work', 'Home', 'Personal'].map((name, order) => ({
  id: name.toLowerCase(), name, order, userId: 'owner', color: '#34D399',
  icon: '', visibility: 'private', isDeleted: false,
  updatedAt: '2026-10-01T00:00:00.000Z',
}));

export function CategoryGestureProbe() {
  const [categories, setCategories] = useState(original);
  const [dragActive, setDragActive] = useState(false);
  return (
    <main className="min-h-screen bg-background p-5 text-white" data-testid="category-gesture-probe">
      <output data-testid="category-drag-active">{dragActive ? 'yes' : 'no'}</output>
      <output data-testid="category-order">{categories.map(c => c.id).join(',')}</output>
      <DayViewCategoryReorder
        categories={categories}
        enabled
        canStartDrag
        onDragActiveChange={setDragActive}
        onCommit={async next => {
          setCategories(next.map((category, order) => ({ ...category, order })));
        }}
        onUpdate={async (id, changes) => {
          setCategories(current => current.map(c => c.id === id ? { ...c, ...changes } : c));
        }}
        renderCategory={category => (
          <div style={{ minHeight: 150 }}>
            <CategorySection
              categoryId={category.id}
              categoryName={category.name}
              categoryColor={category.color}
              visibility={category.visibility}
              currentUserId="owner"
              tasks={[]}
              editingTaskId={null}
              editValue=""
              onToggleTask={() => {}}
              onAddTask={() => {}}
              onOpenActions={() => {}}
              onOpenMemo={() => {}}
              onEditTask={() => {}}
              onEditChange={() => {}}
              onEditSave={() => {}}
              onEditCancel={() => {}}
            />
          </div>
        )}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing category gesture root');
createRoot(root).render(<CategoryGestureProbe />);
