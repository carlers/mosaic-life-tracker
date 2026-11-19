import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { loadDayViewSheet } from '../components/home/views/dayViewSheetModule';
import { preloadTodoListView } from '../components/home/views/todoListViewModule';

interface Props {
  carouselLoading: boolean;
  socialEnabled: boolean;
  tasksLoading: boolean;
  categoriesLoading: boolean;
  activePersonId: string;
  preloadFriendSettings: () => Promise<unknown>;
  setRenderWindow: Dispatch<SetStateAction<number>>;
}

function whenHomeIdle(work: () => void, timeout: number, fallback: number) {
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(work, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(work, fallback);
  return () => window.clearTimeout(id);
}

/** Nonvisual idle preloads start after Home paints; no task or friend view mounts early. */
export default function HomeIdlePreloader({
  carouselLoading, socialEnabled, tasksLoading, categoriesLoading,
  activePersonId, preloadFriendSettings, setRenderWindow,
}: Props): null {
  useEffect(() => {
    if (carouselLoading || !socialEnabled) return;
    const warm = () => { if (!document.hidden) void preloadFriendSettings().catch(() => {}); };
    return whenHomeIdle(warm, 1800, 700);
  }, [carouselLoading, socialEnabled, preloadFriendSettings]);

  useEffect(() => {
    // Owner Calendar readiness must not wait for unresolved friend/profile reads.
    if (tasksLoading || categoriesLoading || activePersonId !== 'me') return;
    const warm = () => {
      if (document.visibilityState === 'visible') {
        void loadDayViewSheet()
          .then(preloadTodoListView, preloadTodoListView)
          .catch(() => { /* On-demand navigation retries failed imports. */ });
      }
    };
    return whenHomeIdle(warm, 1200, 900);
  }, [activePersonId, categoriesLoading, tasksLoading]);

  useEffect(() => whenHomeIdle(() => setRenderWindow(1), 1200, 400), [setRenderWindow]);
  return null;
}
