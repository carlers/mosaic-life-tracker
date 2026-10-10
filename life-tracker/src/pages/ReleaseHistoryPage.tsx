import { useEffect, useState } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';
import { loadReleaseHistory, RELEASES_PAGE_URL, type ReleaseHistoryResult } from '../lib/releaseHistory';

export function ReleaseHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [result, setResult] = useState<ReleaseHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadReleaseHistory(refresh > 0, controller.signal).then(data => {
      if (active) setResult(data);
    }).catch(() => {
      if (active) setResult({ releases: [], source: 'unavailable', fetchedAt: null });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [refresh]);

  const back = () => {
    if (hasExpectedRouteParent(location.key, location.state, '/settings')) navigate(-1);
    else navigate('/settings', { replace: true });
  };

  return (
    <div className="min-h-full bg-background text-white">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#333333] bg-background px-4 py-3">
        <button type="button" onClick={back} onPointerDown={event => event.stopPropagation()}
          className="rounded-lg p-1 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Back to Settings"><ChevronLeft size={22} aria-hidden="true" /></button>
        <h1 className="flex-1 text-lg font-bold">Release history</h1>
        <button type="button" aria-label="Refresh release history" disabled={loading}
          onClick={() => { setLoading(true); setRefresh(count => count + 1); }}
          className="rounded-lg p-2 text-gray-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-5">
        <p className="mb-4 text-sm text-gray-400">
          Changes published to Mosaic production. Preview builds and development commits are not included.
        </p>
        {loading && !result && <p role="status" className="text-sm text-gray-400">Loading release history…</p>}
        {result && (
          <>
            {result.source === 'cached' && (
              <p role="status" className="mb-4 text-sm text-gray-400">
                Showing saved release history{result.fetchedAt ? ' from ' + new Date(result.fetchedAt).toLocaleDateString() : ''}. Refresh when connected for the latest notes.
              </p>
            )}
            {result.source === 'unavailable' && (
              <p role="alert" className="rounded-xl border border-[#333333] bg-surface px-4 py-3 text-sm">
                Release history could not be loaded. Check your connection and retry.
              </p>
            )}
            {result.source !== 'unavailable' && result.releases.length === 0 && (
              <p className="rounded-xl border border-[#333333] bg-surface px-4 py-4 text-sm text-gray-300">
                No production release notes have been published yet.
              </p>
            )}
            <div className="space-y-3">
              {result.releases.map(release => (
                <details key={release.tag} className="group rounded-xl border border-[#333333] bg-surface px-4 py-4">
                  <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-base font-semibold">{release.tag}</span>
                      <time dateTime={release.date} className="text-xs text-gray-400">
                        {new Date(release.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </time>
                    </span>
                    <span className="mt-1 block text-sm text-gray-300">{release.summary}</span>
                  </summary>
                  <div className="mt-3 border-t border-[#333333] pt-3">
                    {release.notes && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{release.notes}</p>}
                    <a href={release.url} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'var(--mosaic-accent-text)' }} className="mt-3 inline-block rounded-sm text-sm underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                      View official release on GitHub
                    </a>
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
        <a style={{ color: 'var(--mosaic-accent-text)' }} className="mt-6 inline-block text-sm underline" href={RELEASES_PAGE_URL}
          target="_blank" rel="noopener noreferrer">All published releases on GitHub</a>
      </main>
    </div>
  );
}
