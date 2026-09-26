import React, { lazy, Suspense, useContext, useEffect, useState } from 'react';
import { BottomNav, type TabId } from './BottomNav';
import { PrimaryRouteSwipeSurface } from './PrimaryRouteSwipeSurface';
import type { PrimarySwipeDirection } from '../../lib/primarySwipeNavigation';
import { AppearanceContext } from '../../hooks/appearanceContext';

const OfflineBanner = lazy(() =>
  import('../ui/OfflineBanner').then(({ OfflineBanner }) => ({
    default: OfflineBanner,
  }))
);

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  routeKey?: string;
  onTabChange: (tab: TabId) => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
  leftPreview?: React.ReactNode;
  rightPreview?: React.ReactNode;
  onRouteSwipe?: (direction: PrimarySwipeDirection) => void;
  hideBottomNav?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  routeKey = activeTab,
  onTabChange,
  canSwipeLeft = false,
  canSwipeRight = false,
  leftPreview = null,
  rightPreview = null,
  onRouteSwipe = () => {},
  hideBottomNav = false,
}) => {
  const appearance = useContext(AppearanceContext);
  const contentWidthMode = appearance?.contentWidthMode ?? 'full';
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const contentInsetClass = hideBottomNav
    ? ''
    : 'pb-[calc(4rem+env(safe-area-inset-bottom))]';

  return (
    <div className="h-screen w-full bg-[#111111] text-white relative flex flex-col overflow-hidden">
      {!isOnline && (
        <Suspense fallback={null}>
          <OfflineBanner />
        </Suspense>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div
          data-testid="primary-route-width-frame"
          data-content-width-mode={contentWidthMode}
          className={`w-full ${
            activeTab === 'home' && !hideBottomNav ? 'h-full min-h-0' : 'min-h-full'
          } ${
            contentWidthMode === 'comfortable'
              ? 'md:w-[min(70vw,960px)] md:mx-auto'
              : contentWidthMode === 'wide'
                ? 'md:w-[85vw] md:mx-auto'
                : ''
          }`}
        >
          <PrimaryRouteSwipeSurface
          key={routeKey}
          homeZoneOnly={activeTab === 'home' && !hideBottomNav}
          fullHeight={hideBottomNav}
          canSwipeLeft={canSwipeLeft}
          canSwipeRight={canSwipeRight}
          leftPreview={leftPreview}
          rightPreview={rightPreview}
          onSwipe={onRouteSwipe}
        >
          <div
            data-testid="primary-route-content"
            className={
              activeTab === 'home' && !hideBottomNav
                ? 'h-full min-h-0 ' + contentInsetClass
                : 'min-h-full ' + contentInsetClass
            }
          >
            {children}
          </div>
          </PrimaryRouteSwipeSurface>
        </div>
      </main>

      {!hideBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
      )}
    </div>
  );
};
