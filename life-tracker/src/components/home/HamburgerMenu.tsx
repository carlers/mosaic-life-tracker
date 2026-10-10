import React, { useState } from 'react';
import { Menu, List, RefreshCw, Bell, Archive } from 'lucide-react';
import { Button } from '../ui/Button';

const LazyBottomSheet = React.lazy(() =>
  import('../ui/BottomSheet').then(({ BottomSheet }) => ({
    default: BottomSheet,
  }))
);
const LazyCategoryManagerSheet = React.lazy(() =>
  import('../modals/CategoryManagerSheet').then(({ CategoryManagerSheet }) => ({
    default: CategoryManagerSheet,
  }))
);

export const HamburgerMenu: React.FC<{ onOpenBacklog: () => void }> = ({ onOpenBacklog }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuSheetMounted, setMenuSheetMounted] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryManagerMounted, setCategoryManagerMounted] = useState(false);

  const menuItems = [
    { label: 'Backlog', icon: Archive, action: () => { setIsMenuOpen(false); onOpenBacklog(); } },
    {
      label: 'Lists & Categories',
      icon: List,
      action: () => {
        setIsMenuOpen(false);
        setCategoryManagerMounted(true);
        setIsCategoryManagerOpen(true);
      },
    },
    { label: 'Routines', icon: RefreshCw, action: () => console.log('Coming Soon') },
    { label: 'Reminders', icon: Bell, action: () => console.log('Coming Soon') },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMenuSheetMounted(true);
          setIsMenuOpen(true);
        }}
        className="p-2 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        aria-label="Open menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {menuSheetMounted && (
        <React.Suspense fallback={null}>
          <LazyBottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="Menu">
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
                    <Icon size={18} className="text-gray-400" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </LazyBottomSheet>
        </React.Suspense>
      )}

      {categoryManagerMounted && (
        <React.Suspense fallback={null}>
          <LazyCategoryManagerSheet
            isOpen={isCategoryManagerOpen}
            onClose={() => setIsCategoryManagerOpen(false)}
          />
        </React.Suspense>
      )}
    </>
  );
};
