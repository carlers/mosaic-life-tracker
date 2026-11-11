import { createPreloadedLazy } from './createPreloadedLazy';

// Non-React module: keep the preload functions outside the hot-reloadable
// component module while sharing the exact same ready/cold import cache.
const menuSheet = createPreloadedLazy(() =>
  import('../components/ui/BottomSheet').then(m => m.BottomSheet));
const categorySheet = createPreloadedLazy(() =>
  import('../components/modals/CategoryManagerSheet').then(m => m.CategoryManagerSheet));

export const LazyMenuBottomSheet = menuSheet.Component;
export const LazyMenuCategoryManagerSheet = categorySheet.Component;
export const preloadHamburgerMenuBottomSheet = menuSheet.preload;
export const preloadHamburgerMenuCategoryManager = categorySheet.preload;
