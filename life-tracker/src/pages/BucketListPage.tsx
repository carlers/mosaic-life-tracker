import { useState, type FormEvent } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBucketList } from '../hooks/useBucketList';
import type { BucketListDocument } from '../db/schema';
import { hasExpectedRouteParent, resolveRouteParent } from '../lib/primarySwipeNavigation';

export function BucketListPage() {
  const { items, isLoading, createItem, editItem, setAchieved, deleteItem } = useBucketList();
  const navigate = useNavigate();
  const location = useLocation();
  const parent = resolveRouteParent('/bucket-list', location.state) ?? '/home';
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const open = (item?: BucketListDocument) => {
    setSelected(item?.id ?? 'new');
    setTitle(item?.title ?? '');
    setDescription(item?.description ?? '');
    setError('');
  };
  const act = async (fn: () => Promise<void>) => {
    try { setError(''); await fn(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save.'); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await act(async () => {
        if (selected === 'new') await createItem(title, description);
        else if (selected) await editItem(selected, title, description);
        setSelected(null);
      });
    } finally { setBusy(false); }
  };
  const list = [...items].sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return <div className="flex h-full flex-col bg-background text-foreground">
    <header className="flex items-center gap-3 border-b border-border p-3">
      <button aria-label="Back" onClick={() => hasExpectedRouteParent(location.key, location.state, parent) ? navigate(-1) : navigate(parent, { replace: true })}><ChevronLeft /></button>
      <h1 className="flex-1 text-lg font-bold">Bucket List</h1>
      <button aria-label="Add aspiration" onClick={() => open()}><Plus /></button>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto space-y-4 px-4 py-5 pb-24">
      {error && <p role="alert" className="text-red-500">{error}</p>}
      {selected && <form onSubmit={save} className="space-y-3 rounded-xl border border-border p-4">
        <label className="block text-sm" htmlFor="aspiration-title">Aspiration</label>
        <input autoFocus id="aspiration-title" maxLength={255} required value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-border bg-background p-2" />
        <label className="block text-sm" htmlFor="aspiration-note">Description (optional)</label>
        <textarea id="aspiration-note" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-lg border border-border bg-background p-2" />
        <div className="flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)}>Cancel</button><button disabled={busy} type="submit">Save</button></div>
      </form>}
      {isLoading && <p role="status">Loading aspirations…</p>}
      {!isLoading && list.length === 0 && <p className="text-sm text-muted-foreground">Add something you want to experience or accomplish someday.</p>}
      {([false,true] as const).map(achieved => <section key={String(achieved)} aria-label={achieved ? 'Achieved aspirations' : 'Active aspirations'}>
        <h2 className="mb-3 font-semibold">{achieved ? 'Achieved' : 'Someday'}</h2>
        <ul className="space-y-2">{list.filter(item => item.achieved === achieved).map(item => <li key={item.id} className="rounded-xl border border-border p-4">
          <button className="w-full text-left" onClick={() => open(item)}><span className="font-medium">{item.title}</span>{item.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description}</p>}</button>
          {achieved && item.achievedAt && <p className="text-xs text-muted-foreground">Achieved {new Date(item.achievedAt).toLocaleDateString()}</p>}
          <div className="mt-3 flex gap-4 text-sm">
            <button onClick={() => void act(() => setAchieved(item.id, !achieved))}>{achieved ? 'Reopen' : 'Mark achieved'}</button>
            <button onClick={() => { if (window.confirm('Delete this aspiration?')) void act(() => deleteItem(item.id)); }} aria-label={'Delete ' + item.title}>Delete</button>
          </div>
        </li>)}</ul>
      </section>)}
    </main>
  </div>;
}
export default BucketListPage;
