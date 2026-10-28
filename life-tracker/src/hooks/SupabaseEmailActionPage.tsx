import { useEffect, useRef, useState } from 'react';
import { EmailActionView, type EmailActionViewProps } from '../components/auth/EmailActionView';
import type { CoreBackendConfig } from '../lib/coreBackendConfig';
import { clearEmailActionCallback, readEmailActionCallback } from '../lib/emailActionCallback';
import { createSupabaseEmailActions, parseEmailAction } from '../lib/supabaseEmailActions';

/** This isolated route never mounts an Auth provider or starts a core writer. */
export default function SupabaseEmailActionPage({ config }: {
  config: Extract<CoreBackendConfig, { driver: 'supabase' }>;
}) {
  const [initial] = useState(() => {
    const input = readEmailActionCallback();
    const hash = input?.pathname === window.location.pathname ? input.hash : window.location.hash;
    const callback = hash ? parseEmailAction(window.location.pathname, hash) : null;
    // The parsed grant is now held only by this isolated route. Do not leave
    // the raw fragment (which may include a refresh token) in shared memory.
    clearEmailActionCallback();
    return { callback, codeEntry: !hash };
  });
  const { callback, codeEntry } = initial;
  const kind = callback?.kind ?? (window.location.pathname === '/auth/confirm' ? 'signup' : 'recovery');
  const [actions] = useState(() => createSupabaseEmailActions({ ...config, callback, kind }));
  const [stage, setStage] = useState<EmailActionViewProps['stage']>(callback || codeEntry ? 'ready' : 'invalid');
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
  return <EmailActionView {...{ kind, stage, email, busy, error, notice, codeEntry }}
    verify={(address, code) => perform(async () => {
      const verified = codeEntry ? await actions.verifyCode(address ?? '', code ?? '') : await actions.verify();
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
