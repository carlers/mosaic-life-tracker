import React from 'react';
import { BottomNav, type TabId } from './BottomNav';
import { OfflineBanner } from '../ui/OfflineBanner';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, activeTab, onTabChange }) => {
  return (
    // FIX: Changed min-h-screen to h-screen and added overflow-hidden.
    // This creates a strict viewport-bound container.
    <div className="h-screen w-full bg-[#111111] text-white relative flex flex-col overflow-hidden">
      <OfflineBanner />
      
      {/* FIX: flex-1 now correctly fills remaining space. overflow-y-auto makes THIS the scroll container. */}
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
};