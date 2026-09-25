import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DeferredAvatar } from '../ui/DeferredAvatar';
import { formatRelative } from '../../lib/format';
import type { Conversation } from '../../hooks/useConversations';
interface ConversationRowProps {
  conversation: Conversation;
}
const ConversationRowComponent: React.FC<ConversationRowProps> = ({
  conversation,
}) => {
  const navigate = useNavigate();
  const { friend, lastMessage, unreadCount } = conversation;
  let preview: string;
  let previewClass: string;
  if (!lastMessage) {
    preview = 'Tap to start chatting';
    previewClass = 'text-gray-400 italic';
  } else if (lastMessage.content) {
    preview = lastMessage.content;
    previewClass =
      unreadCount > 0 ? 'text-gray-200 font-medium' : 'text-gray-400';
  } else if (lastMessage.taskRefTitle) {
    preview = `Re: ${lastMessage.taskRefTitle}`;
    previewClass =
      unreadCount > 0 ? 'text-gray-200 font-medium' : 'text-gray-400';
  } else {
    preview = '(empty)';
    previewClass = 'text-gray-400 italic';
  }
  const handleOpen = () => {
    navigate(`/messages/${friend.friendId}`);
  };
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={handleOpen}
      className="w-full flex items-center gap-3 bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 cursor-pointer hover:bg-[#252525] transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60"
    >
      <DeferredAvatar
        fileId={friend.friendAvatarFileId || undefined}
        alt={friend.friendDisplayName || friend.friendUsername}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate flex-1">
            {friend.friendDisplayName || friend.friendUsername}
          </p>
          {lastMessage && (
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {formatRelative(lastMessage.createdAt, '')}
            </span>
          )}
        </div>
        <p className={`text-xs truncate mt-0.5 ${previewClass}`}>
          {lastMessage?.direction === 'outgoing' && (
            <span className="text-gray-400">You: </span>
          )}
          {preview}
        </p>
      </div>
      {unreadCount > 0 ? (
        <div className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center px-1.5">
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      ) : (
        <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
      )}
    </motion.button>
  );
};
function areConversationRowPropsEqual(
  prev: ConversationRowProps,
  next: ConversationRowProps
): boolean {
  if (prev.conversation === next.conversation) return true;
  const a = prev.conversation;
  const b = next.conversation;
  if (a.threadId !== b.threadId) return false;
  if (a.unreadCount !== b.unreadCount) return false;
  if (a.friend.friendId !== b.friend.friendId) return false;
  if (a.friend.friendDisplayName !== b.friend.friendDisplayName) return false;
  if (a.friend.friendUsername !== b.friend.friendUsername) return false;
  if (a.friend.friendAvatarFileId !== b.friend.friendAvatarFileId) return false;
  const am = a.lastMessage;
  const bm = b.lastMessage;
  if (am === bm) return true;
  if (!am || !bm) return false;
  return (
    am.id === bm.id &&
    am.content === bm.content &&
    am.taskRefTitle === bm.taskRefTitle &&
    am.direction === bm.direction &&
    am.createdAt === bm.createdAt &&
    am.isUnsent === bm.isUnsent
  );
}
export const ConversationRow = React.memo(
  ConversationRowComponent,
  areConversationRowPropsEqual
);
ConversationRow.displayName = 'ConversationRow';
