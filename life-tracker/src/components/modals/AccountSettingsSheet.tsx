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
  // Key ephemeral state by owner + email instead of resetting in effects.
  // A prior account's verification state must never appear for a new owner.
  const accountKey = String(user?.$id ?? '') + ':' + currentEmail;
  const [statusRecord, setStatusRecord] = useState<{ key: string; value: VerificationStatus } | null>(null);
  const status = statusRecord?.key === accountKey ? statusRecord.value : 'checking';
  const [sending, setSending] = useState(false);
  const [feedbackRecord, setFeedbackRecord] = useState<{ key: string; text: string } | null>(null);
  const feedback = feedbackRecord?.key === accountKey ? feedbackRecord.text : '';
  const [cooldown, setCooldown] = useState<{ key: string; until: number } | null>(null);
  const nextAllowedAt = cooldown?.key === accountKey ? cooldown.until : 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void refreshEmailVerificationStatus().then((verified) => {
      if (!cancelled) setStatusRecord({
        key: accountKey,
        value: verified ? 'verified' : 'unverified',
      });
    }).catch(() => {
      if (!cancelled) setStatusRecord({ key: accountKey, value: 'unavailable' });
    });
    return () => { cancelled = true; };
  }, [isOpen, accountKey, refreshEmailVerificationStatus]);

  useEffect(() => {
    if (!isOpen || !nextAllowedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, nextAllowedAt]);

  const remainingSeconds = Math.max(0, Math.ceil((nextAllowedAt - now) / 1000));

  const handleSend = async () => {
    if (sending || status !== 'unverified' || remainingSeconds > 0) return;
    setSending(true);
    setFeedbackRecord(null);
    try {
      await requestEmailVerification();
      setCooldown({ key: accountKey, until: Date.now() + RESEND_COOLDOWN_MS });
      setNow(Date.now());
      setFeedbackRecord({ key: accountKey, text: 'Verification email requested. Check your inbox.' });
    } catch (error) {
      const code = (error as { code?: number } | null)?.code;
      setFeedbackRecord({ key: accountKey, text: code === 429
        ? 'Too many requests. Try again later.'
        : 'Could not send a verification email. Check your connection and try again.' });
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
