import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReleaseNotesMarkdown } from '../components/ui/ReleaseNotesMarkdown';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';
import {
  loadReleaseHistory, previewOnlyMilestones, readCachedReleaseHistory, RELEASES_PAGE_URL,
  type ReleaseHistoryResult, type VersionMilestone,
} from '../lib/releaseHistory';

function MilestoneRow({ entry, releaseUrl }: { entry: VersionMilestone; releaseUrl: string }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-sm font-semibold">{entry.tag}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{entry.title}</span>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#333333] px-3 pb-3 pt-2">
        {entry.notes && <ReleaseNotesMarkdown text={entry.notes} />}
        <a href={entry.url || releaseUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--mosaic-accent-text)' }}
          className="mt-2 inline-block rounded-sm text-xs underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          {entry.url ? 'View version change on GitHub' : 'View production release on GitHub'}
        </a>
      </div>
    </details>
  );
}

export function ReleaseHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // A previously visited history is visible on the very first render, even offline.
  const [result, setResult] = useState<ReleaseHistoryResult | null>(readCachedReleaseHistory);
  const [loading, setLoading] = useState(() => !readCachedReleaseHistory());
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void loadReleaseHistory(refresh > 0, controller.signal).then(data => {
      if (active) setResult(data);
    }).catch(() => {
      if (active && !result) setResult({ releases: [], source: 'unavailable', fetchedAt: null });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; controller.abort(); };
    // Each refresh starts an independent abortable request. Cached data stays visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <main className="mx-auto max-w-2xl px-3 pb-24 pt-3">
        {loading && !result && <p role="status" className="text-sm text-gray-400">Loading history…</p>}
        {result && (
          <>
            {result.source === 'cached' && (
              <p role="status" className="mb-3 text-xs text-gray-400">
                Saved history{result.fetchedAt ? ' · ' + new Date(result.fetchedAt).toLocaleDateString() : ''}.
                {loading ? ' Checking for updates…' : ''}
              </p>
            )}
            {result.source === 'unavailable' && (
              <p role="alert" className="rounded-lg border border-[#333333] bg-surface px-3 py-2 text-sm">
                History unavailable. Retry when connected.
              </p>
            )}
            {result.source !== 'unavailable' && result.releases.length === 0 && (
              <p className="rounded-lg border border-[#333333] bg-surface p-3 text-sm text-gray-300">
                No production releases published yet.
              </p>
            )}
            <div className="space-y-3">
              {result.releases.map(release => {
                const entries: VersionMilestone[] = release.milestones.length
                  ? release.milestones
                  : [{ tag: release.tag, title: release.summary, notes: release.notes }];
                return (
                  <section key={release.tag} aria-label={'Production release ' + release.tag}
                    className="overflow-hidden rounded-lg border border-[#333333] bg-surface">
                    <div className="flex items-center justify-between gap-2 border-b border-[#333333] px-3 py-2 text-xs text-gray-400">
                      <span>Production {release.tag}</span>
                      <time dateTime={release.date}>
                        {new Date(release.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </time>
                    </div>
                    <div className="divide-y divide-[#333333]">
                      {entries.map(entry => (
                        <MilestoneRow key={entry.tag} entry={entry} releaseUrl={release.url} />
                      ))}
                    </div>
                        </details>
                      ))}
                    </div>
                    {release.milestones.length > 0 && (
                      <details className="border-t border-[#333333] px-3 py-2 text-xs text-gray-400">
                        <summary className="cursor-pointer">Overall release notes</summary>
                        <div className="mt-2">{release.notes && <ReleaseNotesMarkdown text={release.notes} />}</div>
                      </details>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
        <section aria-label="Preview-only version history" className="mt-4 overflow-hidden rounded-lg border border-[#333333] bg-surface">
          <h2 className="border-b border-[#333333] px-3 py-2 text-xs font-medium text-gray-400">
            Preview-only versions · not released to production
          </h2>
          <div className="divide-y divide-[#333333]">
            {previewOnlyMilestones(result?.releases || []).map(entry => (
              <MilestoneRow key={entry.tag} entry={entry} releaseUrl={RELEASES_PAGE_URL} />
            ))}
          </div>
        </section>
        <a style={{ color: 'var(--mosaic-accent-text)' }} className="mt-4 inline-block text-xs underline"
          href={RELEASES_PAGE_URL} target="_blank" rel="noopener noreferrer">All production releases on GitHub</a>
      </main>
    </div>
  );
}
