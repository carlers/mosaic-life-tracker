import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { WifiOff, UserX } from 'lucide-react';
import { MainLayout } from './MainLayout';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { useAuth } from '../../hooks/useAuth';
import { deliverPendingMessages } from '../../lib/messageDelivery';
import { flushSocialOutbox } from '../../lib/socialOutbox';
import { startRealtime, stopRealtime } from '../../db/realtime';
import type { TabId } from './BottomNav';
const RETRY_COOLDOWN_MS = 2000;
export const AppLayout: React.FC = () => {
  const { user, isLoading, isOffline, error, retry } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [retryDisabled, setRetryDisabled] = useState(false);
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
  // Open the realtime layer for the signed-in user. Closed on sign-out
  // and on tab teardown. The layer patches RxDB in place, so the same
  // subscriptions (useMessages, ConversationsProvider, useTasks) react
  // without any additional wiring. Polling/focus sync stays as the
  // safety net for anything realtime drops.
  useEffect(() => {
    if (!user?.$id) {
      stopRealtime();
      return;
    }
    startRealtime(user.$id);
    return () => {
      stopRealtime();
    };
  }, [user?.$id]);
  useEffect(() => {
    if (!user?.$id) return;
    const uid = user.$id;
    const tryDeliver = () => {
      deliverPendingMessages(uid).catch((err) =>
        console.error('[AppLayout] delivery failed:', err)
      );
      flushSocialOutbox(uid).catch((err) =>
        console.error('[AppLayout] social outbox flush failed:', err)
      );
    };
    tryDeliver();
    window.addEventListener('focus', tryDeliver);
    window.addEventListener('online', tryDeliver);
    return () => {
      window.removeEventListener('focus', tryDeliver);
      window.removeEventListener('online', tryDeliver);
    };
  }, [user?.$id]);
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
  // network returns. The `!user && isOffline` gate above only fires when
  // no cached user was hydrated, so no extra branch is required here.
  const path = location.pathname;
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
  return (
    <FriendsProvider>
      <ConversationsProvider>
        <MainLayout activeTab={activeTab} onTabChange={handleTabChange}>
          <Outlet />
        </MainLayout>
      </ConversationsProvider>
    </FriendsProvider>
  );
};
