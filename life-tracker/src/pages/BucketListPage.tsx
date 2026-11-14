import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useBucketList } from '../hooks/useBucketList';
import { useFeatureEnabled } from '../hooks/useFeatureEnabled';
import { isFeatureEnabled } from '../lib/featureControls';
import { hasExpectedRouteParent, resolveRouteParent } from '../lib/primarySwipeNavigation';

export function BucketListPage() {
  const { items, isLoading, createItem } = useBucketList();
  const creationEnabled = useFeatureEnabled('mosaic_disable_bucket_list_creation');
  const navigate = useNavigate(), location = useLocation();
  const parent = resolveRouteParent('/bucket-list', location.state) ?? '/home';
  const [adding, setAdding] = useState(false), [title, setTitle] = useState(''), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [tab, setTab] = useState<'someday'|'completed'>('someday');
  const close = () => { setAdding(false); setTitle(''); setDescription(''); setError(''); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !isFeatureEnabled('mosaic_disable_bucket_list_creation')) return;
    setBusy(true); setError('');
    try { await createItem(title, description); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add item.'); }
    finally { setBusy(false); }
  };
  const someday = items.filter(item => !item.achieved);
  const completed = items.filter(item => item.achieved).sort((a,b) => b.achievedAt.localeCompare(a.achievedAt));
  const displayed = tab === 'someday' ? someday.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)) : completed;
  return <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
    <header className="mosaic-material-header flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
      <button type="button" aria-label="Back" className="rounded-lg p-2 focus-visible:ring-2 focus-visible:ring-current" onClick={() =>
        hasExpectedRouteParent(location.key, location.state, parent) ? navigate(-1) : navigate(parent, { replace: true })}><ChevronLeft size={20}/></button>
      <h1 className="mosaic-general-text flex-1 text-lg font-semibold">Bucket List</h1>
      {creationEnabled && <button type="button" aria-label="Add item" className="rounded-xl bg-surfaceHighlight p-2.5 focus-visible:ring-2 focus-visible:ring-current" onClick={() => setAdding(true)}><Plus size={19}/></button>}
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4" aria-label="Bucket List items">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Bucket List filters">
          <button type="button" aria-pressed={tab==='someday'} onClick={()=>setTab('someday')}
            className={`mosaic-material-control rounded-xl border px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-current ${tab==='someday'?'border-foreground/25 bg-surfaceHighlight':'border-border bg-surface'}`}>
            <span className="mosaic-general-text block text-xs text-muted-foreground">Someday</span>
            <span className="mt-1 block text-lg font-semibold tabular-nums">{someday.length}</span>
          </button>
          <button type="button" aria-pressed={tab==='completed'} onClick={()=>setTab('completed')}
            className={`mosaic-material-control rounded-xl border px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-current ${tab==='completed'?'border-foreground/25 bg-surfaceHighlight':'border-border bg-surface'}`}>
            <span className="mosaic-general-text block text-xs text-muted-foreground">Completed</span>
            <span className="mt-1 block text-lg font-semibold tabular-nums">{completed.length}</span>
          </button>
        </div>
        {isLoading ? <p role="status" className="text-sm text-muted-foreground">Loading items…</p>
          : displayed.length === 0 ? <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{tab==='someday'?'No items yet.':'No completed items.'}</p>
            {tab==='someday' && creationEnabled && <button type="button" className="mt-4 rounded-xl bg-surfaceHighlight px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-current" onClick={()=>setAdding(true)}>Add item</button>}
          </div> : <ul className="space-y-2">{displayed.map(item=><li key={item.id}>
          <button type="button" onClick={()=>navigate('/bucket-list/'+item.id, { state: { parentPath: '/bucket-list' } })}
            className="mosaic-material-panel group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-current">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug">{item.title}</span>
              {item.description && <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{item.description}</span>}
              {item.achieved && item.achievedAt && <span className="mt-1 block text-xs text-muted-foreground">Completed {new Date(item.achievedAt).toLocaleDateString()}</span>}
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true"/>
          </button>
        </li>)}</ul>}
      </div>
    </main>
    <BottomSheet isOpen={adding && creationEnabled} onClose={close} title="New item" height="auto" preventDismiss={busy}>
      <form onSubmit={save} className="space-y-4 px-4 pb-9 pt-3">
        <label className="block text-sm font-medium" htmlFor="bucket-new-title">Title</label>
        <input id="bucket-new-title" autoFocus required maxLength={255} value={title} onChange={e=>setTitle(e.target.value)}
          placeholder="e.g. See the northern lights" className="w-full rounded-xl border border-border bg-background px-3 py-3"/>
        <label className="block text-sm font-medium" htmlFor="bucket-new-note">Description (optional)</label>
        <textarea id="bucket-new-note" maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-3"/>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy || !creationEnabled} className="w-full rounded-xl bg-surfaceHighlight px-4 py-3 font-semibold disabled:opacity-50">{busy?'Saving…':'Add item'}</button>
      </form>
    </BottomSheet>
  </div>;
}
export default BucketListPage;
