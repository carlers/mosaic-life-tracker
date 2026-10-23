import React, { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from '../hooks/keyboardShortcutsContext';
import { canUseKeyboardShortcut } from '../lib/keyboardShortcuts';
import { Settings, LogOut, BarChart3, Sticker, ListTodo, Star, ListChecks } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import { useFriends } from '../hooks/useFriends';
import { makeRouteParentState } from '../lib/primarySwipeNavigation';
import { createPreloadedLazy } from '../lib/createPreloadedLazy';

const { Component: LazyCategoryManagerSheet, preload: preloadCategoryManagerSheet } =
  createPreloadedLazy(() => import('../components/modals/CategoryManagerSheet').then(m => m.CategoryManagerSheet));

export const AccountPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { tasks } = useTasks();
  const { categories } = useCategories();
  const { friends } = useFriends();
  const navigate = useNavigate();
  const { enabled: shortcutsEnabled } = useKeyboardShortcuts();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [categoryManagerMounted, setCategoryManagerMounted] = useState(false);

  // Me is already on screen: warm code only, not an invisible sheet or its data hooks.
  useEffect(() => {
    const warm = () => { if (!document.hidden) void preloadCategoryManagerSheet().catch(() => {}); };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 1800 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(warm, 700);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!shortcutsEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 's' || !canUseKeyboardShortcut(event)) return;
      event.preventDefault();
      document.querySelector<HTMLButtonElement>('[data-account-settings-trigger="true"]')?.click();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleLogout = async () => {
    const ok = await logout();
    if (ok) {
      navigate('/login', { replace: true });
    } else {
      showFeedback('Sign out failed. Check your connection and try again.');
    }
  };

  const backlogCount = tasks.filter((t) => t.date === '' && !t.isDeleted && !t.completed).length;
  const uncompletedCount = tasks.filter((t) => t.userId === user?.$id && !t.isDeleted && !t.completed).length;

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333] flex items-center justify-between">
        <h1 className="mosaic-general-text text-lg font-bold text-white">Me</h1>
        <button
          type="button"
          onClick={() => navigate('/settings', { state: makeRouteParentState('/account') })}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-2 rounded-lg bg-[#1E1E1E] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Settings"
          data-account-settings-trigger="true"
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 px-4 pt-6 pb-4 space-y-6" data-testid="account-scroll">
        <div className="flex flex-col items-center text-center space-y-3">
          <Avatar size="lg" className="mosaic-profile-avatar" alt={user?.name || user?.email || 'User'} />
          <div>
            <h2 className="text-xl font-bold text-white">
              {user?.name || 'User'}
            </h2>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <div className="flex flex-col items-center">
              <span className="font-bold text-white">0</span>
              <span>Following</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-white">{friends.length}</span>
              <span>Friends</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 flex flex-col items-center gap-2">
            <BarChart3 size={20} className="text-blue-500" aria-hidden="true" />
            <span className="mosaic-general-text text-xs text-gray-400">My Progress</span>
          </div>
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 flex flex-col items-center gap-2">
            <Sticker size={20} className="text-green-500" aria-hidden="true" />
            <span className="mosaic-general-text text-xs text-gray-400">Sticker Shop</span>
          </div>
        </div>
        <button type="button" onClick={() => navigate('/bucket-list', { state: makeRouteParentState('/account') })}
          className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <div><h3 className="mosaic-general-text text-base font-bold text-white">Bucket List</h3><p className="mosaic-general-text text-sm text-gray-400">Life aspirations</p></div>
          <Star size={24} className="text-gray-400" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => navigate('/backlog', { state: makeRouteParentState('/account') })}
          className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <div>
            <h3 className="mosaic-general-text text-base font-bold text-white">Backlogs</h3>
            <p className="text-sm text-gray-400">{backlogCount} tasks</p>
          </div>
          <ListTodo size={24} className="text-gray-400" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => navigate('/backlog?view=uncompleted', { state: makeRouteParentState('/account') })}
          className="w-full bg-surface border border-border rounded-xl p-4 flex items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-accent">
          <div>
            <h3 className="mosaic-general-text text-base font-bold text-white">Uncompleted Tasks</h3>
            <p className="text-sm text-gray-400">{uncompletedCount} tasks</p>
          </div>
          <ListChecks size={24} className="text-gray-400" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setCategoryManagerMounted(true);
            setIsCategoryManagerOpen(true);
          }}
          onPointerDown={() => { void preloadCategoryManagerSheet().catch(() => {}); }}
          onFocus={() => { void preloadCategoryManagerSheet().catch(() => {}); }}
          className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          <div>
            <h3 className="mosaic-general-text text-base font-bold text-white">Categories</h3>
            <p className="text-sm text-gray-400">{categories.length} active</p>
          </div>
          <div
            className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500"
            aria-hidden="true"
          />
        </button>
        <div className="pb-4">
          <Button
          variant="danger"
          className="w-full gap-2 py-3"
          onClick={handleLogout}
        >
          <LogOut size={18} aria-hidden="true" />
          Logout
          </Button>
        </div>
      </div>
      {categoryManagerMounted && (
        <LazyCategoryManagerSheet
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      )}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {feedback}
        </div>
      )}
    </div>
  );
};
