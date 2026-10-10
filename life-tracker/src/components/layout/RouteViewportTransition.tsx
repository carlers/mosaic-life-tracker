import React, { useContext } from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'framer-motion';
import type { RouteTransitionDirection } from '../../lib/routeTransitions';
import { matchProtectedRoute } from '../../lib/protectedRoutes';
import { AppearanceContext } from '../../hooks/appearanceContext';

const CHAT_ROUTE_MOTION_MS = 210;
type MotionDirection = { direction: RouteTransitionDirection; reduced: boolean; isChat: boolean };

const shellMotion = {
  enter: ({ direction, reduced, isChat }: MotionDirection) => ({
    x: reduced || direction === 'none'
      ? '0%'
      : isChat
        ? direction === 'backward' ? '-100%' : '100%'
        : direction === 'backward' ? '-18%' : '0%',
  }),
  center: ({ direction, reduced }: MotionDirection) => ({
    x: '0%',
    transition: {
      duration: reduced || direction === 'none' ? 0 : CHAT_ROUTE_MOTION_MS / 1000,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
  exit: ({ direction, reduced, isChat }: MotionDirection) => ({
    x: reduced || direction === 'none'
      ? '0%'
      : isChat
        ? direction === 'backward' ? '100%' : '-100%'
        : '-18%',
    transition: {
      duration: reduced || direction === 'none' ? 0 : CHAT_ROUTE_MOTION_MS / 1000,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

function RouteViewportPanel({
  isChat,
  children,
}: {
  isChat: boolean;
  children: React.ReactNode;
}) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      data-testid="route-viewport-panel"
      data-viewport-mode={isChat ? 'chat' : 'standard'}
      aria-hidden={!isPresent ? true : undefined}
      inert={!isPresent ? true : undefined}
      variants={shellMotion}
      initial="enter"
      animate="center"
      exit="exit"
      className={isChat
        ? 'fixed inset-0 z-10 h-dvh w-full overflow-hidden bg-[#111111]'
        : 'relative h-screen w-full bg-[#111111]'}
    >
      {children}
    </motion.div>
  );
}

/**
 * Chat's fixed visual-viewport shell must not replace the standard scrolling
 * shell mid-swipe. Retain BOTH original shells for the short route animation;
 * keep Appearance/Friends/Conversations providers outside this boundary.
 * Ordinary page-to-page transitions continue using MainLayout's compositor.
 */
export function RouteViewportTransition({
  pathname,
  direction,
  children,
}: {
  pathname: string;
  direction: RouteTransitionDirection;
  children: React.ReactNode;
}) {
  const isChat = matchProtectedRoute(pathname)?.id === 'chat';
  const key = isChat ? pathname : 'standard';
  const appearance = useContext(AppearanceContext);
  const osReducedMotion = useReducedMotion();
  const reduced = Boolean(appearance?.effectiveReducedMotion || osReducedMotion);
  const settings: MotionDirection = { direction, reduced, isChat };
  return (
    <AnimatePresence mode="sync" initial={false} custom={settings}>
      <RouteViewportPanel key={key} isChat={isChat}>
        {children}
      </RouteViewportPanel>
    </AnimatePresence>
  );
}
