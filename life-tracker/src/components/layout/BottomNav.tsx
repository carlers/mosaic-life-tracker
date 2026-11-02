import React from 'react';
import { Home, Compass, Bell, MessageCircle, User } from 'lucide-react';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { useSharedTasks } from '../../hooks/useSharedTasks';
import { useFeatureEnabled } from '../../hooks/useFeatureEnabled';

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
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const visibleTabs = socialEnabled ? tabs : tabs.filter(tab => tab.id === 'home' || tab.id === 'account');
  const { totalUnread } = useUnreadMessages();
  const { items: invitations } = useSharedTasks('received');
  const pendingInvitations = invitations.filter(item => item.status === 'pending').length;
  const activeIndex = Math.max(
    0,
    visibleTabs.findIndex((tab) => tab.id === activeTab)
  );

  return (
    <nav
      aria-label="Main"
      className="mosaic-navigation-bar fixed bottom-0 left-0 right-0 z-30 bg-[#1E1E1E] border-t border-[#333333]"
    >
      <div className="relative flex justify-around items-center h-[calc(4rem+env(safe-area-inset-bottom))] max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
        <div
          data-testid="active-tab-indicator"
          className="pointer-events-none absolute left-0 top-2 flex justify-center transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ width: (100 / visibleTabs.length) + '%', transform: `translateX(${activeIndex * 100}%)` }}
          aria-hidden="true"
        >
          <div className="mosaic-navigation-active w-1 h-1 bg-current rounded-full" />
        </div>

        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const badgeCount = tab.id === 'messages' ? totalUnread :
            tab.id === 'notifications' ? pendingInvitations : 0;
          const showBadge = badgeCount > 0;
          const accessibleLabel = showBadge
            ? `${tab.label}, ${badgeCount} ${tab.id === 'notifications' ? 'task invitations' : 'unread'}`
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
                    isActive ? 'mosaic-navigation-active text-white' : 'mosaic-navigation-inactive text-gray-400'
                  }`}
                  aria-hidden="true"
                />
                {showBadge && (
                  <div
                    className="absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none"
                    aria-hidden="true"
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${
                  isActive ? 'mosaic-navigation-active text-white' : 'mosaic-navigation-inactive text-gray-400'
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
