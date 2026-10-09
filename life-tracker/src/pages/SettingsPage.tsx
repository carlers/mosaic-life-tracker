import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  Lock,
  SlidersHorizontal,
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
  Import,
} from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { SettingsRow } from '../components/ui/SettingsRow';
import { useAuth } from '../hooks/useAuth';
import { usePwaLifecycle } from '../hooks/usePwaLifecycle';
import type { PwaUpdateCheckStage } from '../lib/pwaLifecycle';
import { APP_VERSION } from '../lib/appVersion';
import { APP_BUILD_INFO } from '../lib/buildInfo';
import { destroyDatabase } from '../db/database';
import { AccountSettingsSheet } from '../components/modals/AccountSettingsSheet';
import { ChangeEmailSheet } from '../components/modals/ChangeEmailSheet';
import { ChangePasswordSheet } from '../components/modals/ChangePasswordSheet';
import { ExportDataSheet } from '../components/modals/ExportDataSheet';
import { TodoMateImportSheet } from '../components/modals/TodoMateImportSheet';
import { SyncStatusSheet } from '../components/modals/SyncStatusSheet';
import { useAppearance } from '../hooks/useAppearance';
import { hasExpectedRouteParent, makeRouteParentState } from '../lib/primarySwipeNavigation';
import {
  getBackupActivity,
  recordBackupActivity,
  type BackupActivity,
} from '../lib/backupActivity';

