import React, { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import {
  FEEDBACK_KINDS,
  collectFeedbackDiagnostics,
  newFeedbackRequestId,
  submitPrivateFeedback,
  type FeedbackKind,
} from '../../lib/privateFeedback';

type Props = { isOpen: boolean; onClose: () => void; userId: string | null };

export const SendFeedbackSheet: React.FC<Props> = ({ isOpen, onClose, userId }) => {
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(newFeedbackRequestId);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ownerRef = useRef(userId);
  const generationRef = useRef(0);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (ownerRef.current === userId) return;
    ownerRef.current = userId;
    generationRef.current += 1;
    submittingRef.current = false;
    setKind('idea');
    setMessage('');
    setRequestId(newFeedbackRequestId());
    setIncludeDiagnostics(false);
    setReference('');
    setError('');
    setBusy(false);
  }, [userId]);

  const changeDraft = (nextKind: FeedbackKind, nextMessage: string, diagnostics: boolean) => {
    setKind(nextKind);
    setMessage(nextMessage);
    setIncludeDiagnostics(diagnostics);
    setRequestId(newFeedbackRequestId());
    setError('');
  };

  const reset = () => {
    changeDraft('idea', '', false);
    setReference('');
  };

  const diagnostics = includeDiagnostics && isOpen ? collectFeedbackDiagnostics() : undefined;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || submittingRef.current || !message.trim()) return;
    submittingRef.current = true;
    setBusy(true);
    setError('');
    const generation = generationRef.current;
    try {
      const result = await submitPrivateFeedback(kind, message, requestId, diagnostics);
      if (generation === generationRef.current) setReference(result.reference);
    } catch (cause) {
      if (generation === generationRef.current) {
        setError(
          (cause as { code?: number })?.code === 429
            ? 'Feedback limit reached. Try again later.'
            : 'Could not confirm delivery. Check your connection and retry this unchanged message.'
        );
      }
    } finally {
      if (generation === generationRef.current) {
        submittingRef.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Send feedback" preventDismiss={busy}>
      <div className="space-y-4 px-4 pb-8 pt-3 text-white">
        {reference ? (
          <div role="status" className="space-y-4">
            <p className="text-sm text-emerald-400">Your private feedback was received.</p>
            <p className="text-sm text-gray-400">Reference for follow-up:</p>
            <code className="block break-all rounded-lg bg-surfaceHighlight p-3 text-sm">{reference}</code>
            <p className="text-xs text-gray-400">This feedback was not published on GitHub.</p>
            <button type="button" onClick={reset}
              className="w-full rounded-lg border border-[#444444] px-4 py-3 focus-visible:ring-2 focus-visible:ring-emerald-500">
              Send more feedback
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-300">Share a suggestion or tell us about your experience with Mosaic.</p>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Feedback type</span>
              <select value={kind} onChange={event =>
                changeDraft(event.target.value as FeedbackKind, message, includeDiagnostics)}
                className="w-full rounded-lg border border-[#444444] bg-surface px-3 py-2.5 text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
                {Object.entries(FEEDBACK_KINDS).map(([value, label]) =>
                  <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Your feedback</span>
              <textarea required rows={5} maxLength={3000} value={message}
                onChange={event => changeDraft(kind, event.target.value, includeDiagnostics)}
                placeholder="What could be better?"
                className="w-full resize-y rounded-lg border border-[#444444] bg-surface px-3 py-2.5 text-white placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-500" />
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={includeDiagnostics} onChange={event =>
                changeDraft(kind, message, event.target.checked)} className="mt-1 accent-emerald-500" />
              <span>Include basic Mosaic version and device information (optional)</span>
            </label>
            {diagnostics && (
              <div className="space-y-2 rounded-lg border border-[#444444] p-3">
                <p className="text-xs text-gray-400">Device information that will be sent:</p>
                <dl className="space-y-1 text-xs text-gray-300">
                  {Object.entries(diagnostics).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <dt>{key}</dt><dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <p className="text-xs leading-relaxed text-gray-400">
              Feedback is private, not end-to-end encrypted. The Mosaic operator can read
              your message and account ID in a server-only support inbox. Reports expire
              after 30 days or are removed by account erasure. No tasks, diary, chat,
              screenshots, or device details are attached unless you type them or select
              the optional device information above. Please avoid sensitive information.
            </p>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={!userId || busy || !message.trim()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-500">
              {busy ? 'Sending…' : 'Send privately'}
            </button>
          </form>
        )}
      </div>
    </BottomSheet>
  );
};
