import React from 'react';
import { List, RefreshCw, Bell, Archive, Star, ListChecks } from 'lucide-react';
import { createPreloadedLazy } from '../../lib/createPreloadedLazy';
import { Button } from '../ui/Button';

const { Component: LazyBottomSheet, preload: preloadMenuBottomSheet } =
  createPreloadedLazy(() => import('../ui/BottomSheet').then(m => m.BottomSheet));
const { Component: LazyCategoryManagerSheet, preload: preloadCategoryManagerSheet } =
  createPreloadedLazy(() => import('../modals/CategoryManagerSheet').then(m => m.CategoryManagerSheet));

export const preloadHamburgerMenuBottomSheet = () => preloadMenuBottomSheet();
export const preloadHamburgerMenuCategoryManager = () => preloadCategoryManagerSheet();

export interface HamburgerMenuContentProps {
  menuOpen: boolean;
  menuMounted: boolean;
  categoryOpen: boolean;
  categoryMounted: boolean;
  onCloseMenu: () => void;
  onCloseCategories: () => void;
  onOpenCategories: () => void;
  onOpenBacklog: () => void;
  onOpenBucketList: () => void;
  onOpenUncompleted: () => void;
}

/** Destination controls are an optional chunk, never a Home startup dependency. */
export const HamburgerMenuContent: React.FC<HamburgerMenuContentProps> = ({
  menuOpen, menuMounted, categoryOpen, categoryMounted,
  onCloseMenu, onCloseCategories, onOpenCategories,
  onOpenBacklog, onOpenBucketList, onOpenUncompleted,
}) => {
  const items = [
    { label: 'Bucket List', icon: Star, action: () => { onCloseMenu(); onOpenBucketList(); } },
    { label: 'Backlogs', icon: Archive, action: () => { onCloseMenu(); onOpenBacklog(); } },
    { label: 'Uncompleted Tasks', icon: ListChecks, action: () => { onCloseMenu(); onOpenUncompleted(); } },
    { label: 'Categories', icon: List, action: onOpenCategories },
    { label: 'Routines', icon: RefreshCw, action: () => console.log('Coming Soon') },
    { label: 'Reminders', icon: Bell, action: () => console.log('Coming Soon') },
  ];
  return (
    <>
      {menuMounted && (
        <LazyBottomSheet isOpen={menuOpen} onClose={onCloseMenu} title="Menu">
          <div className="space-y-2 pt-2">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <Button key={item.label} variant="ghost" className="w-full justify-start gap-3 py-3"
                  onClick={item.action}>
                  <Icon size={18} className="mosaic-action-icon text-gray-400" aria-hidden="true" />
                  <span className="mosaic-sheet-text">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </LazyBottomSheet>
      )}
      {categoryMounted && (
        <LazyCategoryManagerSheet isOpen={categoryOpen}
          onClose={onCloseCategories} />
      )}
    </>
  );
};
