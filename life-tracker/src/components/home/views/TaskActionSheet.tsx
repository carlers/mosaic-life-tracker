import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Pencil, Trash2, FileText, Clock, ArrowRight, RotateCcw, CheckCircle, Archive, Image as ImageIcon } from 'lucide-react';
import { isToday } from 'date-fns';
import { getImageAsBlobUrl } from '../../../lib/storage';
import type { TaskDocument } from '../../../db/schema';

interface TaskActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  onEdit: () => void;
  onDelete: () => void;
  onMemo: () => void;
  onChangeDate: () => void;
  onAddPhoto: () => void;
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
  onAddPhoto,
  onDoItTomorrowOrToday
}) => {
  const [imageBlobUrl, setImageBlobUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (task?.image && isOpen) {
      setImageLoading(true);
      setImageBlobUrl('');
      
      getImageAsBlobUrl(task.image)
        .then(url => {
          setImageBlobUrl(url);
          setImageLoading(false);
        })
        .catch(err => {
          console.error('[TaskActionSheet] Failed to load image:', err);
          setImageLoading(false);
        });
    } else {
      setImageBlobUrl('');
    }

    // Cleanup blob URL when component unmounts or task changes
    return () => {
      if (imageBlobUrl) {
        URL.revokeObjectURL(imageBlobUrl);
      }
    };
  }, [task?.image, isOpen]);

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

        {/* Photo Section - Only show if image exists */}
        {task.image && task.image.trim() !== '' && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
                <ImageIcon size={16} className="text-black" />
              </div>
              <h3 className="text-lg font-semibold text-white">Photo</h3>
            </div>
            <div 
              onClick={onAddPhoto}
              className="cursor-pointer rounded-xl overflow-hidden border border-[#333333] bg-[#1A1A1A] min-h-[120px] flex items-center justify-center relative"
            >
              {imageLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : imageBlobUrl ? (
                <img 
                  src={imageBlobUrl} 
                  alt="Task attachment"
                  className="w-full h-48 object-cover absolute inset-0"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                  Tap to change photo
                </div>
              )}
            </div>
          </div>
        )}

        {/* Memo Section - Only show if memo exists */}
        {task.memo && task.memo.trim() !== '' && (
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
          {!task.memo && (
            <button onClick={() => { onMemo(); onClose(); }} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center">
                <FileText size={16} className="text-black" />
              </div>
              <span className="text-base font-medium">Memo</span>
            </button>
          )}
          
          <button onClick={() => { onAddPhoto(); onClose(); }} className="w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-[#1E1E1E] transition-colors text-white">
            <div className="w-8 h-8 rounded-full bg-green-400 flex items-center justify-center">
              <ImageIcon size={16} className="text-black" />
            </div>
            <span className="text-base font-medium">{task.image ? 'Change Photo' : 'Add Photo'}</span>
          </button>

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