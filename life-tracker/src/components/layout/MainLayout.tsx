import React, { lazy, Suspense, useContext } from 'react';
import { BottomNav, type TabId } from './BottomNav';
import { PrimaryRouteSwipeSurface } from './PrimaryRouteSwipeSurface';
import type { PrimarySwipeDirection } from '../../lib/primarySwipeNavigation';
import { useChatViewport } from '../messages/useChatViewport';
import { AppearanceContext } from '../../hooks/appearanceContext';
import { useConnectivity } from '../../hooks/useConnectivity';

const OfflineBanner = lazy(() =>
  import('../ui/OfflineBanner').then(({ OfflineBanner }) => ({
    default: OfflineBanner,
  }))
);

export interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  routeKey?: string;
  onTabChange: (tab: TabId) => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
  leftPreview?: React.ReactNode;
  rightPreview?: React.ReactNode;
  onRouteSwipe?: (direction: PrimarySwipeDirection) => void;
  /** Detail routes can consume the full viewport without global bottom chrome. */
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
  const viewportStyle = useChatViewport(hideBottomNav);
  const appearance = useContext(AppearanceContext);
  const contentWidthMode = appearance?.contentWidthMode ?? 'full';
  const connectivity = useConnectivity();

  const contentInsetClass = hideBottomNav
    ? ''
    : 'pb-[calc(4rem+env(safe-area-inset-bottom))]';

  return (
    <div style={viewportStyle} className={`${hideBottomNav ? 'fixed inset-x-0 top-0 h-dvh' : 'relative h-screen'} w-full bg-[#111111] text-white flex flex-col overflow-hidden`}>
      {connectivity.status === 'offline' && (
        <Suspense fallback={null}>
          <OfflineBanner />
        </Suspense>
      )}

      <main className={`flex-1 min-h-0 ${hideBottomNav ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div
          data-testid="primary-route-width-frame"
          data-content-width-mode={contentWidthMode}
          className={`w-full ${
            activeTab === 'home' || hideBottomNav ? 'h-full min-h-0' : 'min-h-full'
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
            activationMode={
              hideBottomNav
                ? 'edge-back'
                : activeTab === 'home'
                  ? 'home-zone'
                  : 'full'
            }
            canSwipeLeft={canSwipeLeft}
            canSwipeRight={canSwipeRight}
            leftPreview={leftPreview}
            rightPreview={rightPreview}
            onSwipe={onRouteSwipe}
            fullHeight={hideBottomNav}
          >
            <div
              data-testid="primary-route-content"
              className={
                hideBottomNav
                  ? 'h-full min-h-0 overflow-hidden'
                  : activeTab === 'home'
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
