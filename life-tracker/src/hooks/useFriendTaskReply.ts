import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskDocument } from '../db/schema';

interface UseFriendTaskReplyReturn {
  replyTask: TaskDocument | null;
  replyColor: string;
  feedback: string | null;
  handleReplyToTask: (task: TaskDocument, color: string) => void;
  handleReplySent: (msg: string) => void;
  closeReply: () => void;
}

export function useFriendTaskReply(
  tasks: TaskDocument[]
): UseFriendTaskReplyReturn {
  const [replyTaskId, setReplyTaskId] = useState<string | null>(null);
  const [replyColor, setReplyColor] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const replyTask = useMemo(
    () => tasks.find((t) => t.id === replyTaskId) ?? null,
    [tasks, replyTaskId]
  );

  const handleReplyToTask = useCallback(
    (task: TaskDocument, color: string) => {
      setReplyTaskId(task.id);
      setReplyColor(color);
    },
    []
  );

  const handleReplySent = useCallback((msg: string) => {
    setFeedback(msg);
    setReplyTaskId(null);
  }, []);

  const closeReply = useCallback(() => {
    setReplyTaskId(null);
  }, []);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [feedback]);

  return {
    replyTask,
    replyColor,
    feedback,
    handleReplyToTask,
    handleReplySent,
    closeReply,
  };
}
