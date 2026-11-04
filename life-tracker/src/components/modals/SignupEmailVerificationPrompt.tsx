import React, { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { useAuth } from "../../hooks/useAuth";

/**
 * Shown once after a successful unverified signup. Sending is explicitly
 * opt-in and failure must never interrupt the authenticated workspace.
 */
export const SignupEmailVerificationPrompt: React.FC = () => {
  const { user, requestEmailVerification, dismissSignupVerificationPrompt } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending || sent) return;
    setSending(true);
    setError(null);
    try {
      await requestEmailVerification();
      setSent(true);
    } catch (sendError: unknown) {
      setError((sendError as { code?: number } | null)?.code === 429
        ? "Too many requests. You can verify later in Account Settings."
        : "Could not send the email. You can try again or verify later in Account Settings.");
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet
      isOpen
      onClose={dismissSignupVerificationPrompt}
      title="Verify your email"
      height="auto"
    >
      <div className="space-y-4 px-3 pb-8 pt-2">
        <p className="text-sm text-gray-300">
          Confirm this address belongs to you so you can reliably receive important account messages.
        </p>
        {user?.email && (
          <p className="break-all rounded-lg border border-[#333333] bg-[#111111] px-3 py-2 text-center text-sm text-white">
            {user.email}
          </p>
        )}
        {sent ? (
          <>
            <p role="status" className="text-sm text-emerald-400">
              Verification email sent. Check your inbox.
            </p>
            <Button type="button" className="w-full" onClick={dismissSignupVerificationPrompt}>
              Continue to Mosaic
            </Button>
          </>
        ) : (
          <>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <Button type="button" className="w-full" disabled={sending}
              onClick={() => void send()}>
              {sending ? "Sending…" : "Send verification email"}
            </Button>
            <Button type="button" variant="ghost" className="w-full"
              onClick={dismissSignupVerificationPrompt}>
              Maybe later
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
};
