import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { BottomSheet } from '../../ui/BottomSheet';
import { CategorySection } from './CategorySection';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';

interface DayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
}

export const DayViewSheet: React.FC<DayViewSheetProps> = ({ 
  isOpen, 
  onClose, 
  selectedDate 
}) => {
  const { tasks, addTask, toggleTaskCompletion } = useTasks();
  const { categories } = useCategories();

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    await toggleTaskCompletion(taskId, !currentStatus);
  };

  const handleAddTask = async (title: string, categoryId: string) => {
    await addTask({
      title,
      categoryId,
      date: format(selectedDate, 'yyyy-MM-dd'),
      completed: false,
      visibility: 'private',
      tags: '',
      memo: '',
      source: '',
    });
  };

  // Filter tasks for the selected date
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTasks = tasks.filter(t => t.date === dateStr);

  // Group tasks by categoryId
  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof dayTasks> = {};
    dayTasks.forEach(task => {
      if (!groups[task.categoryId]) {
        groups[task.categoryId] = [];
      }
      groups[task.categoryId].push(task);
    });
    return groups;
  }, [dayTasks]);

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose}
      title={format(selectedDate, 'EEEE, MMMM d')}
      height="auto"
    >
      <div className="pt-2 pb-8">
        {categories.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            Create a category to start adding tasks.
          </div>
        ) : (
          categories.map((category) => (
            <CategorySection
              key={category.id}
              categoryName={category.name}
              categoryColor={category.color}
              tasks={groupedTasks[category.id] || []}
              onToggleTask={(taskId, status) => handleToggleTask(taskId, status)}
              onAddTask={(title) => handleAddTask(title, category.id)}
            />
          ))
        )}
      </div>
    </BottomSheet>
  );
};