import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useOutlet, useLocation, useNavigate, useNavigationType, Navigate } from 'react-router-dom';
import { WifiOff, UserX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useDatabaseBootstrap } from '../../hooks/useDatabaseBootstrap';
import { retryDatabaseBootstrap } from '../../lib/databaseBootstrap';
import { PrimaryRoutePreview } from './PrimaryRoutePreview';
import {
  getPrimaryRoutePreloadTargets,
  preloadPrimaryRoute,
} from './primaryRoutePreload';
import type { TabId } from './BottomNav';
import { matchProtectedRoute, protectedRouteSwipeMode, protectedRouteHidesBottomNav } from '../../lib/protectedRoutes';
import {
  hasExpectedRouteParent,
  makeRouteParentState,
  resolvePrimarySwipeDestination,
  resolveRouteParent,
  type PrimarySwipeDirection,
} from '../../lib/primarySwipeNavigation';

const RETRY_COOLDOWN_MS = 2000;

let appDataShellPromise:
  | Promise<typeof import('./AppDataShell')>
  | null = null;

function loadAppDataShell() {
  appDataShellPromise ??= import('./AppDataShell').catch((error) => {
    appDataShellPromise = null;
    throw error;
  });
  return appDataShellPromise;
}

const LazyAppDataShell = lazy(() =>
  loadAppDataShell().then(({ AppDataShell }) => ({ default: AppDataShell }))
);

const LocalDataStartupShell: React.FC<{
  connectivity: 'checking' | 'online' | 'offline';
}> = ({ connectivity }) => (
  <div className="h-screen w-full bg-[#111111] text-white flex flex-col overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#222222]">
      <div>
        <p className="text-sm font-semibold">Mosaic</p>
        <p className="text-[11px] text-gray-500">Opening your local data…</p>
      </div>
      <span className="text-xs text-gray-400" aria-label={
        connectivity === 'online'
          ? 'Online'
          : connectivity === 'offline'
            ? 'Offline'
            : 'Checking connection'
      }>
        {connectivity === 'online'
          ? 'Online'
          : connectivity === 'offline'
            ? 'Offline'
            : 'Checking'}
      </span>
    </div>

    <div className="flex-1 px-4 py-4 space-y-3" aria-hidden="true">
      <div className="h-10 rounded-xl bg-[#1A1A1A]" />
      <div className="h-24 rounded-xl bg-[#1A1A1A]" />
      <div className="h-24 rounded-xl bg-[#1A1A1A]" />
      <div className="h-16 rounded-xl bg-[#1A1A1A]" />
    </div>

    <div className="grid grid-cols-5 border-t border-[#222222] px-2 py-3 text-[10px] text-gray-500">
      <span className="text-center text-white">Home</span>
      <span className="text-center">Explore</span>
      <span className="text-center">Alerts</span>
      <span className="text-center">Chat</span>
      <span className="text-center">Me</span>
    </div>
    <span className="sr-only" role="status" aria-live="polite">
      Opening local data
    </span>
  </div>
);

let messageDeliveryModulePromise:
  | Promise<typeof import('../../lib/messageDelivery')>
  | null = null;

function loadMessageDeliveryModule() {
  messageDeliveryModulePromise ??= import('../../lib/messageDelivery').catch(
    (error) => {
      messageDeliveryModulePromise = null;
      throw error;
    }
  );
  return messageDeliveryModulePromise;
}

