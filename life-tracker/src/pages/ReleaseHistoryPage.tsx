import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReleaseNotesMarkdown } from '../components/ui/ReleaseNotesMarkdown';
import { APP_BUILD_INFO } from '../lib/buildInfo';
import { hasExpectedRouteParent } from '../lib/primarySwipeNavigation';
import {
  buildUnifiedHistory, loadDevelopmentHistory, readCachedDevelopmentHistory,
  versionInChannel, type DevelopmentHistoryResult, type ReleaseStage, type UnifiedVersion,
} from '../lib/developmentHistory';
import {
  loadReleaseHistory, previewOnlyMilestones, readCachedReleaseHistory, RELEASES_PAGE_URL,
  type ReleaseHistoryResult,
} from '../lib/releaseHistory';

type Filter = 'all' | ReleaseStage;
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Production', value: 'production' },
  { label: 'Dev', value: 'dev' },
  { label: 'Preview', value: 'preview' },
];

function readableDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function installedStage() {
  if (APP_BUILD_INFO.channel === 'Production') return 'Production';
  if (APP_BUILD_INFO.branch === 'dev') return 'Dev';
  if (APP_BUILD_INFO.channel === 'Preview') return 'Preview';
  return 'Local';
}

function stageLabel(stage: ReleaseStage) {
  if (stage === 'production') return 'Production';
  return stage === 'dev' ? 'Dev' : 'Preview';
}

