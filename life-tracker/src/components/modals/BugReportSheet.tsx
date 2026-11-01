import React, { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import {
  collectBugReportDiagnostics, newBugReportRequestId,
  submitBugReport, type BugReportDraft,
} from '../../lib/bugReports';

interface BugReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}
const EMPTY: BugReportDraft = { title: '', description: '', steps: '' };
const PUBLIC_ISSUE_URL = 'https://github.com/carlers/mosaic-life-tracker/issues/new';

export const BugReportSheet: React.FC<BugReportSheetProps> = ({ isOpen, onClose, userId }) => {
  const [draft, setDraft] = useState<BugReportDraft>(EMPTY);
  const [requestId, setRequestId] = useState(newBugReportRequestId);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
  const [publicConsent, setPublicConsent] = useState(false);
  const [issueUrl, setIssueUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ownerRef = useRef(userId);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (ownerRef.current === userId) return;
    ownerRef.current = userId;
    // Account switching clears sensitive report text, including a pending receipt.
    setDraft(EMPTY);
    setRequestId(newBugReportRequestId());
    setDiagnosticsEnabled(false);
    setPublicConsent(false);
    setIssueUrl('');
    setReceipt('');
    setError('');
    setCopied(false);
  }, [userId]);

  const setField = (field: keyof BugReportDraft, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    setPublicConsent(false);
    setRequestId(newBugReportRequestId());
    setError('');
    setCopied(false);
  };
  const reset = () => {
    setDraft(EMPTY);
    setRequestId(newBugReportRequestId());
    setDiagnosticsEnabled(false);
    setPublicConsent(false);
    setIssueUrl('');
    setReceipt('');
    setError('');
    setCopied(false);
  };
  const diagnostics = diagnosticsEnabled && isOpen ? collectBugReportDiagnostics() : undefined;
  const reportText = [
    'Mosaic bug report', 'Title: ' + draft.title,
    'Description: ' + draft.description,
    draft.steps ? 'Steps to reproduce: ' + draft.steps : '',
  ].filter(Boolean).join('\n\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
    } catch {
      setError('Clipboard unavailable. Select and copy the text manually.');
    }
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || !publicConsent || inFlightRef.current || !draft.title.trim() || !draft.description.trim()) return;
    inFlightRef.current = true;
    setBusy(true);
    setError('');
    const owner = userId;
    try {
      const result = await submitBugReport(draft, requestId, diagnostics);
      if (ownerRef.current !== owner) return;
      setReceipt(result.reportId);
      setIssueUrl(result.issueUrl);
    } catch {
      if (ownerRef.current === owner) {
        setError('Public GitHub publication could not be confirmed. Your draft is retained; retry without editing to avoid duplicates.');
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Report a bug" preventDismiss={busy}>
      <div className="px-4 pt-3 pb-8 space-y-4 text-white">
        {receipt ? (
          <div className="space-y-4" role="status">
            <p className="text-sm text-emerald-400">Public GitHub issue created.</p>
            <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-sm underline text-emerald-400">View issue on GitHub</a>
            <p className="text-sm text-gray-400">Internal reference (use the GitHub link above to track the public issue):</p>
            <code className="block break-all rounded-lg bg-[#222222] p-3 text-sm">{receipt}</code>
            <button type="button" onClick={reset} className="w-full rounded-lg border border-[#444444] px-4 py-3 focus-visible:ring-2 focus-visible:ring-emerald-500">Report another bug</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-400">Describe the bug you want to publish. Do not include passwords, personal information, private tasks, diaries, or messages.</p>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>What went wrong?</span>
              <input type="text" required maxLength={160} value={draft.title} onChange={e => setField('title', e.target.value)}
                className="w-full rounded-lg border border-[#444444] bg-[#222222] px-3 py-2.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Description</span>
              <textarea required rows={4} maxLength={3000} value={draft.description} onChange={e => setField('description', e.target.value)}
                className="w-full resize-y rounded-lg border border-[#444444] bg-[#222222] px-3 py-2.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Steps to reproduce (optional)</span>
              <textarea rows={3} maxLength={2000} value={draft.steps} onChange={e => setField('steps', e.target.value)}
                className="w-full resize-y rounded-lg border border-[#444444] bg-[#222222] px-3 py-2.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={diagnosticsEnabled} onChange={e => {
                setDiagnosticsEnabled(e.target.checked); setRequestId(newBugReportRequestId()); setError('');
              }} className="mt-1 accent-emerald-500" />
              <span>Include basic device and Mosaic version information (optional)</span>
            </label>
            {diagnostics && (
              <div className="rounded-lg border border-[#444444] p-3 space-y-2">
                <p className="text-xs text-gray-400">Exactly what will be included:</p>
                <dl className="space-y-1 text-xs text-gray-300">
                  {Object.entries(diagnostics).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <dt>{key}</dt><dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-200">This report will become a public GitHub Issue.</p>
              <p className="text-xs text-gray-300">Anyone can read, quote, copy, or share it. Public GitHub issues do not automatically disappear after 30 days or when you delete your Mosaic account.</p>
              <p className="text-xs text-gray-300">Only the title, description, and reproduction steps below are published. Optional diagnostics are stored privately in Mosaic, not included in the public issue.</p>
              <div className="space-y-1 rounded-lg border border-[#444444] p-2 text-xs text-gray-200">
                <p className="font-semibold">Public issue preview</p>
                <p className="whitespace-pre-wrap break-words">{'[Mosaic Bug] ' + draft.title}</p>
                <p className="whitespace-pre-wrap break-words">{draft.description}</p>
                {draft.steps && <p className="whitespace-pre-wrap break-words">Steps: {draft.steps}</p>}
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" required checked={publicConsent} onChange={e => {
                  setPublicConsent(e.target.checked); setError('');
                }} className="mt-1 accent-emerald-500" />
                <span>I have reviewed this report and agree to publish its text in the public Mosaic GitHub repository.</span>
              </label>
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={!userId || !publicConsent || busy || !draft.title.trim() || !draft.description.trim()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-500">
              {busy ? 'Publishing…' : 'Publish public GitHub issue'}
            </button>
            <div className="border-t border-[#333333] pt-3 space-y-2">
              <p className="text-xs text-gray-400">If automatic publication is unavailable, copy the text and use GitHub manually. Manual GitHub submission requires a GitHub account.</p>
              <button type="button" disabled={!draft.title.trim()} onClick={() => { void handleCopy(); }}
                className="w-full rounded-lg border border-[#444444] px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500">
                {copied ? 'Copied' : 'Copy report'}
              </button>
              <a href={PUBLIC_ISSUE_URL} target="_blank" rel="noopener noreferrer" className="block text-center text-sm underline text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500">Open public GitHub Issues</a>
            </div>
          </form>
        )}
      </div>
    </BottomSheet>
  );
};
