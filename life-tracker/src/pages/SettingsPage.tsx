import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  Lock,
  Monitor,
  Bell,
  Megaphone,
  Smile,
  Info,
  HelpCircle,
  LogOut,
  Database,
  Trash2,
  ChevronLeft,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { SettingsRow } from '../components/ui/SettingsRow';
import { useAuth } from '../hooks/useAuth';
import { usePwaLifecycle } from '../hooks/usePwaLifecycle';
import { destroyDatabase } from '../db/database';
import { AccountSettingsSheet } from '../components/modals/AccountSettingsSheet';
import { ChangeEmailSheet } from '../components/modals/ChangeEmailSheet';
import { ChangePasswordSheet } from '../components/modals/ChangePasswordSheet';
import { ExportDataSheet } from '../components/modals/ExportDataSheet';
import { SyncStatusSheet } from '../components/modals/SyncStatusSheet';
import { AppearanceSettingsSheet } from '../components/settings/AppearanceSettingsSheet';
import { useAppearance } from '../hooks/useAppearance';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { checkForUpdate } = usePwaLifecycle();
  const { mode: appearanceMode, setAppearanceMode } = useAppearance();
  const navigate = useNavigate();
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isDeleteAllDataOpen, setIsDeleteAllDataOpen] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);
  const [isSyncStatusOpen, setIsSyncStatusOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleComingSoon = () => showFeedback('Coming soon');

  const handleCheckForUpdates = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      const result = await checkForUpdate();
      if (result === 'update-available') {
        showFeedback('Update found. Use Update now to install it.');
      } else if (result === 'up-to-date') {
        showFeedback('Mosaic is up to date.');
      } else {
        showFeedback('Update checking is unavailable in this browser.');
      }
    } catch (error) {
      console.error('[SettingsPage] Update check failed:', error);
      showFeedback('Could not check for updates. Try again.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleLogout = async () => {
    const ok = await logout();
    if (ok) {
      navigate('/login', { replace: true });
    } else {
      showFeedback('Sign out failed. Check your connection and try again.');
    }
  };

  const handleDeleteAllData = async () => {
    const userId = user?.$id;
    if (!userId) return;
    setIsDeletingAllData(true);
    try {
      const { deleteAllUserData } = await import('../lib/deleteUserData');
      await deleteAllUserData(userId);
      const ok = await logout();
      if (!ok) {
        setIsDeletingAllData(false);
        setIsDeleteAllDataOpen(false);
        showFeedback('Data deleted, but sign out failed. Try signing out again.');
        return;
      }
      await destroyDatabase();
      window.location.reload();
    } catch (error) {
      console.error('[SettingsPage] Failed to delete all user data:', error);
      setIsDeletingAllData(false);
      setIsDeleteAllDataOpen(false);
      showFeedback('Delete failed. Check your connection and try again.');
    }
  };

  const handleClearData = async () => {
    setIsClearingData(true);
    try {
      const ok = await logout();
      if (!ok) {
        setIsClearingData(false);
        setIsClearDataOpen(false);
        showFeedback(
          'Could not sign out. Check your connection and try again.'
        );
        return;
      }
      await destroyDatabase();
      window.location.reload();
    } catch (error) {
      console.error('[SettingsPage] Failed to clear data:', error);
      setIsClearingData(false);
      setIsClearDataOpen(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333] flex items-center justify-center relative">
        <button
          type="button"
          onClick={() => navigate(-1)}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>
      <div className="flex-1 pb-24">
        <div className="py-2">
          <SettingsRow
            icon={<User size={18} className="text-blue-500" aria-hidden="true" />}
            label="Profile"
            onClick={() => navigate('/profile')}
          />
          <SettingsRow
            icon={<Shield size={18} className="text-gray-400" aria-hidden="true" />}
            label="Account"
            value={user?.email}
            onClick={() => setIsAccountSettingsOpen(true)}
          />
          <SettingsRow
            icon={<Lock size={18} className="text-gray-400" aria-hidden="true" />}
            label="Privacy"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Shield size={18} className="text-gray-400" aria-hidden="true" />}
            label="App Permissions"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Monitor size={18} className="text-gray-400" aria-hidden="true" />}
            label="Screen"
            value={
              appearanceMode === 'system'
                ? 'System'
                : appearanceMode === 'dark'
                  ? 'Dark'
                  : appearanceMode === 'light'
                    ? 'Light'
                    : 'Black'
            }
            onClick={() => setIsAppearanceOpen(true)}
          />
          <SettingsRow
            icon={<Bell size={18} className="text-gray-400" aria-hidden="true" />}
            label="Notifications"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Megaphone size={18} className="text-gray-400" aria-hidden="true" />}
            label="Announcements"
            rightElement={
              <div
                className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white"
                aria-hidden="true"
              >
                N
              </div>
            }
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Smile size={18} className="text-gray-400" aria-hidden="true" />}
            label="My stickers"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Info size={18} className="text-gray-400" aria-hidden="true" />}
            label="Information"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<HelpCircle size={18} className="text-gray-400" aria-hidden="true" />}
            label="FAQs"
            onClick={handleComingSoon}
          />
        </div>
        <div className="border-t border-[#333333] py-2">
          <SettingsRow
            icon={<RefreshCw size={18} className="text-blue-500" aria-hidden="true" />}
            label="Sync Status"
            onClick={() => setIsSyncStatusOpen(true)}
          />
          <SettingsRow
            icon={<FileDown size={18} className="text-emerald-500" aria-hidden="true" />}
            label="Export Data"
            onClick={() => setIsExportSheetOpen(true)}
          />
        </div>
        <div className="border-t border-[#333333] py-2">
          <SettingsRow
            icon={<Trash2 size={18} className="text-red-500" aria-hidden="true" />}
            label="Delete All User Data"
            isDestructive={true}
            showChevron={false}
            onClick={() => setIsDeleteAllDataOpen(true)}
          />
          <SettingsRow
            icon={<Database size={18} className="text-red-500" aria-hidden="true" />}
            label="Clear Local Data"
            isDestructive={true}
            showChevron={false}
            onClick={() => setIsClearDataOpen(true)}
          />
        </div>
        <div className="border-t border-[#333333] py-2">
          <div className="px-4 py-3.5 flex items-center justify-between text-white">
            <span className="text-base font-medium">Version</span>
            <span className="text-sm text-gray-400">0.0.0</span>
          </div>
          <SettingsRow
            icon={<RefreshCw size={18} className="text-emerald-500" aria-hidden="true" />}
            label="Check for Updates"
            value={isCheckingUpdate ? 'Checking…' : undefined}
            showChevron={false}
            onClick={handleCheckForUpdates}
          />
        </div>
        <div className="px-4 pt-4 pb-8">
          <button
            type="button"
            onClick={handleLogout}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full py-3 bg-[#1E1E1E] border border-[#333333] rounded-xl text-red-500 font-medium hover:bg-[#2A2A2A] transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <LogOut size={18} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </div>
      <BottomSheet
        isOpen={isDeleteAllDataOpen}
        onClose={() => setIsDeleteAllDataOpen(false)}
        title="Delete All User Data"
        height="auto"
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-gray-300 text-sm text-center mb-6 leading-relaxed">
            Delete all Mosaic data you own from sync, including tasks, categories,
            diary entries, settings, friendships, messages, profile visibility,
            and referenced images. This does not delete your login account.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsDeleteAllDataOpen(false)}
              disabled={isDeletingAllData}
              className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAllData}
              disabled={isDeletingAllData}
              className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium disabled:opacity-50"
            >
              {isDeletingAllData ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </div>
      </BottomSheet>
      <BottomSheet
        isOpen={isClearDataOpen}
        onClose={() => setIsClearDataOpen(false)}
        title="Clear Local Data"
        height="auto"
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-gray-300 text-sm text-center mb-6 leading-relaxed">
            Are you sure you want to clear all local data? This will delete your
            offline database and log you out. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsClearDataOpen(false)}
              disabled={isClearingData}
              className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearData}
              disabled={isClearingData}
              className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              {isClearingData ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear Data'
              )}
            </button>
          </div>
        </div>
      </BottomSheet>
      <AccountSettingsSheet
        isOpen={isAccountSettingsOpen}
        onClose={() => setIsAccountSettingsOpen(false)}
        onOpenChangeEmail={() => setIsChangeEmailOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        currentEmail={user?.email || ''}
      />
      <ChangeEmailSheet
        isOpen={isChangeEmailOpen}
        onClose={() => setIsChangeEmailOpen(false)}
        onSuccess={() => showFeedback('Email updated successfully')}
        currentEmail={user?.email || ''}
      />
      <ChangePasswordSheet
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={() => showFeedback('Password updated successfully')}
      />
      <ExportDataSheet
        isOpen={isExportSheetOpen}
        onClose={() => setIsExportSheetOpen(false)}
        onSuccess={showFeedback}
      />
      <SyncStatusSheet
        isOpen={isSyncStatusOpen}
        onClose={() => setIsSyncStatusOpen(false)}
      />
      <AppearanceSettingsSheet
        isOpen={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
        mode={appearanceMode}
        onChange={setAppearanceMode}
      />
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
