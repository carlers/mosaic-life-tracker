import React, { useState } from 'react';
import { Menu, List, RefreshCw, Bell } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { CategoryManagerSheet } from '../modals/CategoryManagerSheet';

export const HamburgerMenu: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const menuItems = [
    { 
      label: 'Lists & Categories', 
      icon: List, 
      action: () => {
        setIsMenuOpen(false);
        setIsCategoryManagerOpen(true);
      } 
    },
    { label: 'Routines', icon: RefreshCw, action: () => console.log('Coming Soon') },
    { label: 'Reminders', icon: Bell, action: () => console.log('Coming Soon') },
  ];

  return (
    <>
      <button
        onClick={() => setIsMenuOpen(true)}
        className="p-2 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <BottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="Menu">
        <div className="space-y-2 pt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.label}
                variant="ghost"
                className="w-full justify-start gap-3 py-3"
                onClick={item.action}
              >
                <Icon size={18} className="text-gray-400" />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </div>
      </BottomSheet>

      <CategoryManagerSheet 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setIsCategoryManagerOpen(false)} 
      />
    </>
  );
};