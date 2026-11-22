import React, { lazy, Suspense, useState } from 'react';
import { addDays, format } from 'date-fns';
import { TaskActionSheet } from './TaskActionSheet';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { useTaskImage } from '../../../hooks/useTaskImage';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';

const MemoSheet = lazy(() => import('./MemoSheet').then(m => ({ default: m.MemoSheet })));
const VisibilitySheet = lazy(() => import('./TaskVisibilitySheet').then(m => ({ default: m.TaskVisibilitySheet })));
const ShareSheet = lazy(() => import('./ShareTaskSheet').then(m => ({ default: m.ShareTaskSheet })));
const ImagePicker = lazy(() => import('./ImagePickerSheet').then(m => ({ default: m.ImagePickerSheet })));
const ImageViewer = lazy(() => import('./ImageViewer').then(m => ({ default: m.ImageViewer })));

export type CategoryTaskActionMode =
  | 'actions' | 'memo-view' | 'memo-edit' | 'visibility' | 'share'
  | 'image-picker' | 'image-view' | 'delete-photo' | 'confirm-delete' | null;

interface Props {
  task: TaskDocument | null;
  category: CategoryDocument | null;
  mode: CategoryTaskActionMode;
  setMode: (next: CategoryTaskActionMode) => void;
  onEdit: (task: TaskDocument) => void;
  onError: (message: string) => void;
  updateTask: (id: string, updates: Partial<TaskDocument>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  removeTaskPhoto: (id: string, expectedImageId: string) => Promise<void>;
  replaceTaskPhoto: (id: string, fileId: string, expectedImageId: string) => Promise<void>;
}

export const CategoryTaskActions: React.FC<Props> = ({
  task, category, mode, setMode, onEdit, onError,
  updateTask, deleteTask, removeTaskPhoto, replaceTaskPhoto,
}) => {
  const [processing, setProcessing] = useState(false);
  const image = useTaskImage(task?.image, mode === 'image-view');
  const close = () => setMode(null);
  const mutate = async (action: () => Promise<unknown>, error: string) => {
    try { await action(); close(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : error); }
  };
  const change = async (date: string) => {
    if (task) await updateTask(task.id, { date });
    close();
  };
  const remove = async () => {
    if (!task || processing) return;
    setProcessing(true);
    try { await deleteTask(task.id); close(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'Could not delete task'); }
    finally { setProcessing(false); }
  };
  const removePhoto = async () => {
    if (!task?.image || processing) return;
    setProcessing(true);
    try { await removeTaskPhoto(task.id, task.image); close(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'Could not remove photo'); }
    finally { setProcessing(false); }
  };
  return <>
    <TaskActionSheet
      isOpen={mode === 'actions' && !!task}
      onClose={close}
      task={task}
      category={category}
      onEdit={() => { if (task) onEdit(task); close(); }}
      onDelete={() => setMode('confirm-delete')}
      onMemo={() => setMode('memo-edit')}
      onChangeDate={change}
      onVisibility={() => setMode('visibility')}
      onShare={() => setMode('share')}
      onAddPhoto={() => setMode('image-picker')}
      onViewPhoto={() => setMode('image-view')}
      onDeletePhoto={() => setMode('delete-photo')}
      onDoItTomorrowOrToday={() => { if (task) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        void mutate(() => updateTask(task.id, { date: task.date === today ? tomorrow : today }), 'Could not move task');
      } }}
      onMoveToBacklog={() => { if (task) void mutate(() => updateTask(task.id, { date: '' }), 'Could not move task'); }}
    />
    <Suspense fallback={null}>
      {task && <MemoSheet isOpen={mode === 'memo-view' || mode === 'memo-edit'} onClose={close}
        task={task} initialMode={mode === 'memo-view' ? 'view' : 'edit'}
        onSave={(memo, visibility) => { void mutate(() => updateTask(task.id, { memo, visibility }), 'Could not save memo'); }} />}
      {task && <VisibilitySheet isOpen={mode === 'visibility'} onClose={close} task={task} category={category}
        onSave={visibility => { void mutate(() => updateTask(task.id, { visibility }), 'Could not update visibility'); }} />}
      {task && <ShareSheet isOpen={mode === 'share'} onClose={close} task={task} />}
      {task && <ImagePicker isOpen={mode === 'image-picker'} onClose={close}
        variant="task" title={task.title} hasExistingImage={!!task.image}
        existingFileId={task.image || ''}
        onSave={async (fileId, expected) => { await replaceTaskPhoto(task.id, fileId, expected); close(); }}
        onRemove={async () => { if (task.image) await removeTaskPhoto(task.id, task.image); close(); }} />}
      {task && <ImageViewer isOpen={mode === 'image-view'} onClose={close}
        imageUrl={image.imageUrl} taskTitle={task.title} taskDate={task.date} />}
    </Suspense>
    <ConfirmSheet isOpen={mode === 'confirm-delete' && !!task} onClose={close}
      title="Delete Task" message="Remove this task from your calendar?"
      confirmLabel="Delete" destructive isProcessing={processing} onConfirm={() => { void remove(); }} />
    <ConfirmSheet isOpen={mode === 'delete-photo' && !!task} onClose={close}
      title="Remove Photo" message="Remove this photo from the task? The stored file may remain for offline and shared references."
      confirmLabel="Remove" destructive isProcessing={processing} onConfirm={() => { void removePhoto(); }} />
  </>;
};
