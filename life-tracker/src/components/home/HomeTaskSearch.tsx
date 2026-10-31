import React, { Suspense, useEffect } from 'react';
import { Search, WandSparkles } from 'lucide-react';
import type { HomeTaskSearchProps } from './HomeTaskSearchExpanded';

// Keep the search icon, sync status and hamburger in the first Home paint.
// Only the search form/results and ranking code are deferred until needed.
const loadSearch = () => import('./HomeTaskSearchExpanded');
const LazyExpandedSearch = React.lazy(() => loadSearch().then(
  module => ({ default: module.HomeTaskSearchExpanded })
));

export const HomeTaskSearch: React.FC<HomeTaskSearchProps> = props => {
  useEffect(() => {
    // Cache the optional search module after Home becomes usable, never on
    // the initial route's critical synchronous import graph.
    if (typeof window === 'undefined') return;
    const warm = () => {
      if (!document.hidden) void loadSearch().catch(() => {});
    };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 900);
    return () => window.clearTimeout(id);
  }, []);

  if (props.isOpen) {
    return (
      <Suspense fallback={
        <div data-route-swipe-zone="home-to-explore"
          className="relative z-40 flex-shrink-0 bg-[#111111] px-4 pt-3 pb-1"
          role="status" aria-label="Loading task search">
          <div className="flex items-center justify-end gap-2">
            <span className="min-w-0 flex-1 rounded-xl border border-[#333333] bg-[#1E1E1E] p-2 text-sm text-gray-400">
              Loading search…
            </span>
            <div className="shrink-0">{props.trailing}</div>
          </div>
        </div>
      }>
        <LazyExpandedSearch {...props} />
      </Suspense>
    );
  }

  return (
    <div data-route-swipe-zone="home-to-explore"
      className="relative z-40 flex-shrink-0 bg-[#111111] px-4 pt-3 pb-1 touch-pan-y">
      <div className="flex items-center justify-end gap-2">
        {props.statusControls && (
          <div data-route-swipe-ignore="true" className="shrink-0">
            {props.statusControls}
          </div>
        )}
        <div data-route-swipe-ignore="true" className="shrink-0">
          <button type="button" onClick={props.onOpenCommand}
            aria-label="Create task from command"
            className="mosaic-action-icon rounded-lg bg-[#1E1E1E] p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            <WandSparkles size={20} aria-hidden="true" />
          </button>
        </div>
        <div data-route-swipe-ignore="true" className="shrink-0">
          <button type="button" onClick={props.onOpen}
            onPointerDown={() => { void loadSearch().catch(() => {}); }}
            onMouseEnter={() => { void loadSearch().catch(() => {}); }}
            onFocus={() => { void loadSearch().catch(() => {}); }}
            className="mosaic-action-icon rounded-lg bg-[#1E1E1E] p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Search tasks">
            <Search size={20} aria-hidden="true" />
          </button>
        </div>
        <div data-route-swipe-ignore="true" className="shrink-0">{props.trailing}</div>
      </div>
    </div>
  );
};
