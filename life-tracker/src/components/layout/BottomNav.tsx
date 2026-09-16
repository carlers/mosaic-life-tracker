import React from 'react';
import { motion } from 'framer-motion';
import { Home, Compass, Bell, MessageCircle, User } from 'lucide-react';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

export type TabId = 'home' | 'explore' | 'notifications' | 'messages' | 'account';

interface Tab {
  id: TabId;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

const tabs: Tab[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'messages', label: 'Chat', icon: MessageCircle },
  { id: 'account', label: 'Me', icon: User },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { totalUnread } = useUnreadMessages();

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#1E1E1E] border-t border-[#333333]"
    >
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const showBadge = tab.id === 'messages' && totalUnread > 0;
          const accessibleLabel = showBadge
            ? `${tab.label}, ${totalUnread} unread`
            : tab.label;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-label={accessibleLabel}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute top-2 w-1 h-1 bg-white rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  aria-hidden="true"
                />
              )}
              <div className="relative">
                <Icon
                  size={22}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-500'
                  }`}
                  aria-hidden="true"
                />
                {showBadge && (
                  <div
                    className="absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none"
                    aria-hidden="true"
                  >
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${
                  isActive ? 'text-white' : 'text-gray-500'
                }`}
                aria-hidden="true"
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
