import { useEffect, useRef, useState } from 'react';
import { EmailActionView, type EmailActionViewProps } from '../components/auth/EmailActionView';
import type { CoreBackendConfig } from '../lib/coreBackendConfig';
import { clearEmailActionCallback, readEmailActionCallback } from '../lib/emailActionCallback';
import { createSupabaseEmailActions, parseEmailAction } from '../lib/supabaseEmailActions';

/** This isolated route never mounts an Auth provider or starts a core writer. */
export default function SupabaseEmailActionPage({ config }: {
  config: Extract<CoreBackendConfig, { driver: 'supabase' }>;
}) {
  const [callback] = useState(() => {
    const input = readEmailActionCallback();
    return input ? parseEmailAction(input.pathname, input.hash) : null;
  });
  const [actions] = useState(() => createSupabaseEmailActions({ ...config, callback }));
  const [stage, setStage] = useState<EmailActionViewProps['stage']>(callback ? 'ready' : 'invalid');
  const [email, setEmail] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const kind = callback?.kind ?? (window.location.pathname === '/auth/confirm' ? 'signup' : 'recovery');
  async function perform(action: () => Promise<void>) {
    if (!mounted.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch {
      if (mounted.current) setError('This action could not be confirmed. Retry, or request a new email link. If a password change was interrupted, try signing in with the new password.');
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <EmailActionView {...{ kind, stage, email, busy, error, notice }}
    verify={() => perform(async () => {
      const verified = await actions.verify();
      if (!mounted.current) return;
      setEmail(verified.email);
      setStage('verified');
      clearEmailActionCallback();
    })}
    complete={password => perform(async () => {
      const result = kind === 'recovery'
        ? await actions.resetPassword(password ?? '')
        : await actions.finishConfirmation();
      if (!mounted.current) return;
      clearEmailActionCallback();
      setStage('completed');
      if (!result.revoked) setNotice('The email-link session could not be closed on the server. Close this page when finished.');
    })} />;
}
