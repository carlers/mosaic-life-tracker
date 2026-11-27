import { useCallback, useEffect, useState } from 'react';
import { Clapperboard, RotateCw } from 'lucide-react';
import { getFloppyDay } from '../../../lib/floppyPreviewClient';
import type { FloppyActivity, FloppyActivityPage } from '../../../lib/floppyHistory';

type State =
  | { status: 'loading' | 'empty' | 'forbidden'; items: FloppyActivity[]; nextOffset: null }
  | { status: 'ready'; items: FloppyActivity[]; nextOffset: number | null }
  | { status: 'error'; items: FloppyActivity[]; nextOffset: null; message: string };

const INITIAL: State = { status: 'loading', items: [], nextOffset: null };

export default function FloppyDayActivity({ date }: { date: string }) {
  const [state, setState] = useState<State>(INITIAL);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    getFloppyDay(date).then(result => {
      if (!active) return;
      // Sanitized pages can contain no displayable records while still
      // having further provider rows. Keep pagination available in that case.
      setState(result.entries.length || result.nextOffset !== null
        ? { status: 'ready', items: result.entries, nextOffset: result.nextOffset }
        : { status: 'empty', items: [], nextOffset: null });
    }).catch((reason: unknown) => {
      if (!active) return;
      const status = typeof reason === 'object' && reason !== null
        ? (reason as { status?: number }).status : undefined;
      if (status === 403) {
        setState({ status: 'forbidden', items: [], nextOffset: null });
        return;
      }
      setState({
        status: 'error', items: [], nextOffset: null,
        message: reason instanceof Error && reason.message === 'Offline'
          ? 'Media history requires a connection.' : 'Floppy is unavailable.',
      });
    });
    return () => { active = false; };
  }, [date, revision]);

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMore = useCallback(async () => {
    if (state.status !== 'ready' || state.nextOffset === null || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result: FloppyActivityPage = await getFloppyDay(date, state.nextOffset);
      const ids = new Set(state.items.map(item => item.id));
      const items = [...state.items, ...result.entries.filter(item => !ids.has(item.id))];
      setState({ status: 'ready', items, nextOffset: result.nextOffset });
    } catch {
      // Keep the last valid page; a retry remains available.
    } finally {
      setIsLoadingMore(false);
    }
  }, [date, isLoadingMore, state]);

  if (state.status === 'empty' || state.status === 'loading' || state.status === 'forbidden')
    return null;
  if (state.status === 'error') return (
    <section aria-label="Floppy movies and TV" className="my-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{state.message}</span>
        <button type="button" onClick={() => { setState(INITIAL); setRevision(n => n + 1); }}
          className="rounded-lg px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Retry Floppy activity">Retry</button>
      </div>
    </section>
  );

  return (
    <section aria-label="Floppy movies and TV" data-testid="floppy-day-activity"
      className="my-3 rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
      <header className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Clapperboard size={16} aria-hidden="true" />
        <span>Movies &amp; TV</span>
        <span className="ml-auto text-xs opacity-65">Floppy · read-only</span>
      </header>
      <div className="space-y-2">
        {state.items.length === 0 && state.nextOffset !== null && (
          <p className="text-xs text-muted-foreground">
            No movies or TV entries on this page. More history is available.
          </p>
        )}
        {state.items.map(item => (
          <article key={item.id} className="rounded-xl bg-white/5 px-3 py-2"
            aria-label={item.kind === 'episode' ? 'Watched TV episode' : 'Watched movie'}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium" title={item.title}>{item.title}</div>
                {item.kind === 'episode' && <p className="text-xs opacity-70">
                  {[item.seriesTitle, item.episodeCode].filter(Boolean).join(' · ') || 'TV episode'}
                </p>}
                {item.needsPlayExpansion && <p className="text-xs opacity-70">
                  {item.playCount} watches recorded · individual dates not yet available
                </p>}
              </div>
              {item.rating !== null && <span className="shrink-0 text-xs opacity-70">{item.rating}/10</span>}
            </div>
          </article>
        ))}
      </div>
      {state.nextOffset !== null && <button type="button" onClick={loadMore} disabled={isLoadingMore}
        className="mt-3 flex items-center gap-2 rounded-lg px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2">
        <RotateCw size={13} aria-hidden="true" />{isLoadingMore ? 'Loading…' : 'More activity'}
      </button>}
    </section>
  );
}
