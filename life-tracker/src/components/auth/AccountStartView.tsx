import { useState } from 'react';
import type { AccountStartMode } from '../../lib/supabaseAccountRegistry';
import { Button } from '../ui/Button';

export function AccountStartView({ busy, error, onContinue, onCancel }: {
  busy: boolean; error: string | null;
  onContinue(mode: AccountStartMode): Promise<boolean>;
  onCancel(): Promise<boolean>;
}) {
  const [choice, setChoice] = useState<AccountStartMode | null>(null);
  return <main className="min-h-screen bg-background text-white flex items-center justify-center p-6">
    <form className="w-full max-w-md bg-surface rounded-2xl p-6 space-y-5"
      aria-busy={busy} onSubmit={event => {
        event.preventDefault();
        if (choice && !busy) void onContinue(choice);
      }}>
      <h1 className="text-xl font-semibold">Start your Mosaic account</h1>
      <p>Your Supabase sign-in is independent of your old Appwrite email and password.
        Signing in does not transfer or link old records.</p>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="mb-3">Choose how to begin</legend>
        <label className="flex gap-3 items-start">
          <input type="radio" name="account-start" checked={choice === 'fresh'}
            onChange={() => setChoice('fresh')} />
          <span>I am starting a new Mosaic account.</span>
        </label>
        <label className="flex gap-3 items-start">
          <input type="radio" name="account-start" checked={choice === 'recovery-pending'}
            onChange={() => setChoice('recovery-pending')} />
          <span>I have earlier Mosaic data. Start new data while recovery is pending.</span>
        </label>
      </fieldset>
      <p className="text-sm text-gray-400">Keep your old app data and backups.
        Earlier history is unavailable here until ownership and recovery are verified.
        New edits will be kept separate for later reconciliation. Matching emails do not link accounts.</p>
      {error && <p role="alert">{error}</p>}
      <Button className="w-full" disabled={busy || !choice}>
        {busy ? 'Starting…' : 'Continue with new data'}
      </Button>
      <button type="button" disabled={busy} onClick={() => void onCancel()}
        className="w-full rounded p-2 focus-visible:ring-2 focus-visible:ring-accent">
        Sign out
      </button>
    </form>
  </main>;
}
