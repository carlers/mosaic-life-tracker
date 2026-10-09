import React, { lazy, Suspense, useContext } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BottomNav, type TabId } from './BottomNav';
import {
  PrimaryRouteSwipeSurface,
  type RouteSwipeActivationMode,
} from './PrimaryRouteSwipeSurface';
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
  animateRouteBack?: boolean;
  onTabChange: (tab: TabId) => void;
  canSwipeLeft?: boolean;
  canSwipeRight?: boolean;
  leftPreview?: React.ReactNode;
  rightPreview?: React.ReactNode;
  onRouteSwipe?: (direction: PrimarySwipeDirection) => void;
  routeSwipeActivationMode?: RouteSwipeActivationMode;
  /** Detail routes can consume the full viewport without global bottom chrome. */
  hideBottomNav?: boolean;
}

const BACK_ROUTE_TRANSITION_MS = 210;
const backRouteVariants = {
  enter: ({ back, reduced }: { back: boolean; reduced: boolean }) => ({
    x: back && !reduced ? '-100%' : '0%',
  }),
  center: ({ back, reduced }: { back: boolean; reduced: boolean }) => ({
    x: '0%',
    transition: {
      duration: back && !reduced ? BACK_ROUTE_TRANSITION_MS / 1000 : 0,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
  exit: ({ back, reduced }: { back: boolean; reduced: boolean }) => ({
    x: back && !reduced ? '100%' : '0%',
    pointerEvents: 'none' as const,
    transition: {
      duration: back && !reduced ? BACK_ROUTE_TRANSITION_MS / 1000 : 0,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  routeKey = activeTab,
  animateRouteBack = false,
  onTabChange,
  canSwipeLeft = false,
  canSwipeRight = false,
  leftPreview = null,
  rightPreview = null,
  onRouteSwipe = () => {},
  routeSwipeActivationMode,
  hideBottomNav = false,
}) => {
  const viewportStyle = useChatViewport(hideBottomNav);
  const appearance = useContext(AppearanceContext);
  const contentWidthMode = appearance?.contentWidthMode ?? 'full';
  const connectivity = useConnectivity();
  const reducedMotion = useReducedMotion();
  const routeMotion = { back: animateRouteBack, reduced: Boolean(reducedMotion) };

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
          className={`relative w-full ${
            activeTab === 'home' || hideBottomNav ? 'h-full min-h-0' : 'min-h-full'
          } ${
            contentWidthMode === 'comfortable'
              ? 'md:w-[min(70vw,960px)] md:mx-auto'
              : contentWidthMode === 'wide'
                ? 'md:w-[85vw] md:mx-auto'
                : ''
          }`}
        >
          <AnimatePresence initial={false} mode="popLayout" custom={routeMotion}>
            <motion.div
              key={routeKey}
              data-route-back-animation={animateRouteBack ? 'true' : undefined}
              custom={routeMotion}
              variants={backRouteVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={activeTab === 'home' || hideBottomNav
                ? 'h-full min-h-0 w-full'
                : 'w-full min-h-full'}
            >
            <PrimaryRouteSwipeSurface
              key={routeKey}
              activationMode={
                routeSwipeActivationMode ??
                (hideBottomNav
                  ? 'edge-back'
                  : activeTab === 'home'
                    ? 'home-zone'
                    : 'full')
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
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {!hideBottomNav && (
        <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
      )}
    </div>
  );
};
