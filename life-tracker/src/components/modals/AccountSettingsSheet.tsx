import React from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Mail, KeyRound } from 'lucide-react';

interface AccountSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChangeEmail: () => void;
  onOpenChangePassword: () => void;
  currentEmail: string;
}

export const AccountSettingsSheet: React.FC<AccountSettingsSheetProps> = ({
  isOpen,
  onClose,
  onOpenChangeEmail,
  onOpenChangePassword,
  currentEmail,
}) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Account Settings" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-3">
        <div className="bg-[#111111] rounded-xl p-4 mb-4 border border-[#333333] text-center">
          <p className="text-xs text-gray-500 mb-1">Current Email</p>
          <p className="text-sm text-white font-medium break-all">{currentEmail}</p>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 py-3.5 border border-[#333333] rounded-xl"
          onClick={() => { onClose(); onOpenChangeEmail(); }}
        >
          <Mail size={18} className="text-blue-500" />
          <span className="text-white">Change Email</span>
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 py-3.5 border border-[#333333] rounded-xl"
          onClick={() => { onClose(); onOpenChangePassword(); }}
        >
          <KeyRound size={18} className="text-yellow-500" />
          <span className="text-white">Change Password</span>
        </Button>
      </div>
    </BottomSheet>
  );
};