export const SettingsPage: React.FC = () => {
  const { user, logout, deleteAccount } = useAuth();
  const {
    applyUpdate,
    checkForUpdate,
    updateAvailable,
  } = usePwaLifecycle();
  const { mode: appearanceMode } = useAppearance();
  const navigate = useNavigate();
  const location = useLocation();
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isClearingData, setIsClearingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);
  const [isTodoMateImportOpen, setIsTodoMateImportOpen] = useState(false);
  const [isSyncStatusOpen, setIsSyncStatusOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateStage, setUpdateStage] = useState<
    PwaUpdateCheckStage | 'applying' | 'error' | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [backupActivityOverride, setBackupActivityOverride] = useState<{
    userId: string;
    activity: BackupActivity;
  } | null>(null);
  const storedBackupActivity = getBackupActivity(user?.$id);
  const backupActivity =
    backupActivityOverride && backupActivityOverride.userId === user?.$id
      ? backupActivityOverride.activity
      : storedBackupActivity;

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const formatActivityDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : 'Never';

  const handleBackupActivity = (
    kind: 'backup' | 'restore',
    completedAt: string
  ) => {
    const userId = user?.$id;
    if (!userId) return;
    setBackupActivityOverride({
      userId,
      activity: recordBackupActivity(userId, kind, completedAt),
    });
  };

  const handleComingSoon = () => showFeedback('Coming soon');

  const handleBack = () => {
    const parent = '/account';
    if (hasExpectedRouteParent(location.key, location.state, parent)) {
      navigate(-1);
    } else {
      navigate(parent, { replace: true });
    }
  };

  const handleCheckForUpdates = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    setUpdateStage('preparing');
    try {
      const result = await checkForUpdate(setUpdateStage);
      if (result === 'update-available') {
        setUpdateStage('ready');
      } else if (result === 'update-in-progress') {
        setUpdateStage('background-download');
      } else if (result === 'up-to-date') {
        setUpdateStage('up-to-date');
      } else {
        setUpdateStage('unavailable');
      }
    } catch (error) {
      console.error('[SettingsPage] Update check failed:', error);
      setUpdateStage('error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (isApplyingUpdate) return;
    setIsApplyingUpdate(true);
    setUpdateStage('applying');
    try {
      const applied = await applyUpdate();
      if (!applied) {
        setUpdateStage('unavailable');
      }
    } catch (error) {
      console.error('[SettingsPage] Update install failed:', error);
      setUpdateStage('error');
    } finally {
      setIsApplyingUpdate(false);
    }
  };

  const isUpdateReady = updateAvailable || updateStage === 'ready';
  const displayedUpdateStage =
    updateStage === 'error' ||
    updateStage === 'unavailable' ||
    updateStage === 'applying'
      ? updateStage
      : isUpdateReady
        ? 'ready'
        : updateStage;

  const updateStatusMessage =
    displayedUpdateStage === 'preparing'
      ? 'Preparing update check…'
      : displayedUpdateStage === 'checking'
        ? 'Checking for a new version…'
        : displayedUpdateStage === 'update-found'
          ? 'Update found. Preparing download…'
          : displayedUpdateStage === 'downloading'
            ? 'Update found — downloading…'
            : displayedUpdateStage === 'background-download'
              ? 'Update is still downloading in the background.'
              : displayedUpdateStage === 'ready'
                ? 'Update downloaded. Ready to install.'
                : displayedUpdateStage === 'applying'
                  ? 'Installing update…'
              : displayedUpdateStage === 'up-to-date'
                ? 'Mosaic is up to date.'
                : displayedUpdateStage === 'unavailable'
                  ? 'Update checking is unavailable in this browser.'
                  : displayedUpdateStage === 'error'
                    ? 'Could not check for updates. Try again.'
                    : null;

  const clearAuxiliaryOfflineData = async () => {
    const [
      { clearAllPendingImages },
      { clearAllFriendCaches },
      { clearAllCachedOwnProfiles },
      { clearOfflineDataReadiness },
    ] = await Promise.all([
      import('../lib/pendingImages'),
      import('../lib/friendCache'),
      import('../lib/profileCache'),
      import('../lib/offlineReadiness'),
    ]);
    await Promise.all([
      clearAllPendingImages(),
      clearAllFriendCaches(),
    ]);
    clearAllCachedOwnProfiles();
    clearOfflineDataReadiness();
  };

  const handleLogout = async () => {
    const ok = await logout();
    if (ok) {
      navigate('/login', { replace: true });
    } else {
      showFeedback('Sign out failed. Check your connection and try again.');
    }
  };

  const closeDeleteAccount = () => {
    if (isDeletingAccount) return;
    setIsDeleteAccountOpen(false);
    setDeleteConfirmation('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE' || isDeletingAccount) return;
    setIsDeletingAccount(true);
    const accepted = await deleteAccount(deleteConfirmation);
    if (!accepted) {
      setIsDeletingAccount(false);
      showFeedback(
        'Account deletion was not accepted. Check your connection and try again.'
      );
      return;
    }
    navigate('/login', { replace: true });
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
      await clearAuxiliaryOfflineData();
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
          onClick={handleBack}
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
            onClick={() => navigate('/profile', { state: makeRouteParentState('/settings') })}
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
            icon={<SlidersHorizontal size={18} className="text-gray-400" aria-hidden="true" />}
            label="Preferences"
            value={
              appearanceMode === 'system'
                ? 'System'
                : appearanceMode === 'dark'
                  ? 'Dark'
                  : appearanceMode === 'light'
                    ? 'Light'
                    : 'Black'
            }
            onClick={() =>
              navigate('/settings/preferences', {
                state: makeRouteParentState('/settings'),
              })
            }
          />
          <SettingsRow
            icon={<Bell size={18} className="text-gray-400" aria-hidden="true" />}
            label="Notifications"
            onClick={() => navigate('/settings/notifications', {
              state: makeRouteParentState('/settings'),
            })}
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
            label="Backup & Restore"
            onClick={() => setIsExportSheetOpen(true)}
          />
          <SettingsRow
            icon={<Import size={18} className="text-violet-400" aria-hidden="true" />}
            label="Import from TodoMate"
            onClick={() => setIsTodoMateImportOpen(true)}
          />
          <div
            aria-label="Backup activity"
            className="pl-[60px] pr-4 -mt-1 pb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500"
          >
            <span>
              Last backup: {formatActivityDate(backupActivity.lastBackupAt)}
            </span>
            <span>
              Last restore: {formatActivityDate(backupActivity.lastRestoreAt)}
            </span>
          </div>
        </div>
        <div className="border-t border-[#333333] py-2">
          <details className="group text-white" data-testid="app-version-details">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/60 [&::-webkit-details-marker]:hidden">
              <span className="text-base font-medium">Version</span>
              <span className="flex items-center gap-2">
                <span className="text-sm text-gray-400">{APP_VERSION}</span>
                <span aria-hidden="true" className="text-gray-500 transition-transform group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div
              data-testid="app-build-info"
              className="px-4 pb-3 text-xs text-gray-500"
            >
              <div>appwrite: {APP_BUILD_INFO.appwrite}</div>
              <div>branch: {APP_BUILD_INFO.branch ?? 'local'}</div>
              <div>
                commit: {APP_BUILD_INFO.commitShort ?? APP_BUILD_INFO.buildId}
              </div>
              {APP_BUILD_INFO.commitMessage && (
                <details className="mt-0.5">
                  <summary className="cursor-pointer truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                    message: {APP_BUILD_INFO.commitMessage.split(/\r?\n/, 1)[0]}
                  </summary>
                  <div className="mt-2 whitespace-pre-wrap break-words text-xs text-gray-400">
                    {APP_BUILD_INFO.commitMessage}
                  </div>
                </details>
              )}
            </div>
          </details>
          <SettingsRow
            icon={<RefreshCw size={18} className="text-emerald-500" aria-hidden="true" />}
            label={isUpdateReady ? 'Update now' : 'Check for Updates'}
            value={isUpdateReady ? 'Ready' : undefined}
            showChevron={false}
            onClick={isUpdateReady ? handleApplyUpdate : handleCheckForUpdates}
          />
          {updateStatusMessage && (
            <div
              role="status"
              aria-live="polite"
              data-testid="update-check-status"
              className="px-4 pb-3 text-sm text-gray-400"
            >
              <div className="flex items-center gap-2">
                {(isCheckingUpdate || isApplyingUpdate) && (
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-gray-500 border-t-transparent animate-spin"
                    aria-hidden="true"
                  />
                )}
                <span>{updateStatusMessage}</span>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-[#333333] py-2">
          <SettingsRow
            icon={<Trash2 size={18} className="text-red-500" aria-hidden="true" />}
            label="Delete Account"
            isDestructive={true}
            showChevron={false}
            onClick={() => setIsDeleteAccountOpen(true)}
          />
          <SettingsRow
            icon={<Database size={18} className="text-red-500" aria-hidden="true" />}
            label="Clear Local Data"
            isDestructive={true}
            showChevron={false}
            onClick={() => setIsClearDataOpen(true)}
          />
        </div>
        <div className="px-4 pt-4 pb-8">
          <button
            type="button"
            onClick={handleLogout}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full py-2.5 bg-[#1E1E1E] border border-[#333333] rounded-xl text-red-500 font-medium hover:bg-[#2A2A2A] transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <LogOut size={18} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      </div>
      <BottomSheet
        isOpen={isDeleteAccountOpen}
        onClose={closeDeleteAccount}
        title="Delete Account"
        height="auto"
        isLocked={isDeletingAccount}
        preventDismiss={isDeletingAccount}
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-gray-300 text-sm text-center leading-relaxed">
            Permanently delete your Mosaic login and live Mosaic data from
            Appwrite, including tasks, diary entries, profile, friends, photos,
            and messages exchanged with friends.
          </p>
          <p className="mt-3 text-xs text-gray-400 text-center leading-relaxed">
            This cannot be undone. Once accepted, deletion continues on the
            server even if you close Mosaic. Other signed-in devices will lose
            access when they reconnect.
          </p>
          <div className="mt-5">
            <label
              htmlFor="delete-account-confirmation"
              className="mb-1.5 block text-xs font-medium text-gray-400"
            >
              Type DELETE to confirm
            </label>
            <input
              id="delete-account-confirmation"
              aria-label="Type DELETE to confirm"
              type="text"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={isDeletingAccount}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="DELETE"
              className="w-full rounded-xl border border-[#3A3A3A] bg-[#171717] px-3.5 py-3 text-white outline-none transition focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50"
            />
          </div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={closeDeleteAccount}
              disabled={isDeletingAccount}
              className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={
                isDeletingAccount || deleteConfirmation !== 'DELETE'
              }
              className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium disabled:opacity-40"
            >
              {isDeletingAccount ? 'Deleting…' : 'Delete Account'}
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
        onBackupComplete={(completedAt) =>
          handleBackupActivity('backup', completedAt)
        }
        onRestoreComplete={(completedAt) =>
          handleBackupActivity('restore', completedAt)
        }
      />
      <TodoMateImportSheet
        isOpen={isTodoMateImportOpen}
        onClose={() => setIsTodoMateImportOpen(false)}
        onSuccess={showFeedback}
      />
      <SyncStatusSheet
        isOpen={isSyncStatusOpen}
        onClose={() => setIsSyncStatusOpen(false)}
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
