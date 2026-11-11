import React, { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';

const loadMenuContent = () => import('./HamburgerMenuContent');
const LazyMenuContent = React.lazy(() => loadMenuContent().then(
  m => ({ default: m.HamburgerMenuContent })
));

function warmMenu() {
  if (document.hidden) return;
  void loadMenuContent().then(m => m.preloadHamburgerMenuBottomSheet()).catch(() => {});
}

/** The Home trigger paints immediately; menu destinations load on demand. */
export const HamburgerMenu: React.FC<{
  onOpenBacklog: () => void;
  onOpenBucketList: () => void;
  onOpenUncompleted: () => void;
  shortcutRequest?: { key: string; action: 'menu' | 'categories' } | null;
}> = ({ onOpenBacklog, onOpenBucketList, onOpenUncompleted, shortcutRequest }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuSheetMounted, setMenuSheetMounted] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryManagerMounted, setCategoryManagerMounted] = useState(false);

  const openMenu = useCallback(() => {
    setMenuSheetMounted(true);
    setIsMenuOpen(true);
    // User has opened Menu: warm the nested manager without mounting its hooks.
    if (!document.hidden) void loadMenuContent().then(m => m.preloadHamburgerMenuCategoryManager()).catch(() => {});
  }, []);
  const openCategories = useCallback(() => {
    setIsMenuOpen(false);
    setCategoryManagerMounted(true);
    setIsCategoryManagerOpen(true);
    void loadMenuContent().then(m => m.preloadHamburgerMenuCategoryManager()).catch(() => {});
  }, []);

  useEffect(() => {
    if (!shortcutRequest) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (shortcutRequest.action === 'categories') openCategories();
      else openMenu();
    });
    return () => { active = false; };
  }, [shortcutRequest, openCategories, openMenu]);

  useEffect(() => {
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warmMenu, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = setTimeout(warmMenu, 700);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <button type="button" onClick={openMenu}
        className="mosaic-action-icon p-2 rounded-lg bg-[#1E1E1E] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        aria-label="Open menu"
        data-home-menu-trigger="true"
        onPointerDown={warmMenu} onMouseEnter={warmMenu} onFocus={warmMenu}>
        <Menu size={20} aria-hidden="true" />
      </button>
      {(menuSheetMounted || categoryManagerMounted) && (
        <React.Suspense fallback={null}>
          <LazyMenuContent
            menuOpen={isMenuOpen} menuMounted={menuSheetMounted}
            categoryOpen={isCategoryManagerOpen} categoryMounted={categoryManagerMounted}
            onCloseMenu={() => setIsMenuOpen(false)}
            onCloseCategories={() => setIsCategoryManagerOpen(false)}
            onOpenCategories={openCategories}
            onOpenBacklog={onOpenBacklog}
            onOpenBucketList={onOpenBucketList}
            onOpenUncompleted={onOpenUncompleted} />
        </React.Suspense>
      )}
    </>
  );
};
