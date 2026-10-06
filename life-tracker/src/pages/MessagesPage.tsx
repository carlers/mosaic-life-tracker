import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Users } from 'lucide-react';
import { ConversationRow } from '../components/messages/ConversationRow';
import { useConversations } from '../hooks/useConversations';
import { loadChatPage } from '../components/layout/routeModuleLoaders';

const ConversationListLoadingShell: React.FC = () => (
  <div className="space-y-2 px-4" role="status">
    {[0, 1].map((index) => (
      <div key={index} className="h-16 rounded-xl bg-[#1A1A1A]" />
    ))}
    <span className="sr-only">Loading conversations</span>
  </div>
);

export const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { conversations, isLoading } = useConversations();

  useEffect(() => {
    void loadChatPage().catch(() => {
      // RouteContent keeps a non-blocking shell fallback if preload fails.
    });
  }, []);

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333]">
        <h1 className="text-lg font-bold text-white">Messages</h1>
      </div>
      <div className="flex-1 pb-24 pt-4">
        {isLoading ? (
          <ConversationListLoadingShell />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333]"
              aria-hidden="true"
            >
              <MessageCircle size={28} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">No friends yet</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Add friends to start chatting. You can also reply to their tasks
              from their calendar.
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/explore')}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-medium px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
            >
              <Users size={16} aria-hidden="true" />
              Find Friends
            </motion.button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <ConversationRow key={c.friend.friendId} conversation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
