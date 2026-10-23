import React, { useEffect, useState } from 'react';
import { createPreloadedLazy } from '../../lib/createPreloadedLazy';
import { Menu, List, RefreshCw, Bell, Archive, Star, ListChecks } from 'lucide-react';
import { Button } from '../ui/Button';
import { hasCapability } from '../../lib/backendCapabilities';

const { Component: LazyBottomSheet, preload: preloadMenuBottomSheet } =
  createPreloadedLazy(() => import('../ui/BottomSheet').then(m => m.BottomSheet));
const { Component: LazyCategoryManagerSheet, preload: preloadCategoryManagerSheet } =
  createPreloadedLazy(() => import('../modals/CategoryManagerSheet').then(m => m.CategoryManagerSheet));

export const HamburgerMenu: React.FC<{ onOpenBacklog: () => void; onOpenBucketList: () => void; onOpenUncompleted: () => void }> = ({ onOpenBacklog, onOpenBucketList, onOpenUncompleted }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuSheetMounted, setMenuSheetMounted] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryManagerMounted, setCategoryManagerMounted] = useState(false);

  // Warm only module code after Home mounts, not a hidden sheet or its effects.
  useEffect(() => {
    const warm = () => {
      if (!document.hidden) void preloadMenuBottomSheet().catch(() => {});
    };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(warm, 700);
    return () => clearTimeout(id);
  }, []);

  const menuItems = [
    { label: 'Bucket List', icon: Star, action: () => { setIsMenuOpen(false); onOpenBucketList(); } },
    { label: 'Backlogs', icon: Archive, action: () => { setIsMenuOpen(false); onOpenBacklog(); } },
    { label: 'Uncompleted Tasks', icon: ListChecks, action: () => { setIsMenuOpen(false); onOpenUncompleted(); } },
    {
      label: 'Categories',
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
          // User has opened Menu: warm the nested manager without mounting its hooks.
          if (!document.hidden) void preloadCategoryManagerSheet().catch(() => {});
        }}
        className="mosaic-action-icon p-2 rounded-lg bg-[#1E1E1E] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        aria-label="Open menu"
        data-home-menu-trigger="true"
        onPointerDown={() => { void preloadMenuBottomSheet().catch(() => {}); }}
        onMouseEnter={() => { void preloadMenuBottomSheet().catch(() => {}); }}
        onFocus={() => { void preloadMenuBottomSheet().catch(() => {}); }}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {menuSheetMounted && (
          <LazyBottomSheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} title="Menu">
            <div className="space-y-2 pt-2">
              {menuItems.filter(item => item.label !== 'Bucket List' || hasCapability('bucketList')).map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className="w-full justify-start gap-3 py-3"
                    onClick={item.action}
                  >
                    <Icon size={18} className="mosaic-action-icon text-gray-400" aria-hidden="true" />
                    <span className="mosaic-sheet-text">{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </LazyBottomSheet>
      )}

      {categoryManagerMounted && (
        <LazyCategoryManagerSheet
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      )}
    </>
  );
};