export const AppLayout: React.FC = () => {
  const { user, isOffline, error, retry } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const outlet = useOutlet();
  const navigationType = useNavigationType();
  const priorPathRef = useRef(path);
  const routeSwipeCommittedRef = useRef(false);
  const isNewRoute = priorPathRef.current !== path;
  const backFromFallback = Boolean(location.state &&
    typeof location.state === 'object' &&
    'mosaicBackAnimation' in location.state &&
    (location.state as { mosaicBackAnimation?: unknown }).mosaicBackAnimation === true);
  const animateRouteBack = isNewRoute && !routeSwipeCommittedRef.current &&
    (navigationType === 'POP' || backFromFallback);

  useEffect(() => {
    priorPathRef.current = path;
    routeSwipeCommittedRef.current = false;
  }, [path]);
  const leftSwipeDestination = resolvePrimarySwipeDestination(path, 'left', location.state);
  const rightSwipeDestination = resolvePrimarySwipeDestination(path, 'right', location.state);
  const messagesIsAdjacent =
    leftSwipeDestination === '/messages' ||
    rightSwipeDestination === '/messages';
  const [retryDisabled, setRetryDisabled] = useState(false);
  const connectivity = useConnectivity();
  const database = useDatabaseBootstrap();

  useEffect(() => {
    const userId = user?.$id;
    if (!userId || connectivity.status !== 'online') return;

    let active = true;
    void import('../../lib/pushNotifications')
      .then(({ reconcileExistingPushSubscription }) => {
        if (active) {
          return reconcileExistingPushSubscription(userId);
        }
      })
      .catch((pushError) => {
        console.warn('[AppLayout] push account reconciliation failed:', pushError);
      });
    return () => {
      active = false;
    };
  }, [connectivity.status, user?.$id]);

  useEffect(() => {
    if (!user?.$id) return;
    void loadAppDataShell().catch((shellError) => {
      console.error('[AppLayout] data shell preload failed:', shellError);
    });
  }, [user?.$id]);

  useEffect(() => {
    const uid = user?.$id;
    if (!uid || isOffline || connectivity.status !== 'online' || database.state !== 'ready') return;

    let active = true;
    const tryDeliver = () => {
      if (connectivity.status !== 'online') return;
      void loadMessageDeliveryModule()
        .then((messageDelivery) => {
          if (!active) return;
          messageDelivery.deliverPendingMessages(uid).catch((err) =>
            console.error('[AppLayout] delivery failed:', err)
          );
          void import('../../lib/socialOutbox')
            .then(({ flushSocialOutbox }) => flushSocialOutbox(uid))
            .catch((err) =>
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
  }, [connectivity.status, database.state, isOffline, user?.$id]);


  useEffect(() => {
    const uid = user?.$id;
    if (!uid || isOffline || database.state !== 'ready') return;

    let timer: number | null = null;
    const schedule = () => {
      if (connectivity.status !== 'online') return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void import('../../db/sync')
          .then(({ forceSync }) => forceSync(uid))
          .catch(() => {});
      }, 250);
    };
    const onVisibility = () =>
      document.visibilityState === 'visible' && schedule();
    const watchdogTimer = window.setInterval(onVisibility, 120_000);

    window.addEventListener('focus', schedule);
    window.addEventListener('online', schedule);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('focus', schedule);
      window.removeEventListener('online', schedule);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(watchdogTimer);
    };
  }, [connectivity.status, database.state, isOffline, user?.$id]);

  useEffect(() => {
    if (!user?.$id) return;

    const destinations = getPrimaryRoutePreloadTargets(path);
    if (destinations.length === 0) return;

    if (messagesIsAdjacent) {
      // Messages is local-first and already shares the mounted providers. Warm
      // only this adjacent route immediately so a quick swipe cannot outrun
      // the idle callback and expose an empty/loading conversation surface.
      preloadPrimaryRoute('/messages');
    }

    const preload = () => {
      for (const destination of destinations) {
        if (destination !== '/messages' || !messagesIsAdjacent) {
          preloadPrimaryRoute(destination);
        }
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preload, { timeout: 1800 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(preload, 750);
    return () => window.clearTimeout(timer);
  }, [messagesIsAdjacent, path, user?.$id]);

  if (!user && isOffline) {
    const headline =
      connectivity.status === 'checking'
        ? 'Checking connection'
        : "You're offline";
    const body =
      connectivity.status === 'checking'
        ? error || 'Trying to reach Mosaic sync in the background.'
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

  if (database.state === 'idle' || database.state === 'loading') {
    return <LocalDataStartupShell connectivity={connectivity.status} />;
  }

  if (database.state === 'error') {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-lg font-bold mb-2">Local database unavailable</h1>
          <p className="text-sm text-gray-400 mb-4">
            Mosaic could not open its on-device database. Your synced Appwrite data has not been deleted.
          </p>
          {database.error && (
            <p className="text-xs text-red-300 mb-4 break-words">{database.error}</p>
          )}
          <button
            type="button"
            onClick={() => {
              void retryDatabaseBootstrap().catch(() => {});
            }}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-medium"
          >
            Retry database
          </button>
        </div>
      </div>
    );
  }

  // OFF-1: `user` is non-null here. When `isOffline` is true the identity
  // was hydrated from `mosaic_last_known_user` at mount time — render the
  // app tree so local data is reachable; MainLayout shows the
  // OfflineBanner and the online handler refreshes the session when the
  // network returns.
  const activeTab: TabId = matchProtectedRoute(path)?.tab ?? 'home';

  const handleTabChange = (tab: TabId) => {
    navigate(`/${tab}`);
  };
  const handleRouteSwipe = (direction: PrimarySwipeDirection) => {
    const destination = resolvePrimarySwipeDestination(path, direction, location.state);
    if (!destination) return;
    // This route was already animated by PrimaryRouteSwipeSurface.
    // Do not repeat the slide when its navigation is a browser-history POP.
    routeSwipeCommittedRef.current = true;

    const parent = resolveRouteParent(path, location.state);
    if (direction === 'right' && parent) {
      if (hasExpectedRouteParent(location.key, location.state, parent)) {
        navigate(-1);
      } else {
        navigate(parent, { replace: true });
      }
      return;
    }

    const destinationParent = resolveRouteParent(destination);
    navigate(
      destination,
      destinationParent === path
        ? { state: makeRouteParentState(path) }
        : undefined
    );
  };
  const includeConversations =
    path.includes('/messages') || messagesIsAdjacent;

  return (
    <Suspense
      fallback={<LocalDataStartupShell connectivity={connectivity.status} />}
    >
      <LazyAppDataShell
        includeConversations={includeConversations}
        activeTab={activeTab}
        routeKey={path}
        animateRouteBack={animateRouteBack}
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
        routeSwipeActivationMode={
          protectedRouteSwipeMode(path)
        }
        hideBottomNav={protectedRouteHidesBottomNav(path)}
      >
        {outlet}
      </LazyAppDataShell>
    </Suspense>
  );
};
