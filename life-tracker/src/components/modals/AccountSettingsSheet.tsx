import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Mail, KeyRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface AccountSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChangeEmail: () => void;
  onOpenChangePassword: () => void;
  currentEmail: string;
}

type VerificationStatus = 'checking' | 'verified' | 'unverified' | 'unavailable';
const RESEND_COOLDOWN_MS = 60_000;

export const AccountSettingsSheet: React.FC<AccountSettingsSheetProps> = ({
  isOpen,
  onClose,
  onOpenChangeEmail,
  onOpenChangePassword,
  currentEmail,
}) => {
  const { user, requestEmailVerification, refreshEmailVerificationStatus } = useAuth();
  const [status, setStatus] = useState<VerificationStatus>('checking');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus('checking');
    setFeedback('');
    void refreshEmailVerificationStatus().then((verified) => {
      if (!cancelled) setStatus(verified ? 'verified' : 'unverified');
    }).catch(() => {
      if (!cancelled) setStatus('unavailable');
    });
    return () => { cancelled = true; };
  }, [isOpen, user?.$id, currentEmail, refreshEmailVerificationStatus]);

  useEffect(() => {
    setNextAllowedAt(0);
    setFeedback('');
  }, [user?.$id, currentEmail]);

  useEffect(() => {
    if (!isOpen || !nextAllowedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, nextAllowedAt]);

  const remainingSeconds = Math.max(0, Math.ceil((nextAllowedAt - now) / 1000));

  const handleSend = async () => {
    if (sending || status !== 'unverified' || remainingSeconds > 0) return;
    setSending(true);
    setFeedback('');
    try {
      await requestEmailVerification();
      setNextAllowedAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setFeedback('Verification email requested. Check your inbox.');
    } catch (error) {
      const code = (error as { code?: number } | null)?.code;
      setFeedback(code === 429
        ? 'Too many requests. Try again later.'
        : 'Could not send a verification email. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Account Settings" height="auto">
      <div className="pt-2 pb-8 px-1 space-y-3">
        <div className="bg-[#111111] rounded-xl p-4 mb-4 border border-[#333333] text-center">
          <p className="text-xs text-gray-400 mb-1">Current Email</p>
          <p className="text-sm text-white font-medium break-all">{currentEmail}</p>
          <p className="mt-2 text-xs text-gray-300" role="status" aria-live="polite">
            {status === 'checking' ? 'Checking verification status…' :
             status === 'verified' ? 'Email verified' :
             status === 'unverified' ? 'Email not verified' :
             'Verification status unavailable while offline'}
          </p>
          {status === 'unverified' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400">
                Verification is optional. You can keep using Mosaic without it.
              </p>
              <Button
                className="w-full"
                disabled={sending || remainingSeconds > 0}
                onClick={() => void handleSend()}
              >
                {sending ? 'Sending…' :
                 remainingSeconds > 0 ? 'Resend in ' + remainingSeconds + 's' :
                 'Send verification email'}
              </Button>
            </div>
          )}
          {feedback && <p role="alert" className="mt-2 text-xs text-gray-300">{feedback}</p>}
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
