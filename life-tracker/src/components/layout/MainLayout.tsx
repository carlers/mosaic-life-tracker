import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BottomNav, type TabId } from './BottomNav';
import { PrimaryRouteSwipeSurface } from './PrimaryRouteSwipeSurface';
import type { PrimarySwipeDirection } from '../../lib/primarySwipeNavigation';

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
}) => {
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

  return (
    <div className="h-screen w-full bg-[#111111] text-white relative flex flex-col overflow-hidden">
      {!isOnline && (
        <Suspense fallback={null}>
          <OfflineBanner />
        </Suspense>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto">
        <PrimaryRouteSwipeSurface
          key={routeKey}
          homeZoneOnly={activeTab === 'home'}
          canSwipeLeft={canSwipeLeft}
          canSwipeRight={canSwipeRight}
          leftPreview={leftPreview}
          rightPreview={rightPreview}
          onSwipe={onRouteSwipe}
        >
          <div
            data-testid="primary-route-content"
            className={
              activeTab === 'home'
                ? 'h-full min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))]'
                : 'min-h-full pb-[calc(4rem+env(safe-area-inset-bottom))]'
            }
          >
            {children}
          </div>
        </PrimaryRouteSwipeSurface>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
};
