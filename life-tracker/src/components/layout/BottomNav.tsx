import React from 'react';
import { motion } from 'framer-motion';
import { Home, Compass, Bell, MessageCircle, User } from 'lucide-react';

export type TabId = 'home' | 'explore' | 'notifications' | 'messages' | 'account';

interface Tab {
  id: TabId;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

const tabs: Tab[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'messages', label: 'Chat', icon: MessageCircle },
  { id: 'account', label: 'Me', icon: User },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#1E1E1E] border-t border-[#333333]">
      {/* pb-[env(safe-area-inset-bottom)] ensures it looks correct on iOS PWAs */}
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center w-full h-full focus:outline-none"
            >
              {/* Sliding Active Indicator Dot */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute top-2 w-1 h-1 bg-white rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <Icon 
                size={22} 
                className={`transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-500'}`} 
              />
              <span className={`text-[10px] mt-1 font-medium transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-500'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};