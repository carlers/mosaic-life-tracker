import { useId, useState } from 'react';
import { Button } from '../ui/Button';
import { MIN_PASSWORD_LENGTH, validatePassword } from '../../lib/password';

export interface EmailActionViewProps {
  kind: 'signup' | 'recovery';
  stage: 'invalid' | 'ready' | 'verified' | 'completed';
  email?: string;
  busy: boolean;
  error: string | null;
  notice: string | null;
  verify(): Promise<void>;
  complete(password?: string): Promise<void>;
}

/** Provider-neutral email actions never receive a bearer or callback credential. */
export function EmailActionView(props: EmailActionViewProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const passwordId = useId();
  const confirmId = useId();
  const recovery = props.kind === 'recovery';
  return <main className="min-h-screen bg-background text-white flex items-center justify-center p-6">
    <section className="w-full max-w-md bg-surface rounded-2xl p-8 border border-[#333333] shadow-2xl"
      aria-labelledby="email-action-title">
      <h1 id="email-action-title" className="text-2xl font-bold text-center mb-4">
        {recovery ? 'Reset your password' : 'Confirm your email'}
      </h1>
      {props.stage === 'invalid' && <p role="alert">
        This link is invalid or incomplete. Request a new link from the login page.
      </p>}
      {props.stage === 'ready' && <>
        <p className="mb-4">Continue to verify the account for this email link.</p>
        <Button disabled={props.busy} onClick={() => void props.verify()}>
          {props.busy ? 'Verifying…' : 'Verify email link'}
        </Button>
      </>}
      {props.stage === 'verified' && <>
        <p role="status" className="mb-4">Verified account: {props.email}</p>
        {recovery ? <form className="space-y-4" aria-busy={props.busy}
          onSubmit={event => {
            event.preventDefault();
            if (props.busy) return;
            const error = validatePassword(password) ??
              (password !== confirmation ? 'Passwords do not match.' : null);
            setValidationError(error);
            if (!error) void props.complete(password).then(() => {
              setPassword('');
              setConfirmation('');
            });
          }}>
          <div>
            <label htmlFor={passwordId}>New password</label>
            <input id={passwordId} type="password" autoComplete="new-password" required
              minLength={MIN_PASSWORD_LENGTH} value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full bg-background border border-gray-500 rounded-lg p-2 focus-visible:outline" />
          </div>
          <div>
            <label htmlFor={confirmId}>Confirm new password</label>
            <input id={confirmId} type="password" autoComplete="new-password" required
              minLength={MIN_PASSWORD_LENGTH} value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              className="w-full bg-background border border-gray-500 rounded-lg p-2 focus-visible:outline" />
          </div>
          <Button disabled={props.busy}>{props.busy ? 'Resetting…' : 'Reset password'}</Button>
        </form> : <Button disabled={props.busy} onClick={() => void props.complete()}>
          {props.busy ? 'Finishing…' : 'Finish confirmation'}
        </Button>}
      </>}
      {props.stage === 'completed' && <p role="status">
        {recovery ? 'Your password has been reset successfully.' : 'Your email is confirmed.'} You can now sign in.
      </p>}
      {(validationError || props.error) && <p role="alert" className="mt-4 font-medium">
        {validationError || props.error}
      </p>}
      {props.notice && <p role="status" className="mt-4">{props.notice}</p>}
      <a href="/login" className="mt-6 block text-center underline focus-visible:outline">
        Return to Mosaic
      </a>
    </section>
  </main>;
}
