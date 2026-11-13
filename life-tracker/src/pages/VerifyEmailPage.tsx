import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  captureEmailVerificationCallbackUrl,
  clearEmailVerificationCallback,
} from '../lib/emailVerificationCallback';

type VerificationState = 'checking' | 'verified' | 'wrong-account' | 'invalid' | 'failed';

export const VerifyEmailPage: React.FC = () => {
  const { completeEmailVerification, user } = useAuth();
  const [state, setState] = useState<VerificationState>('checking');
  const request = useRef<Promise<void> | null>(null);

  useLayoutEffect(() => {
    if (!request.current) {
      // Bootstrap already scrubbed the query before telemetry or lazy imports.
      // Also capture here for direct component tests or in-app navigation.
      const payload = captureEmailVerificationCallbackUrl();
      const userId = payload?.userId ?? '';
      const secret = payload?.secret ?? '';
      request.current = userId && secret
        ? completeEmailVerification(userId, secret)
        : Promise.reject(new Error('invalid'));
    }
    let mounted = true;
    void request.current.then(
      () => {
        clearEmailVerificationCallback();
        if (mounted) setState('verified');
      },
      (error: unknown) => {
        clearEmailVerificationCallback();
        if (!mounted) return;
        const message = error instanceof Error ? error.message : '';
        setState(message === 'Verification belongs to another signed-in account.'
          ? 'wrong-account' : message === 'invalid' ? 'invalid' : 'failed');
      },
    );
    return () => { mounted = false; };
  }, [completeEmailVerification]);

  return (
    <main className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-6">
      <section aria-labelledby="email-verification-title"
        className="w-full max-w-md rounded-2xl border border-[#333333] bg-[#1E1E1E] p-8 text-center">
        <h1 id="email-verification-title" className="text-2xl font-bold mb-3">
          Verify your email
        </h1>
        <p role="status" aria-live="polite" className="text-sm text-gray-300">
          {state === 'checking' ? 'Verifying your email…' :
           state === 'verified' ? 'Your email address has been verified.' :
           state === 'wrong-account'
             ? 'This verification link belongs to another account. Sign out and reopen the email link.'
             : state === 'invalid'
               ? 'This verification link is incomplete.'
               : 'Verification failed. The link may be expired or already used. Request a new email from Account Settings.'}
        </p>
        {state !== 'checking' && (
          <Link to={user ? '/settings/account' : '/login'}
            className="mt-6 block rounded-lg px-4 py-3 text-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
            {user ? 'Account settings' : 'Return to login'}
          </Link>
        )}
      </section>
    </main>
  );
};

export default VerifyEmailPage;
