import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, BarChart3, Sticker, ListTodo } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { useCategories } from '../hooks/useCategories';
import { useFriends } from '../hooks/useFriends';
import { makeRouteParentState } from '../lib/primarySwipeNavigation';

export const AccountPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { tasks } = useTasks();
  const { categories } = useCategories();
  const { friends } = useFriends();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const backlogCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333] flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Me</h1>
        <button
          type="button"
          onClick={() => navigate('/settings', { state: makeRouteParentState('/account') })}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-2 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Settings"
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 px-4 pt-6 pb-4 space-y-6" data-testid="account-scroll">
        <div className="flex flex-col items-center text-center space-y-3">
          <Avatar size="lg" alt={user?.name || user?.email || 'User'} />
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
            <span className="text-xs text-gray-400">My Progress</span>
          </div>
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 flex flex-col items-center gap-2">
            <Sticker size={20} className="text-green-500" aria-hidden="true" />
            <span className="text-xs text-gray-400">Sticker Shop</span>
          </div>
        </div>
        <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Backlog</h3>
            <p className="text-sm text-gray-400">{backlogCount} tasks</p>
          </div>
          <ListTodo size={24} className="text-gray-400" aria-hidden="true" />
        </div>
        <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Categories</h3>
            <p className="text-sm text-gray-400">{categories.length} active</p>
          </div>
          <div
            className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500"
            aria-hidden="true"
          />
        </div>
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
