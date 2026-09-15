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
  ChevronLeft,
  FileDown,
} from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';
import { SettingsRow } from '../components/ui/SettingsRow';
import { useAuth } from '../hooks/useAuth';
import { destroyDatabase } from '../db/database';
import { AccountSettingsSheet } from '../components/modals/AccountSettingsSheet';
import { ChangeEmailSheet } from '../components/modals/ChangeEmailSheet';
import { ChangePasswordSheet } from '../components/modals/ChangePasswordSheet';
import { ExportDataSheet } from '../components/modals/ExportDataSheet';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleComingSoon = () => showFeedback('Coming soon');

  const handleLogout = async () => {
    const ok = await logout();
    if (ok) {
      navigate('/login', { replace: true });
    } else {
      showFeedback('Sign out failed. Check your connection and try again.');
    }
  };

  const handleClearData = async () => {
    setIsClearingData(true);
    try {
      // Log out first. If this fails (offline, etc.) we must NOT wipe the
      // local database, otherwise the user will be left with an empty DB
      // but a still-valid server session on next load.
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
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="sticky top-0 z-20 bg-[#111111] px-4 py-3 border-b border-[#333333] flex items-center justify-center relative">
        <button
          onClick={() => navigate(-1)}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-4 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="py-2">
          <SettingsRow
            icon={<User size={18} className="text-blue-500" />}
            label="Profile"
            onClick={() => navigate('/profile')}
          />
          <SettingsRow
            icon={<Shield size={18} className="text-gray-400" />}
            label="Account"
            value={user?.email}
            onClick={() => setIsAccountSettingsOpen(true)}
          />
          <SettingsRow
            icon={<Lock size={18} className="text-gray-400" />}
            label="Privacy"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Shield size={18} className="text-gray-400" />}
            label="App Permissions"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Monitor size={18} className="text-gray-400" />}
            label="Screen"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Bell size={18} className="text-gray-400" />}
            label="Notifications"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Megaphone size={18} className="text-gray-400" />}
            label="Announcements"
            rightElement={
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                N
              </div>
            }
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Smile size={18} className="text-gray-400" />}
            label="My stickers"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<Info size={18} className="text-gray-400" />}
            label="Information"
            onClick={handleComingSoon}
          />
          <SettingsRow
            icon={<HelpCircle size={18} className="text-gray-400" />}
            label="FAQs"
            onClick={handleComingSoon}
          />
        </div>
        <div className="border-t border-[#333333] py-2">
          <SettingsRow
            icon={<FileDown size={18} className="text-emerald-500" />}
            label="Export Data"
            onClick={() => setIsExportSheetOpen(true)}
          />
        </div>
        <div className="border-t border-[#333333] py-2">
          <SettingsRow
            icon={<Database size={18} className="text-red-500" />}
            label="Clear Local Data"
            isDestructive={true}
            showChevron={false}
            onClick={() => setIsClearDataOpen(true)}
          />
        </div>
        <div className="border-t border-[#333333] py-2">
          <div className="px-4 py-3.5 flex items-center justify-between text-white">
            <span className="text-base font-medium">Version</span>
            <span className="text-sm text-gray-500">0.0.0</span>
          </div>
        </div>
        <div className="px-4 pt-4 pb-8">
          <button
            onClick={handleLogout}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full py-3 bg-[#1E1E1E] border border-[#333333] rounded-xl text-red-500 font-medium hover:bg-[#2A2A2A] transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
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
              onClick={() => setIsClearDataOpen(false)}
              disabled={isClearingData}
              className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleClearData}
              disabled={isClearingData}
              className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
      {feedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          {feedback}
        </div>
      )}
    </div>
  );
};