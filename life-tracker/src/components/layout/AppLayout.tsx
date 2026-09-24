import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { WifiOff, UserX } from 'lucide-react';
import { MainLayout } from './MainLayout';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { useAuth } from '../../hooks/useAuth';
import { AppearanceProvider } from '../../hooks/AppearanceProvider';
import { PrimaryRoutePreview } from './PrimaryRoutePreview';
import {
  getPrimaryRoutePreloadTargets,
  preloadPrimaryRoute,
} from './primaryRoutePreload';
import type { TabId } from './BottomNav';
import {
  resolvePrimarySwipeDestination,
  type PrimarySwipeDirection,
} from '../../lib/primarySwipeNavigation';

const RETRY_COOLDOWN_MS = 2000;

let realtimeModulePromise: Promise<typeof import('../../db/realtime')> | null =
  null;
let deliveryModulesPromise:
  | Promise<
      readonly [
        typeof import('../../lib/messageDelivery'),
        typeof import('../../lib/socialOutbox'),
      ]
    >
  | null = null;

function loadRealtimeModule() {
  realtimeModulePromise ??= import('../../db/realtime').catch((error) => {
    realtimeModulePromise = null;
    throw error;
  });
  return realtimeModulePromise;
}

function loadDeliveryModules() {
  deliveryModulesPromise ??= Promise.all([
    import('../../lib/messageDelivery'),
    import('../../lib/socialOutbox'),
  ] as const).catch((error) => {
    deliveryModulesPromise = null;
    throw error;
  });
  return deliveryModulesPromise;
}

export const AppLayout: React.FC = () => {
  const { user, isLoading, isOffline, error, retry } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const leftSwipeDestination = resolvePrimarySwipeDestination(path, 'left');
  const rightSwipeDestination = resolvePrimarySwipeDestination(path, 'right');
  const [retryDisabled, setRetryDisabled] = useState(false);
  const [conversationNeighborReadyFor, setConversationNeighborReadyFor] =
    useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Realtime is background infrastructure, not shell-rendering code. Load it
  // after React commits the authenticated layout instead of pulling it into
  // the synchronous startup graph.
  useEffect(() => {
    const uid = user?.$id;
    if (!uid) return;

    let active = true;
    let stopRealtime: (() => void) | null = null;

    void loadRealtimeModule()
      .then((realtime) => {
        if (!active) return;
        realtime.startRealtime(uid);
        stopRealtime = realtime.stopRealtime;
      })
      .catch((err) =>
        console.error('[AppLayout] realtime module failed:', err)
      );

    return () => {
      active = false;
      stopRealtime?.();
    };
  }, [user?.$id]);

  useEffect(() => {
    const uid = user?.$id;
    if (!uid) return;

    let active = true;
    const tryDeliver = () => {
      void loadDeliveryModules()
        .then(([messageDelivery, socialOutbox]) => {
          if (!active) return;
          messageDelivery.deliverPendingMessages(uid).catch((err) =>
            console.error('[AppLayout] delivery failed:', err)
          );
          socialOutbox.flushSocialOutbox(uid).catch((err) =>
            console.error('[AppLayout] social outbox flush failed:', err)
          );
        })
        .catch((err) =>
          console.error('[AppLayout] delivery modules failed:', err)
        );
    };

    tryDeliver();
    window.addEventListener('focus', tryDeliver);
    window.addEventListener('online', tryDeliver);
    return () => {
      active = false;
      window.removeEventListener('focus', tryDeliver);
      window.removeEventListener('online', tryDeliver);
    };
  }, [user?.$id]);


  useEffect(() => {
    if (!user?.$id) return;

    const destinations = getPrimaryRoutePreloadTargets(path);
    if (destinations.length === 0) return;

    const preload = () => {
      for (const destination of destinations) {
        preloadPrimaryRoute(destination);
      }
      if (destinations.includes('/messages')) {
        setConversationNeighborReadyFor(path);
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preload, { timeout: 1800 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(preload, 750);
    return () => window.clearTimeout(timer);
  }, [path, user?.$id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center" role="status" aria-live="polite">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <span className="sr-only">Loading Mosaic</span>
      </div>
    );
  }

  if (!user && isOffline) {
    const headline = isOnline
      ? "We couldn't reach the server"
      : "You're offline";
    const body = isOnline
      ? error || 'Try again in a moment.'
      : 'Reconnect to continue.';
    const handleRetry = async () => {
      if (retryDisabled) return;
      setRetryDisabled(true);
      try {
        await retry();
      } finally {
        setTimeout(() => setRetryDisabled(false), RETRY_COOLDOWN_MS);
      }
    };
    const handleSwitchAccount = () => {
      navigate('/login', { replace: true });
    };
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333] mx-auto">
            <WifiOff size={28} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">{headline}</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">{body}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetry}
              disabled={retryDisabled}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              {retryDisabled ? 'Retrying…' : 'Try again'}
            </button>
            <button
              onClick={handleSwitchAccount}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center justify-center gap-2 bg-transparent text-gray-400 hover:text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors"
            >
              <UserX size={14} />
              Sign in with a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // OFF-1: `user` is non-null here. When `isOffline` is true the identity
  // was hydrated from `mosaic_last_known_user` at mount time — render the
  // app tree so local data is reachable; MainLayout shows the
  // OfflineBanner and the online handler refreshes the session when the
  // network returns.
  let activeTab: TabId = 'home';
  if (path.includes('explore')) activeTab = 'explore';
  else if (path.includes('notifications')) activeTab = 'notifications';
  else if (path.includes('messages')) activeTab = 'messages';
  else if (
    path.includes('account') ||
    path.includes('settings') ||
    path.includes('profile')
  ) {
    activeTab = 'account';
  }

  const handleTabChange = (tab: TabId) => {
    navigate(`/${tab}`);
  };
  const handleRouteSwipe = (direction: PrimarySwipeDirection) => {
    const destination = resolvePrimarySwipeDestination(path, direction);
    if (!destination) return;

    if (path === '/settings' && direction === 'right') {
      if (location.key === 'default') {
        navigate('/account', { replace: true });
      } else {
        navigate(-1);
      }
      return;
    }

    navigate(destination);
  };
  const includeConversations =
    path.includes('/messages') || conversationNeighborReadyFor === path;

  return (
    <AppearanceProvider>
      <FriendsProvider>
        <ConversationsProvider includeConversations={includeConversations}>
          <MainLayout
            activeTab={activeTab}
            routeKey={path}
            onTabChange={handleTabChange}
            canSwipeLeft={Boolean(leftSwipeDestination)}
            canSwipeRight={Boolean(rightSwipeDestination)}
            leftPreview={
              leftSwipeDestination ? (
                <PrimaryRoutePreview pathname={leftSwipeDestination} />
              ) : null
            }
            rightPreview={
              rightSwipeDestination ? (
                <PrimaryRoutePreview pathname={rightSwipeDestination} />
              ) : null
            }
            onRouteSwipe={handleRouteSwipe}
          >
            <Outlet />
          </MainLayout>
        </ConversationsProvider>
      </FriendsProvider>
    </AppearanceProvider>
  );
};
