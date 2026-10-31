import React, { useRef, useState } from 'react';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
const LazyTaskDateEditor = React.lazy(() => import('./TaskDateEditor').then(m => ({ default: m.TaskDateEditor })));
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { BottomSheet } from '../../ui/BottomSheet';
import {
  Pencil,
  Trash2,
  FileText,
  Clock,
  ArrowRight,
  RotateCcw,
  CheckCircle,
  Archive,
  Image as ImageIcon,
  Eye,
  Copy,
  Link2,
  Users,
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import {
  resolveVisibility,
  isInheriting,
  labelForVisibility,
  type TaskVisibility,
} from '../../../lib/visibility';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';

interface TaskActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  category: CategoryDocument | null;
  onEdit: () => void;
  onDelete: () => void;
  onMemo: () => void;
  onChangeDate: (date: string) => Promise<unknown> | unknown;
  onVisibility: () => void;
  onShare: () => void;
  onAddPhoto: () => void;
  onViewPhoto: () => void;
  onDeletePhoto: () => void;
  onDoItTomorrowOrToday: () => void;
  onMoveToBacklog: () => void;
  onLinkToBucketList?: () => void;
}

export const TaskActionSheet: React.FC<TaskActionSheetProps> = ({
  isOpen,
  onClose,
  task: incomingTask,
  category,
  onEdit,
  onDelete,
  onMemo,
  onChangeDate,
  onVisibility,
  onShare,
  onAddPhoto,
  onViewPhoto,
  onDeletePhoto,
  onDoItTomorrowOrToday,
  onMoveToBacklog,
  onLinkToBucketList,
}) => {
  const taskPhotoUploadEnabled = useFeatureEnabled('taskPhotoUpload');
  const { value: task, onExitComplete } = useRetainedSheetValue(incomingTask, isOpen);
  const [dateMode, setDateMode] = useState(false);
  const pendingEditRef = useRef(false);
  const dismiss = () => { setDateMode(false); onClose(); };

  if (!task) return null;

  // Task dates are local calendar days, never UTC-midnight timestamps.
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
  const isTaskToday = task.date === today;
  const tomorrowOrTodayLabel = isTaskToday ? 'Do It Tomorrow' : 'Do It Today';

  const effective = resolveVisibility(task.visibility, category?.visibility);
  const inheriting = isInheriting(task.visibility);
  const visibilityLabel = inheriting
    ? `${labelForVisibility(effective as TaskVisibility)} · Default`
    : labelForVisibility(effective as TaskVisibility);

  const handleCopyTaskText = async () => {
    try {
      await navigator.clipboard.writeText(task.title);
      onClose();
    } catch {
      // Clipboard access can be unavailable outside a secure browser context.
    }
  };

  const handleEdit = () => {
    // Wait for the exit animation and focus-trap teardown before mounting
    // the inline task editor. A zero-delay timer can race with focus return.
    pendingEditRef.current = true;
    onClose();
  };

  const handleExitComplete = () => {
    onExitComplete();
    if (!pendingEditRef.current) return;
    pendingEditRef.current = false;
    // BottomSheet releases the inert app tree and restores the prior focused
    // trigger on the next animation frame. Enter edit mode after that return.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(onEdit);
    });
  };

  return (
    <BottomSheet onExitComplete={handleExitComplete}
      isOpen={isOpen}
      onClose={dismiss}
      onTransientDismiss={() => {
        if (!dateMode) return false;
        setDateMode(false);
        return true;
      }}
      title={dateMode ? 'Change Date' : task.title}
      height="auto"
      backdropBlur
    >
      {dateMode ? (
        <React.Suspense fallback={null}><LazyTaskDateEditor key={task.id} initialDate={task.date}
          onCancel={() => setDateMode(false)}
          onSave={async date => { await onChangeDate(date); dismiss(); }} /></React.Suspense>
      ) : <div className="pt-2 pb-8 px-4">
        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={handleEdit}
            className="flex flex-col items-center justify-center gap-2 py-4 bg-[#2A2A2A] rounded-xl hover:bg-[#333333] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <Pencil size={20} className="text-blue-400" aria-hidden="true" />
            <span className="text-sm text-white">Edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex flex-col items-center justify-center gap-2 py-4 bg-[#2A2A2A] rounded-xl hover:bg-[#333333] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <Trash2 size={20} className="text-red-400" aria-hidden="true" />
            <span className="text-sm text-white">Delete</span>
          </button>
        </div>

        {/* Visibility row */}
        <button
          type="button"
          onClick={() => {
            onVisibility();
            onClose();
          }}
          className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          <div
            className="w-8 h-8 rounded-full bg-purple-400 flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <Eye size={16} className="text-black" />
          </div>
          <span className="text-base font-medium flex-1 text-left">Visibility</span>
          <span className="text-xs text-gray-400">{visibilityLabel}</span>
        </button>

        {task.date !== '' && <button
          type="button"
          onClick={() => { onShare(); onClose(); }}
          className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          <div className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center" aria-hidden="true">
            <Users size={16} className="text-white" />
          </div>
          <span className="text-base font-medium flex-1 text-left">Share with friends</span>
        </button>}

        {/* Memo section */}
        {task.memo && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center"
                aria-hidden="true"
              >
                <FileText size={16} className="text-black" />
              </div>
              <h3 className="text-lg font-semibold text-white">Memo</h3>
            </div>
            <button
              type="button"
              onClick={onMemo}
              aria-label="Open memo"
              className="block w-full text-left bg-[#1A1A1A] rounded-xl p-4 cursor-pointer hover:bg-[#222222] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <span className="text-sm text-gray-300 whitespace-pre-wrap">
                {task.memo}
              </span>
            </button>
          </div>
        )}

        {/* Actions list */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={handleCopyTaskText}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center"
              aria-hidden="true"
            >
              <Copy size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Copy Task Text</span>
          </button>

          {onLinkToBucketList && <button type="button" onClick={() => { onClose(); onLinkToBucketList(); }}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-surfaceHighlight text-foreground focus-visible:ring-2 focus-visible:ring-current">
            <span className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center"><Link2 size={16} aria-hidden="true"/></span>
            <span className="text-base font-medium">Link to Bucket List</span>
          </button>}
          {!task.memo && (
            <button
              type="button"
              onClick={() => {
                onMemo();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <div
                className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center"
                aria-hidden="true"
              >
                <FileText size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">Memo</span>
            </button>
          )}

          {!task.image && taskPhotoUploadEnabled && (
            <button
              type="button"
              onClick={() => {
                onAddPhoto();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <div
                className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center"
                aria-hidden="true"
              >
                <ImageIcon size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">Add Photo</span>
            </button>
          )}

          {task.image && (
            <button
              type="button"
              onClick={() => {
                onViewPhoto();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <div
                className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center"
                aria-hidden="true"
              >
                <ImageIcon size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">View Photo</span>
            </button>
          )}

          {task.image && (
            <button
              type="button"
              onClick={() => {
                onDeletePhoto();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <div
                className="w-8 h-8 rounded-full bg-red-400 flex items-center justify-center"
                aria-hidden="true"
              >
                <Trash2 size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">Delete Photo</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => alert('Set Alarm coming soon')}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <Clock size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Set Alarm</span>
          </button>

          <button
            type="button"
            onClick={() => alert('Open Timer coming soon')}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <Clock size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Open Timer</span>
          </button>

          {task.date !== yesterday && <button
            type="button"
            onClick={async () => {
              await onChangeDate(yesterday);
              dismiss();
            }}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center" aria-hidden="true">
              <ArrowRight size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Do It Yesterday</span>
          </button>}

          <button
            type="button"
            onClick={() => {
              onDoItTomorrowOrToday();
              onClose();
            }}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <ArrowRight size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">{tomorrowOrTodayLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setDateMode(true)}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <RotateCcw size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">{task.date === '' ? 'Schedule' : 'Change Date'}</span>
          </button>

          <button
            type="button"
            onClick={() => alert('Make It a Routine coming soon')}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <CheckCircle size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Make It a Routine</span>
          </button>

          {task.date !== '' && <button
            type="button"
            onClick={() => { onMoveToBacklog(); onClose(); }}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <Archive size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Move to Backlog</span>
          </button>}
        </div>
      </div>}
    </BottomSheet>
  );
};
