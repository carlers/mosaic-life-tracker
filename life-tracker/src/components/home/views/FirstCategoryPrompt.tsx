import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ColorPalettePicker } from '../../ui/ColorPalettePicker';
import { MosaicSelect } from '../../ui/MosaicSelect';
import type { CategoryDocument } from '../../../db/schema';

export type FirstCategoryDetails = Pick<CategoryDocument, 'name' | 'color' | 'visibility'>;

interface FirstCategoryPromptProps {
  onCreate: (draft: FirstCategoryDetails) => Promise<void>;
  persistent?: boolean;
}

// Only mounted for the active, hydrated owner Day View: either when no
// categories exist, or as a user-enabled persistent footer action.
// Category Manager and this entry point share the same useCategories mutation.
export const FirstCategoryPrompt: React.FC<FirstCategoryPromptProps> = ({ onCreate, persistent = false }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [visibility, setVisibility] = useState<CategoryDocument['visibility']>('private');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const cancel = () => {
    if (submittingRef.current) return;
    setEditing(false);
    setName('');
    setColor('#3B82F6');
    setVisibility('private');
    setError('');
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onCreate({ name: trimmed, color, visibility });
      setCreated(true);
      setEditing(false);
      if (persistent) {
        setName('');
        setColor('#3B82F6');
        setVisibility('private');
        // The footer stays mounted for another category; restore keyboard focus.
        requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message :
        'Could not add category. Try again.');
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className={`swiper-no-swiping my-3 ${editing
      ? 'rounded-2xl border border-[#333333] bg-surface px-4 py-4'
      : 'px-4 py-2'}`}
      data-testid="first-category-prompt" data-route-swipe-ignore="true" aria-label={persistent ? 'Add category' : 'Create your first category'}>
      {created && !persistent ? (
        <p role="status" className="text-sm text-gray-300">Category added.</p>
      ) : !editing ? (
        <div className="flex flex-col items-center gap-2 text-center">
          {!persistent && (
            <>
              <p className="text-sm font-semibold text-white">No categories yet</p>
              <p className="text-xs text-gray-400">Create a category to start organizing your tasks.</p>
            </>
          )}
          {persistent && created && <p role="status" className="text-xs text-gray-400">Category added.</p>}
          <button ref={triggerRef} type="button" onClick={() => { setCreated(false); setEditing(true); }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-surfaceHighlight px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            <Plus size={16} aria-hidden="true" /> Add category
          </button>
        </div>
      ) : (
        <form aria-label="Create category" onSubmit={event => void submit(event)}
          onKeyDown={event => {
            if (event.key === 'Escape' && !saving) {
              event.preventDefault();
              event.stopPropagation();
              cancel();
            }
          }} className="space-y-3">
          <p className="text-sm font-semibold text-white">New category</p>
          <fieldset disabled={saving} className="space-y-3">
            <label className="block text-sm text-gray-300">
              Name
              <input type="text" autoFocus autoComplete="off" maxLength={100}
                value={name} onChange={event => setName(event.target.value)}
                aria-label="Category name" placeholder="e.g. Work, Personal"
                className="mt-1 w-full rounded-lg border border-[#444444] bg-background px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60" />
            </label>
            <div>
              <p className="mb-1 text-sm text-gray-300">Color</p>
              <ColorPalettePicker selectedColor={color} onSelect={setColor} ariaLabel="Category color" />
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-300">Visibility</p>
              <MosaicSelect label="Category visibility" value={visibility}
                onChange={value => setVisibility(value as CategoryDocument['visibility'])}
                options={[
                  { value: 'private', label: 'Private' },
                  { value: 'followers', label: 'Followers' },
                  { value: 'public', label: 'Public' },
                ]} />
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving || !name.trim()}
              className="rounded-lg bg-surfaceHighlight px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50">
              {saving ? 'Adding…' : 'Add Category'}
            </button>
            <button type="button" onClick={cancel} disabled={saving}
              className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-surfaceHighlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
