import React from 'react';
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
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  );

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#1E1E1E] border-t border-[#333333]"
    >
      <div className="relative flex justify-around items-center h-[calc(4rem+env(safe-area-inset-bottom))] max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
        <div
          data-testid="active-tab-indicator"
          className="pointer-events-none absolute left-0 top-2 flex w-1/5 justify-center transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
          aria-hidden="true"
        >
          <div className="w-1 h-1 bg-mosaicText rounded-full" />
        </div>

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
              <div className="relative">
                <Icon
                  size={22}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400'
                  }`}
                  aria-hidden="true"
                />
                {showBadge && (
                  <div
                    className="absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none"
                    aria-hidden="true"
                  >
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${
                  isActive ? 'text-white' : 'text-gray-400'
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
