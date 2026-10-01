import type { TaskDocument } from '../db/schema';

// Mock categories for visualization
export const mockCategories = {
  'cat-1': { id: 'cat-1', name: 'Work', color: '#3B82F6', order: 0 },
  'cat-2': { id: 'cat-2', name: 'Personal', color: '#10B981', order: 1 },
  'cat-3': { id: 'cat-3', name: 'Fitness', color: '#F59E0B', order: 2 },
  'cat-4': { id: 'cat-4', name: 'Learning', color: '#8B5CF6', order: 3 },
};

// Generate mock tasks for the current month
export const generateMockTasks = (): TaskDocument[] => {
  const today = new Date();
  const tasks: TaskDocument[] = [];
  
  // Create some tasks scattered across the month
  const taskTemplates = [
    { title: 'Setup project', categoryId: 'cat-1', completed: true, date: 1 },
    { title: 'Team meeting', categoryId: 'cat-1', completed: true, date: 1 },
    { title: 'Buy groceries', categoryId: 'cat-2', completed: false, date: 2 },
    { title: 'Gym workout', categoryId: 'cat-3', completed: true, date: 3 },
    { title: 'Read chapter 5', categoryId: 'cat-4', completed: false, date: 5 },
    { title: 'Code review', categoryId: 'cat-1', completed: true, date: 7 },
    { title: 'Meal prep', categoryId: 'cat-2', completed: false, date: 8 },
    { title: 'Running', categoryId: 'cat-3', completed: true, date: 10 },
    { title: 'Watch tutorial', categoryId: 'cat-4', completed: true, date: 12 },
    { title: 'Client call', categoryId: 'cat-1', completed: false, date: 14 },
    { title: 'Clean room', categoryId: 'cat-2', completed: true, date: 15 },
    { title: 'Leg day', categoryId: 'cat-3', completed: false, date: 17 },
    { title: 'Study notes', categoryId: 'cat-4', completed: true, date: 19 },
    { title: 'Deploy app', categoryId: 'cat-1', completed: true, date: 21 },
    { title: 'Laundry', categoryId: 'cat-2', completed: false, date: 22 },
    { title: 'Yoga', categoryId: 'cat-3', completed: true, date: 24 },
    { title: 'Practice coding', categoryId: 'cat-4', completed: false, date: 26 },
    { title: 'Sprint planning', categoryId: 'cat-1', completed: true, date: 28 },
    { title: 'Date night', categoryId: 'cat-2', completed: false, date: 30 },
  ];

  taskTemplates.forEach((template, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), template.date);
    
    tasks.push({
      id: `task-${index}`,
      title: template.title,
      completed: template.completed,
      categoryId: template.categoryId,
      order: index,
      date: date.toISOString().split('T')[0], // YYYY-MM-DD format
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
      userId: 'user1',
      isDeleted: false,
      visibility: 'private',
      tags: '',
      memo: '',
      image: index % 5 === 0 ? 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=100&h=100&fit=crop' : undefined,
      source: '',
      routineId: undefined,
      reminderTime: undefined,
      reactions: undefined,
    });
  });

  return tasks;
};