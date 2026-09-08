import React from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Pencil, Trash2, FileText, Clock, ArrowRight, RotateCcw, CheckCircle, Archive, Image as ImageIcon } from 'lucide-react';
import { isToday } from 'date-fns';
import type { TaskDocument } from '../../../db/schema';

interface TaskActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  onEdit: () => void;
  onDelete: () => void;
  onMemo: () => void;
  onChangeDate: () => void;
  onViewPhoto: () => void;
  onDeletePhoto: () => void;
  onDoItTomorrowOrToday: () => void;
}

export const TaskActionSheet: React.FC<TaskActionSheetProps> = ({
  isOpen,
  onClose,
  task,
  onEdit,
  onDelete,
  onMemo,
  onChangeDate,
  onViewPhoto,
  onDeletePhoto,
  onDoItTomorrowOrToday
}) => {
  if (!task) return null;

  const isTaskToday = isToday(new Date(task.date));
  const tomorrowOrTodayLabel = isTaskToday ? 'Do It Tomorrow' : 'Do It Today';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={task.title} height="auto">
      <div className="pt-2 pb-8 px-4">
        {/* Edit/Delete Buttons Side by Side */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button onClick={onEdit} className="flex flex-col items-center justify-center gap-2 py-4 bg-[#2A2A2A] rounded-xl hover:bg-[#333333] transition-colors">
            <Pencil size={20} className="text-blue-400" />
            <span className="text-sm text-white">Edit</span>
          </button>
          <button onClick={onDelete} className="flex flex-col items-center justify-center gap-2 py-4 bg-[#2A2A2A] rounded-xl hover:bg-[#333333] transition-colors">
            <Trash2 size={20} className="text-red-400" />
            <span className="text-sm text-white">Delete</span>
          </button>
        </div>

        {/* Memo Section - Only show if memo exists */}
        {task.memo && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center">
                <FileText size={16} className="text-black" />
              </div>
              <h3 className="text-lg font-semibold text-white">Memo</h3>
            </div>
            <div onClick={onMemo} className="bg-[#1A1A1A] rounded-xl p-4 cursor-pointer hover:bg-[#222222] transition-colors">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{task.memo}</p>
            </div>
          </div>
        )}

        {/* Action Items */}
        <div className="space-y-1">
          {/* Memo Button - Only show if NO memo exists yet */}
          {!task.memo && (
            <button onClick={() => { onMemo(); onClose(); }} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center">
                <FileText size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">Memo</span>
            </button>
          )}
          
          {/* View Photo Button - Replaces the inline preview */}
          {task.image && (
            <button onClick={() => { onViewPhoto(); onClose(); }} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
              <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
                <ImageIcon size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">View Photo</span>
            </button>
          )}

          {/* Delete Photo Button - Only show if photo exists */}
          {task.image && (
            <button onClick={() => { onDeletePhoto(); onClose(); }} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
              <div className="w-8 h-8 rounded-full bg-red-400 flex items-center justify-center">
                <Trash2 size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">Delete Photo</span>
            </button>
          )}

          <button onClick={() => alert('Set Alarm coming soon')} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
            <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center">
              <Clock size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Set Alarm</span>
          </button>
          <button onClick={() => alert('Open Timer coming soon')} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
            <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center">
              <Clock size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Open Timer</span>
          </button>
          <button onClick={() => { onDoItTomorrowOrToday(); onClose(); }} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
            <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center">
              <ArrowRight size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">{tomorrowOrTodayLabel}</span>
          </button>
          <button onClick={() => { onChangeDate(); onClose(); }} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
            <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center">
              <RotateCcw size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Change Date</span>
          </button>
          <button onClick={() => alert('Make It a Routine coming soon')} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
            <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center">
              <CheckCircle size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Make It a Routine</span>
          </button>
          <button onClick={() => alert('Move to Backlog coming soon')} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
            <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center">
              <Archive size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">Move to Backlog</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};