import { useState, type FormEvent } from 'react';
import { ChevronLeft, Plus, ArrowUpRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomSheet } from '../components/ui/BottomSheet';
import { useBucketList } from '../hooks/useBucketList';
import { hasExpectedRouteParent, resolveRouteParent } from '../lib/primarySwipeNavigation';

export function BucketListPage() {
  const { items, isLoading, createItem } = useBucketList();
  const navigate = useNavigate(), location = useLocation();
  const parent = resolveRouteParent('/bucket-list', location.state) ?? '/home';
  const [adding, setAdding] = useState(false), [title, setTitle] = useState(''), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [tab, setTab] = useState<'someday'|'lived'>('someday');
  const close = () => { setAdding(false); setTitle(''); setDescription(''); setError(''); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await createItem(title, description); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save aspiration.'); }
    finally { setBusy(false); }
  };
  const someday = items.filter(item => !item.achieved);
  const lived = items.filter(item => item.achieved).sort((a,b) => b.achievedAt.localeCompare(a.achievedAt));
  const displayed = tab === 'someday' ? someday.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)) : lived;
  return <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
    <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
      <button type="button" aria-label="Back" className="rounded-lg p-2 focus-visible:ring-2 focus-visible:ring-current" onClick={() =>
        hasExpectedRouteParent(location.key, location.state, parent) ? navigate(-1) : navigate(parent, { replace: true })}><ChevronLeft size={20}/></button>
      <h1 className="mosaic-general-text flex-1 text-lg font-semibold">Bucket List</h1>
      <button type="button" aria-label="Add aspiration" className="rounded-xl bg-surfaceHighlight p-2.5 focus-visible:ring-2 focus-visible:ring-current" onClick={() => setAdding(true)}><Plus size={19}/></button>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-7" aria-label="Bucket List aspirations">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-7 space-y-2">
          <span className="mosaic-general-text inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground"><Sparkles size={14}/> LIFE IN THE MAKING</span>
          <h2 className="mosaic-general-text text-2xl font-semibold tracking-tight">A life worth remembering.</h2>
          <p className="mosaic-general-text max-w-md text-sm leading-relaxed text-muted-foreground">A home for your someday dreams, and the stories you'll live along the way.</p>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-3" role="group" aria-label="Aspiration filters">
          <button type="button" aria-pressed={tab==='someday'} onClick={()=>setTab('someday')}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-current ${tab==='someday'?'border-foreground/25 bg-surfaceHighlight':'border-border bg-surface'}`}>
            <span className="mosaic-general-text block text-xs text-muted-foreground">Someday</span><span className="mt-1 block text-2xl font-semibold tabular-nums">{someday.length}</span>
          </button>
          <button type="button" aria-pressed={tab==='lived'} onClick={()=>setTab('lived')}
            className={`rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-current ${tab==='lived'?'border-foreground/25 bg-surfaceHighlight':'border-border bg-surface'}`}>
            <span className="mosaic-general-text block text-xs text-muted-foreground">Lived</span><span className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">{lived.length}<CheckCircle2 size={17} className="text-muted-foreground"/></span>
          </button>
        </div>
        {isLoading ? <p role="status" className="text-sm text-muted-foreground">Opening your list…</p>
          : displayed.length === 0 ? <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <Sparkles size={25} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground"/>
          <h3 className="mosaic-general-text mb-1 font-medium">{tab==='someday'?'What would you love to experience?':'Your future memories belong here.'}</h3>
          <p className="mosaic-general-text mx-auto mb-5 max-w-xs text-sm text-muted-foreground">{tab==='someday'?'Start with one dream. There are no deadlines here.':'When you live a dream, you can revisit it here.'}</p>
          {tab==='someday' && <button type="button" className="rounded-xl bg-surfaceHighlight px-4 py-2 font-medium" onClick={()=>setAdding(true)}>Add a dream</button>}
        </div> : <ul className="space-y-3">{displayed.map(item=><li key={item.id}>
          <button type="button" onClick={()=>navigate('/bucket-list/'+item.id, { state: { parentPath: '/bucket-list' } })}
            className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-5 text-left transition-colors hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-current">
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug">{item.title}</span>
              {item.description && <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">{item.description}</span>}
              {item.achieved && item.achievedAt && <span className="mt-2 block text-xs text-muted-foreground">Lived {new Date(item.achievedAt).toLocaleDateString()}</span>}
            </span>
            <ArrowUpRight size={18} className="shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true"/>
          </button>
        </li>)}</ul>}
      </div>
    </main>
    <BottomSheet isOpen={adding} onClose={close} title="A new dream" height="auto" preventDismiss={busy}>
      <form onSubmit={save} className="space-y-4 px-4 pb-9 pt-3">
        <label className="block text-sm font-medium" htmlFor="bucket-new-title">What would you love to do?</label>
        <input id="bucket-new-title" autoFocus required maxLength={255} value={title} onChange={e=>setTitle(e.target.value)}
          placeholder="See the northern lights" className="w-full rounded-xl border border-border bg-background px-3 py-3"/>
        <label className="block text-sm font-medium" htmlFor="bucket-new-note">A note to your future self (optional)</label>
        <textarea id="bucket-new-note" maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-3"/>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-surfaceHighlight px-4 py-3 font-semibold disabled:opacity-50">{busy?'Saving…':'Add to my Bucket List'}</button>
      </form>
    </BottomSheet>
  </div>;
}
export default BucketListPage;
