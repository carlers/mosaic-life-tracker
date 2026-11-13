import React from 'react';
import { Home, Compass, Bell, MessageCircle, User } from 'lucide-react';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { useSharedTasks } from '../../hooks/useSharedTasks';
import { useFeatureEnabled } from '../../hooks/useFeatureEnabled';
import { useSettings } from '../../hooks/useSettings';
import { SHOW_BOTTOM_NAV_LABELS_SETTING_KEY, shouldShowBottomNavLabels } from '../../lib/preferences';
import { useGestureShortcuts } from '../../hooks/gestureShortcutsContext';
import type { ShortcutGestureHandlers } from '../../lib/shortcutGestureHandlers';
import type { GestureShortcutTrigger } from '../../lib/gestureShortcuts';

const LazyShortcutGestureBridge = React.lazy(() => import('./ShortcutGestureBridge'));

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


interface NavShortcutButtonProps {
  tab: Tab;
  active: boolean;
  count: number;
  onTabChange: (tab: TabId) => void;
  showLabels: boolean;
}

/** Each visible tab owns its own gesture session, including inactive tabs. */
const NavShortcutButton: React.FC<NavShortcutButtonProps> = ({
  tab, active, count, onTabChange, showLabels,
}) => {
  const { actionFor, dispatch } = useGestureShortcuts();
  const trigger = `nav:${tab.id}` as GestureShortcutTrigger;
  const action = actionFor(trigger);
  const [gesture, setGesture] = React.useState<ShortcutGestureHandlers | null>(null);
  const Icon = tab.icon;
  const showBadge = count > 0;
  const statusClass = active ? 'mosaic-navigation-active text-white'
    : 'mosaic-navigation-inactive text-gray-400';
  const accessibleLabel = showBadge
    ? `${tab.label}, ${count} ${tab.id === 'notifications' ? 'task invitations' : 'unread'}`
    : tab.label;

  return (
    <>
    <button
      type="button"
      {...(action && gesture ? gesture : {})}
      onClick={() => onTabChange(tab.id)}
      aria-label={accessibleLabel}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-col items-center justify-center w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60"
    >
      <div className="relative">
        <Icon size={22}
          className={`transition-colors duration-200 ${statusClass}`}
          aria-hidden="true" />
        {showBadge && (
          <div className="absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none"
            aria-hidden="true">{count > 9 ? '9+' : count}</div>
        )}
      </div>
      {showLabels && <span className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${statusClass}`}
        aria-hidden="true">{tab.label}</span>}
    </button>
    {action && (
      <React.Suspense fallback={null}>
        <LazyShortcutGestureBridge
          primary={{ enabled: true, direction: 'up', onTrigger: () => dispatch(action) }}
          onHandlers={setGesture}
        />
      </React.Suspense>
    )}
    </>
  );
};

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const { getSetting } = useSettings();
  const showLabels = shouldShowBottomNavLabels(getSetting(SHOW_BOTTOM_NAV_LABELS_SETTING_KEY));
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

        {visibleTabs.map(tab => (
          <NavShortcutButton
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            count={tab.id === 'messages' ? totalUnread : tab.id === 'notifications' ? pendingInvitations : 0}
            onTabChange={onTabChange}
            showLabels={showLabels}
          />
        ))}
      </div>
    </nav>
  );
};
