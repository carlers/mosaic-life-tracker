import React, { useContext } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import type { RouteTransitionDirection } from '../../lib/routeTransitions';
import { matchProtectedRoute } from '../../lib/protectedRoutes';
import { AppearanceContext } from '../../hooks/appearanceContext';

const CHAT_ROUTE_MOTION_SECONDS = 0.21;
const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
type MotionDirection = {
  direction: RouteTransitionDirection;
  reduced: boolean;
  isChat: boolean;
};

function entranceX({ direction, reduced, isChat }: MotionDirection): string {
  if (reduced || direction === 'none') return '0%';
  return isChat
    ? (direction === 'backward' ? '-100%' : '100%')
    : (direction === 'backward' ? '-18%' : '0%');
}

function departureX({ direction, reduced, isChat }: MotionDirection): string {
  if (reduced || direction === 'none') return '0%';
  return isChat ? (direction === 'backward' ? '100%' : '-100%') : '-18%';
}

function transition({ direction, reduced }: MotionDirection) {
  return {
    duration: reduced || direction === 'none' ? 0 : CHAT_ROUTE_MOTION_SECONDS,
    ease: EASE,
  };
}

function RouteViewportPanel({
  isChat,
  settings,
  children,
}: {
  isChat: boolean;
  settings: MotionDirection;
  children: React.ReactNode;
}) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      data-testid="route-viewport-panel"
      data-viewport-mode={isChat ? 'chat' : 'standard'}
      aria-hidden={!isPresent ? true : undefined}
      inert={!isPresent ? true : undefined}
      initial={{ x: entranceX(settings) }}
      animate={{ x: '0%', transition: transition(settings) }}
      // A panel's props are frozen once it exits. AnimatePresence sends the
      // NEXT navigation's direction to this exit variant (Back vs Forward,
      // or none when a finger swipe already finished the transition).
      variants={{ exit: (next: MotionDirection | undefined) => {
        const current = next ?? settings;
        return { x: departureX(current), transition: transition(current) };
      } }}
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
 * Ordinary routes reuse one standard shell and MainLayout's existing
 * compositor. Chat keeps its own fixed visual-viewport shell mounted through
 * the transition, so entering/leaving cannot resize the outgoing route's
 * header, message scroller, composer, or BottomNav mid-frame.
 * Data providers remain shared OUTSIDE this animation boundary.
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
      <RouteViewportPanel key={key} isChat={isChat} settings={settings}>
        {children}
      </RouteViewportPanel>
    </AnimatePresence>
  );
}
