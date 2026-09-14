import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { MainLayout } from './MainLayout';
import { useAuth } from '../../hooks/useAuth';
import { deliverPendingMessages } from '../../lib/messageDelivery';
import type { TabId } from './BottomNav';

export const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Global message delivery triggers: on focus, on reconnect, and once on login.
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