function HistoryCard({ entry }: { entry: UnifiedVersion }) {
  const production = !!entry.productionRelease;
  const stages = [...new Set(entry.events.map(e => e.stage))];
  const channels = [
    ...(production ? ['Production'] : []),
    ...stages.filter(stage => stage !== 'production').map(stageLabel),
    ...(entry.historicalPreview ? ['Historical Preview'] : []),
  ];
  const primaryStatus = production ? 'Released to Production' :
    stages.includes('dev') ? 'Delivered to Dev' :
      stages.includes('preview') ? 'Available for Preview testing' :
        'Historical Preview · not recorded as shipped';

  return (
    <details className="group overflow-hidden rounded-xl border border-[#333333] bg-surface">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent-text)] [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mosaic-settings-copy text-base font-semibold">{entry.tag}</span>
            {channels.map(channel => (
              <span key={channel} className="rounded-md bg-surfaceHighlight px-2 py-0.5 text-[11px] font-medium text-gray-300">
                {channel}
              </span>
            ))}
          </div>
          <p className="mosaic-settings-copy break-words text-sm font-medium">{entry.title}</p>
          <p className="text-xs text-gray-400">
            {primaryStatus}{readableDate(entry.date) ? ' · ' + readableDate(entry.date) : ''}
          </p>
        </div>
        <ChevronDown size={18} aria-hidden="true"
          className="mt-1 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-3 border-t border-[#333333] px-3 pb-3 pt-3">
        {entry.notes ? <ReleaseNotesMarkdown text={entry.notes} /> :
          <p className="text-xs text-gray-400">Detailed release notes were not provided.</p>}
        {!!entry.milestones.length && (
          <section className="space-y-2" aria-label={'Included version milestones for ' + entry.tag}>
            <h3 className="text-xs font-semibold text-gray-400">Included version milestones</h3>
            <div className="divide-y divide-[#333333] overflow-hidden rounded-lg border border-[#333333]">
              {entry.milestones.map(milestone => (
                <details key={milestone.tag} className="group/milestone">
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent-text)]">
                    <span className="font-semibold">{milestone.tag}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{milestone.title}</span>
                    <ChevronDown size={15} aria-hidden="true" className="shrink-0 text-gray-400 transition-transform group-open/milestone:rotate-180" />
                  </summary>
                  <div className="space-y-2 border-t border-[#333333] p-3 text-sm">
                    <ReleaseNotesMarkdown text={milestone.notes} />
                    {milestone.url && <a href={milestone.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs underline" style={{ color: 'var(--mosaic-accent-text)' }}>
                      View verified milestone <ExternalLink size={12} aria-hidden="true" />
                    </a>}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
        {!!entry.events.length && (
          <section aria-label={'Verified development history for ' + entry.tag} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400">Deployment history</h3>
            <ol className="space-y-2 border-l border-[#555555] pl-3">
              {entry.events.map(event => (
                <li key={event.id} className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="mosaic-settings-copy font-semibold">{stageLabel(event.stage)}</span>
                    <span className="text-gray-400">{readableDate(event.recordedAt) || 'Date unavailable'}</span>
                  </div>
                  <p className="break-all text-gray-400">
                    {event.branch} · {event.sha.slice(0, 8)}
                  </p>
                  {event.notes && event.notes !== entry.notes && <ReleaseNotesMarkdown text={event.notes} />}
                  <a href={event.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                    style={{ color: 'var(--mosaic-accent-text)' }}>View verified commit <ExternalLink size={12} aria-hidden="true" /></a>
                </li>
              ))}
            </ol>
          </section>
        )}
        {entry.historicalPreview && (
          <p className="text-xs text-gray-400">
            This older Preview entry comes from the reviewed historical archive;
            no current deployment status is implied.
          </p>
        )}
        {entry.productionRelease && (
          <a href={entry.productionRelease.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs underline"
            style={{ color: 'var(--mosaic-accent-text)' }}>
            View official Production release <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    </details>
  );
}

export function ReleaseHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [production, setProduction] = useState<ReleaseHistoryResult | null>(readCachedReleaseHistory);
  const [development, setDevelopment] = useState<DevelopmentHistoryResult | null>(readCachedDevelopmentHistory);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    void Promise.allSettled([
      loadReleaseHistory(refresh > 0, controller.signal),
      loadDevelopmentHistory(refresh > 0, controller.signal),
    ]).then(([prod, dev]) => {
      if (!active) return;
      if (prod.status === 'fulfilled') setProduction(prod.value);
      if (dev.status === 'fulfilled') setDevelopment(dev.value);
      if (prod.status === 'rejected') {
        setProduction(current => current ?? { releases: [], source: 'unavailable', fetchedAt: null });
      }
      if (dev.status === 'rejected') {
        setDevelopment(current => current ?? { events: [], source: 'unavailable', fetchedAt: null });
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [refresh]);

  const entries = useMemo(() => buildUnifiedHistory(
    production?.releases ?? [], development?.events ?? [],
    previewOnlyMilestones(production?.releases ?? []),
  ), [production, development]);
  const filtered = useMemo(() => entries.filter(entry => versionInChannel(entry, filter)),
    [entries, filter]);
  const visible = filtered.slice(0, visibleCount);

  const back = () => {
    if (hasExpectedRouteParent(location.key, location.state, '/settings')) navigate(-1);
    else navigate('/settings', { replace: true });
  };

  return (
    <div className="mosaic-settings-page min-h-full bg-background text-white">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#333333] bg-background px-4 py-3">
        <button type="button" onClick={back} onPointerDown={event => event.stopPropagation()}
          className="mosaic-settings-icon rounded-lg p-1 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label="Back to Settings"><ChevronLeft size={22} aria-hidden="true" /></button>
        <h1 className="flex-1 text-lg font-bold">Release history</h1>
        <button type="button" aria-label="Refresh release history" disabled={loading}
          onClick={() => { setLoading(true); setRefresh(count => count + 1); }}
          className="mosaic-settings-icon rounded-lg p-2 text-gray-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
          <RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
        </button>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 px-3 pb-24 pt-3">
        <section className="rounded-lg border border-[#333333] bg-surface p-3" aria-label="Installed build">
          <p className="text-xs text-gray-400">Your installed version</p>
          <p className="mosaic-settings-copy text-sm font-semibold">
            v{APP_BUILD_INFO.version} <span className="font-normal text-gray-400">· {installedStage()}</span>
          </p>
          {APP_BUILD_INFO.commitShort &&
            <p className="mt-1 text-xs text-gray-400">Build {APP_BUILD_INFO.commitShort}</p>}
        </section>
        <div role="group" aria-label="Filter release history by channel"
          className="grid grid-cols-4 gap-1 rounded-lg bg-surface p-1">
          {FILTERS.map(option => (
            <button key={option.value} type="button" aria-pressed={filter === option.value}
              onClick={() => { setFilter(option.value); setVisibleCount(30); }}
              className={'min-w-0 rounded-md px-1 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent-text)] ' +
                (filter === option.value ? 'bg-surfaceHighlight mosaic-settings-copy' : 'text-gray-400 hover:bg-surfaceHighlight/60')}>
              {option.label}
            </button>
          ))}
        </div>
        {(production?.source === 'cached' || development?.source === 'cached') &&
          <p role="status" className="text-xs text-gray-400">
            Showing saved history{loading ? ' · Checking for updates…' : ''}
          </p>}
        {development?.source === 'unavailable' && (
          <p role="status" className="text-xs text-gray-400">
            Live Dev/Preview history is unavailable. Verified saved and historical entries remain visible.
          </p>
        )}
        {production?.source === 'unavailable' && (
          <p role="status" className="text-xs text-gray-400">
            Official Production history is unavailable. Retry when connected.
          </p>
        )}
        {loading && !production && !development && <p role="status" className="text-sm text-gray-400">Loading history…</p>}
        {visible.length ? (
          <div className="space-y-3">
            {visible.map(entry => <HistoryCard key={entry.key} entry={entry} />)}
          </div>
        ) : !loading && (
          <p className="rounded-lg border border-[#333333] bg-surface p-3 text-sm text-gray-400">
            No verified {filter === 'all' ? 'versions' : FILTERS.find(x => x.value === filter)?.label + ' versions'} available.
          </p>
        )}
        {visibleCount < filtered.length &&
          <button type="button" onClick={() => setVisibleCount(n => n + 30)}
            className="w-full rounded-lg border border-[#333333] bg-surface p-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent-text)]">
            Show older versions
          </button>}
        <a style={{ color: 'var(--mosaic-accent-text)' }} className="inline-flex items-center gap-1 text-xs underline"
          href={RELEASES_PAGE_URL} target="_blank" rel="noopener noreferrer">
          All official Production releases on GitHub <ExternalLink size={12} aria-hidden="true" />
        </a>
      </main>
    </div>
  );
}
