import { useEffect, useState } from 'react';
import { sendAppAction } from '../../lib/appAction';

interface Candidate {
  fileId: string;
  purpose: 'tasks' | 'diary' | 'profile';
  bytes: number;
  state: 'verified' | 'pending_delete';
}
interface Ticket { fileId: string; confirmationToken: string; notBefore: string }

export function CloudReclaimSection({ ownerId }: { ownerId: string }) {
  const [entries, setEntries] = useState<Candidate[]>([]);
  const [partial, setPartial] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!ticket) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticket]);

  async function checkUnused() {
    if (!ownerId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await sendAppAction({ action: 'list_reclaimable_media' }, 45_000);
      if (!Array.isArray(response.candidates) ||
          response.candidates.some((entry: Candidate) => !/^img_[0-9a-f]{32}$/.test(entry.fileId) ||
            !['tasks', 'diary', 'profile'].includes(entry.purpose) ||
            !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 ||
            !['verified', 'pending_delete'].includes(entry.state))) {
        throw new Error('Invalid inventory');
      }
      setEntries(response.candidates as Candidate[]);
      setPartial(response.hasMore === true);
      if (response.candidates.length === 0) setMessage('No eligible unused uploads found in this scan.');
    } catch {
      setEntries([]);
      setMessage('Unused media could not be checked. No files were changed.');
    } finally {
      setBusy(false);
    }
  }

  async function prepare(fileId: string) {
    if (busy || ticket) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await sendAppAction({
        action: 'request_owner_media_cleanup', fileId, confirmIntent: true,
      }, 45_000);
      if (response.fileId !== fileId ||
          typeof response.confirmationToken !== 'string' ||
          !/^[0-9a-f]{64}$/.test(response.confirmationToken) ||
          typeof response.notBefore !== 'string' ||
          !Number.isFinite(Date.parse(response.notBefore))) throw new Error('Bad ticket');
      setTicket({ fileId, confirmationToken: response.confirmationToken, notBefore: response.notBefore });
    } catch {
      setMessage('File is referenced, changed, or ineligible. Nothing was deleted.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy || !ticket || now < Date.parse(ticket.notBefore)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await sendAppAction({
        action: 'confirm_owner_media_cleanup',
        fileId: ticket.fileId,
        confirmationToken: ticket.confirmationToken,
      }, 45_000);
      if (response.fileId !== ticket.fileId || response.status !== 'deleted') {
        throw new Error('Deletion not confirmed');
      }
      setEntries(current => current.filter(entry => entry.fileId !== ticket.fileId));
      setTicket(null);
      setMessage('Cloud file permanently deleted. Its synced references were already absent.');
    } catch {
      setMessage('Deletion not confirmed. Retry with the same confirmation; the server rechecks safety.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Unused cloud media" className="border-b border-[#333333] px-4 py-5">
      <h2 className="mb-2 font-semibold">Unused cloud photos</h2>
      <p className="mb-4 text-sm leading-relaxed text-gray-400">
        Only newer server-verified uploads without synced references are eligible.
        Imported or older photos stay protected. Deleting requires two confirmations
        and a server safety recheck.
      </p>
      <button type="button" disabled={!ownerId || busy} onClick={() => void checkUnused()}
        className="w-full rounded-xl border border-[#333333] bg-surface px-4 py-3 text-sm font-medium disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
        {busy ? 'Checking…' : 'Find unused uploads'}
      </button>
      {partial && <p className="mt-3 text-xs text-gray-400">Only the latest eligible uploads were scanned.</p>}
      <div className="mt-3 space-y-2">
        {entries.map(entry => (
          <div key={entry.fileId} className="flex items-center justify-between gap-3 rounded-xl border border-[#333333] p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium capitalize">{entry.purpose} photo · {(entry.bytes / 1024).toFixed(1)} KB</p>
              <p className="truncate text-xs text-gray-400">{entry.fileId}</p>
            </div>
            <button type="button" disabled={busy || Boolean(ticket)} onClick={() => void prepare(entry.fileId)}
              className="shrink-0 rounded-lg border border-[#555] px-3 py-2 text-xs disabled:opacity-40">
              {entry.state === 'pending_delete' ? 'Resume' : 'Review deletion'}
            </button>
          </div>
        ))}
      </div>
      {ticket && (
        <div className="mt-4 rounded-xl border border-[#555] p-4">
          <h3 className="mb-2 text-sm font-semibold">Permanently delete this cloud photo?</h3>
          <p className="mb-3 text-xs text-gray-400">
            This cannot be undone and may affect unsynced devices. The server will
            recheck ownership and every known synced reference before deletion.
          </p>
          <p className="mb-3 break-all text-xs text-gray-400">{ticket.fileId}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => { setTicket(null); setMessage('Not deleted. To resume later, scan again.'); }}
              className="flex-1 rounded-lg border border-[#555] px-3 py-2 text-sm disabled:opacity-40">
              Not now
            </button>
            <button type="button" disabled={busy || now < Date.parse(ticket.notBefore)}
              onClick={() => void confirm()}
              className="flex-1 rounded-lg border border-red-600/50 px-3 py-2 text-sm text-red-300 disabled:opacity-40">
              {now < Date.parse(ticket.notBefore)
                ? `Wait ${Math.ceil((Date.parse(ticket.notBefore) - now) / 1000)}s`
                : 'Delete permanently'}
            </button>
          </div>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-gray-400">{message}</p>}
    </section>
  );
}
