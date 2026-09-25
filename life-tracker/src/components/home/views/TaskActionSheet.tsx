import React from 'react';
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
} from 'lucide-react';
import { isToday } from 'date-fns';
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
  onChangeDate: () => void;
  onVisibility: () => void;
  onAddPhoto: () => void;
  onViewPhoto: () => void;
  onDeletePhoto: () => void;
  onDoItTomorrowOrToday: () => void;
}

export const TaskActionSheet: React.FC<TaskActionSheetProps> = ({
  isOpen,
  onClose,
  task,
  category,
  onEdit,
  onDelete,
  onMemo,
  onChangeDate,
  onVisibility,
  onAddPhoto,
  onViewPhoto,
  onDeletePhoto,
  onDoItTomorrowOrToday,
}) => {
  if (!task) return null;

  const isTaskToday = isToday(new Date(task.date));
  const tomorrowOrTodayLabel = isTaskToday ? 'Do It Tomorrow' : 'Do It Today';

  const effective = resolveVisibility(task.visibility, category?.visibility);
  const inheriting = isInheriting(task.visibility);
  const visibilityLabel = inheriting
    ? `${labelForVisibility(effective as TaskVisibility)} · Default`
    : labelForVisibility(effective as TaskVisibility);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={task.title}
      height="auto"
      backdropBlur
    >
      <div className="pt-2 pb-8 px-4">
        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={onEdit}
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

          {!task.image && (
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
            onClick={() => {
              onChangeDate();
              onClose();
            }}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <RotateCcw size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Change Date</span>
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

          <button
            type="button"
            onClick={() => alert('Move to Backlog coming soon')}
            className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <div
              className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center"
              aria-hidden="true"
            >
              <Archive size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Move to Backlog</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
