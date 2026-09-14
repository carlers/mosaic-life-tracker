import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useTaskImage } from '../../hooks/useTaskImage';
import type { Conversation } from '../../hooks/useConversations';

interface ConversationRowProps {
  conversation: Conversation;
}

function formatRelative(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
}) => {
  const navigate = useNavigate();
  const { friend, lastMessage, unreadCount } = conversation;
  const { imageUrl } = useTaskImage(friend.friendAvatarFileId || undefined);

  let preview: string;
  let previewClass: string;
  if (!lastMessage) {
    preview = 'Tap to start chatting';
    previewClass = 'text-gray-600 italic';
  } else if (lastMessage.content) {
    preview = lastMessage.content;
    previewClass =
      unreadCount > 0 ? 'text-gray-200 font-medium' : 'text-gray-500';
  } else if (lastMessage.taskRefTitle) {
    preview = `Re: ${lastMessage.taskRefTitle}`;
    previewClass =
      unreadCount > 0 ? 'text-gray-200 font-medium' : 'text-gray-500';
  } else {
    preview = '(empty)';
    previewClass = 'text-gray-600 italic';
  }

  const handleOpen = () => {
    navigate(`/messages/${friend.friendId}`);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={handleOpen}
      className="flex items-center gap-3 bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 cursor-pointer hover:bg-[#252525] transition-colors"
    >
      <Avatar
        src={imageUrl || undefined}
        alt={friend.friendDisplayName || friend.friendUsername}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate flex-1">
            {friend.friendDisplayName || friend.friendUsername}
          </p>
          {lastMessage && (
            <span className="text-[10px] text-gray-500 flex-shrink-0">
              {formatRelative(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <p className={`text-xs truncate mt-0.5 ${previewClass}`}>
          {lastMessage?.direction === 'outgoing' && (
            <span className="text-gray-600">You: </span>
          )}
          {preview}
        </p>
      </div>
      {unreadCount > 0 ? (
        <div className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center px-1.5">
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      ) : (
        <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
      )}
    </motion.div>
  );
};