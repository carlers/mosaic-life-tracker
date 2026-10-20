import { useEffect, useRef, useState } from 'react';
import { useSyncConflicts } from '../../hooks/useSyncConflicts';
import { useCategories } from '../../hooks/useCategories';
import type { SyncConflict } from '../../lib/syncConflictReview';
import { Button } from '../ui/Button';

export function SyncConflictReview({ ownerId }: { ownerId: string }) {
  const { conflicts, resolve } = useSyncConflicts(ownerId);
  const { categories } = useCategories(conflicts.length > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  if (!conflicts.length) return null;
  const value = (label: string, text: string) => label === 'Category' && text !== 'None'
    ? categories.find(category => category.id === text)?.name ?? 'List unavailable on this device'
    : text;
  const act = async (conflict: SyncConflict, action: 'refresh' | 'keepLocal') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await resolve(conflict, action); }
    catch {
      if (mounted.current)
        setError('The change could not be confirmed. Your edits are retained. Reconnect, then refresh the comparison.');
    } finally { if (mounted.current) setBusy(false); }
  };
  return <section aria-label="Changes needing review" className="space-y-3">
    <h3 className="font-semibold text-white">Changes need your review</h3>
    <p className="text-sm text-gray-400">
      Your edits stay on this device. Keeping your version replaces the cloud version shown below.
      You can close this sheet and decide later.
    </p>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {conflicts.map(conflict => <article key={conflict.domain + ':' + conflict.documentId}
      aria-label={'Review ' + conflict.title} className="rounded-xl bg-surface p-3 space-y-3">
      <h4 className="font-medium text-white break-words">{conflict.title}</h4>
      <div className="overflow-auto max-h-72">
        <table className="w-full text-sm text-gray-300">
          <caption className="sr-only">Device and cloud changes for {conflict.title}</caption>
          <thead><tr>
            <th scope="col" className="text-left p-2">Change</th>
            <th scope="col" className="text-left p-2">This device</th>
            <th scope="col" className="text-left p-2">Cloud</th>
          </tr></thead>
          <tbody>{conflict.fields.map(field => <tr key={field.label}>
            <th scope="row" className="text-left align-top p-2">{field.label}</th>
            <td className="align-top p-2 break-words whitespace-pre-wrap">{value(field.label, field.local)}</td>
            <td className="align-top p-2 break-words whitespace-pre-wrap">{value(field.label, field.remote)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!conflict.canKeepLocal && <p className="text-sm text-gray-400">
        This change cannot be applied automatically. Your device copy is retained.
      </p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !conflict.canKeepLocal}
          onClick={() => void act(conflict, 'keepLocal')}>
          {conflict.fields.some(field => field.label === 'Deleted' && field.local === 'Yes')
            ? 'Apply my deletion' : 'Keep my version'}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void act(conflict, 'refresh')}>
          Refresh comparison
        </Button>
      </div>
    </article>)}
  </section>;
}
