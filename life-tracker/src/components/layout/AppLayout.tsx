import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { MainLayout } from './MainLayout';
import { useAuth } from '../../hooks/useAuth';
import { deliverPendingMessages } from '../../lib/messageDelivery';
import type { TabId } from './BottomNav';

export const AppLayout: React.FC = () => {
  const { user, isLoading, isOffline, error, retry } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.$id) return;
    const uid = user.$id;
    const tryDeliver = () => {
      deliverPendingMessages(uid).catch((err) =>
        console.error('[AppLayout] delivery failed:', err)
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
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Couldn't verify session — do NOT redirect to /login, show a retry screen.
  if (!user && isOffline) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333] mx-auto">
            <WifiOff size={28} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Can&apos;t verify your session
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {error ||
              "We couldn't reach the server. Check your connection and try again."}
          </p>
          <button
            onClick={() => {
              retry();
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

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
    <MainLayout activeTab={activeTab} onTabChange={handleTabChange}>
      <Outlet />
    </MainLayout>
  );
};