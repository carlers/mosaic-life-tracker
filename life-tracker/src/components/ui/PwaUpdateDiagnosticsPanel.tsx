import { useSyncExternalStore, useState } from 'react';
import { pwaDiagnostics, pwaDiagnosticsEnabled } from '../../lib/pwaUpdateDiagnostics';

let revision = 0;
const getRevision = () => revision;
const onChange = (notify: () => void) => pwaDiagnostics.subscribe(() => {
  revision += 1;
  notify();
});

const formatTime = (milliseconds: number | null) =>
  milliseconds === null ? 'pending' : (milliseconds / 1000).toFixed(2) + 's';

export function PwaUpdateDiagnosticsPanel() {
  // Always call hooks; visibility is fixed by the trusted build channel.
  useSyncExternalStore(onChange, getRevision, getRevision);
  const [notice, setNotice] = useState('');
  if (!pwaDiagnosticsEnabled) return null;

  const records = pwaDiagnostics.getRecords().slice().reverse();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pwaDiagnostics.exportJson());
      setNotice('Local timing report copied.');
    } catch {
      setNotice('Copy blocked by the browser. Allow clipboard access and retry.');
    }
  };

  return (
    <details className="px-4 pb-3 text-sm text-gray-300" data-testid="pwa-update-diagnostics">
      <summary className="cursor-pointer py-2 font-medium text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
        Update timing diagnostics (Preview)
      </summary>
      <p className="my-2 text-xs text-gray-400">
        Stored only in this browser (up to 24 checks, 7 days). No automatic upload.
        Times cover update discovery and service-worker installation, not separately measurable
        network transfer. Asset bytes are uncompressed build sizes, not downloaded bytes.
      </p>
      <div className="mb-3 flex gap-3">
        <button type="button" onClick={() => void copy()} className="rounded-md border border-gray-600 px-3 py-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          Copy timing JSON
        </button>
        <button type="button" onClick={() => { pwaDiagnostics.clear(); setNotice('Local timing history cleared.'); }} className="rounded-md border border-gray-600 px-3 py-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          Clear history
        </button>
      </div>
      {notice && <p role="status" className="mb-2 text-xs text-gray-300">{notice}</p>}
      {records.length === 0 ? <p className="text-xs text-gray-400">No checks captured yet. Try Check for Updates.</p> :
        <ol className="space-y-2">
          {records.map((record) => (
            <li key={record.id} className="rounded-md border border-gray-700 p-2 text-xs">
              <div className="font-medium text-gray-200">
                {record.source} · {record.outcome ?? 'in progress'} · {formatTime(record.durationMs)}
              </div>
              {record.errorKind && <div>Error category: {record.errorKind}</div>}
              <div>{new Date(record.startedAt).toLocaleString()} · {record.visibleAtStart ? 'foreground' : 'hidden'} start · {record.onlineAtStart === false ? 'offline' : record.onlineAtStart === null ? 'network unknown' : 'online'}</div>
              <div className="mt-1 break-words text-gray-400">
                {record.events.map((event) => event.stage + ' ' + formatTime(event.elapsedMs)).join(' → ')}
              </div>
              {record.events.some((event) => event.totalAssets !== undefined) && (
                <div className="mt-1 text-gray-400">
                  Last observed precache progress: {
                    (() => {
                      const event = record.events.filter((item) => item.totalAssets !== undefined).at(-1)!;
                      return event.completedAssets + '/' + event.totalAssets + ' assets';
                    })()
                  }
                </div>
              )}
            </li>
          ))}
        </ol>
      }
    </details>
  );
}
