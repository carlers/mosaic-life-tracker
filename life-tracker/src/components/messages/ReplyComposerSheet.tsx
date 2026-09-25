import React, { useState } from 'react';
import { format } from 'date-fns';
import { Send } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { useMessages } from '../../hooks/useMessages';
import type { TaskDocument } from '../../db/schema';

interface ReplyComposerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  categoryColor: string;
  friendId: string | null;
  friendName: string;
  onSent?: (message: string) => void;
}

export const ReplyComposerSheet: React.FC<ReplyComposerSheetProps> = ({
  isOpen,
  onClose,
  task,
  categoryColor,
  friendId,
  friendName,
  onSent,
}) => {
  const { sendTaskReply } = useMessages(friendId);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Render-body reset on task change
  const [syncedTaskId, setSyncedTaskId] = useState<string | null>(null);
  const taskId = task?.id ?? null;
  if (taskId !== syncedTaskId) {
    setSyncedTaskId(taskId);
    setContent('');
    setIsSending(false);
  }

  if (!task) return null;

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await sendTaskReply(task, trimmed, categoryColor);
      onSent?.('Reply sent');
      onClose();
    } catch (err) {
      console.error('[ReplyComposerSheet] send failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Reply to ${friendName}`}
      height="auto"
    >
      <div className="pt-2 pb-8 px-4">
        <div className="flex items-start gap-2 bg-[#111111] border border-[#333333] rounded-lg p-3 mb-4">
          <div
            className="w-1 flex-shrink-0 rounded-full self-stretch"
            style={{ backgroundColor: categoryColor || '#6B7280' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white break-words">
              {task.title}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(new Date(`${task.date}T00:00:00`), 'EEEE, MMM d')}
            </p>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your reply…"
          className="w-full bg-[#1A1A1A] rounded-xl p-4 text-sm text-white placeholder-gray-400 focus:outline-none min-h-[120px] resize-none border border-[#2A2A2A] focus:border-[#555555] transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
        />

        <div className="flex gap-3 mt-4">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1 gap-2"
            onClick={handleSend}
            disabled={!content.trim() || isSending}
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send size={16} />
                Send Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};