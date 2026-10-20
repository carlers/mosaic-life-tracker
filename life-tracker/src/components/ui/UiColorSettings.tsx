import React, { useMemo, useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAppearance } from '../../hooks/useAppearance';
import { useSettings } from '../../hooks/useSettings';
import { BottomSheet } from './BottomSheet';
import {
  UI_COLOR_GROUPS, UI_COLOR_LABELS, UI_COLOR_ROLES,
  applyUiColors, cacheUiColors, defaultUiColors,
  readCachedUiColors, resolveUiColorChoice, uiColorSettingKey,
  type UiColorChoices, type UiColorRole,
} from '../../lib/uiColors';

/** A single App accent, enabled or disabled for each independent visual role. */
export const UiColorSettings: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.$id ?? '';
  const { accentColor } = useAppearance();
  const { getSetting, setSetting, isLoading } = useSettings();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ uid: string; choices: Partial<UiColorChoices> } | null>(null);
  const cached = useMemo(() => readCachedUiColors(uid), [uid]);
  const resolved = defaultUiColors();
  for (const role of UI_COLOR_ROLES) {
    resolved[role] = isLoading ? cached[role]
      : resolveUiColorChoice(getSetting(uiColorSettingKey(role), undefined), role);
  }
  // Settled rows stop shadowing cross-device preference changes.
  const pending: Partial<UiColorChoices> = draft?.uid === uid ? draft.choices : {};
  const choices = { ...resolved };
  for (const role of UI_COLOR_ROLES) {
    if (pending[role] !== undefined && (isLoading || resolved[role] !== pending[role]))
      choices[role] = pending[role];
  }

  async function update(roles: Partial<UiColorChoices>) {
    if (!uid || saving) return;
    const values = { ...choices, ...roles };
    setDraft({ uid, choices: { ...pending, ...roles } });
    cacheUiColors(uid, values);
    applyUiColors(values, accentColor);
    setSaving(true);
    try {
      await Promise.all(Object.entries(roles).map(([role, value]) =>
        setSetting(uiColorSettingKey(role as UiColorRole), value)));
    } catch (error) {
      // Reconcile from the last known persisted view rather than leaving a
      // misleading optimistic state when a local write fails.
      setDraft(null);
      cacheUiColors(uid, resolved);
      applyUiColors(resolved, accentColor);
      console.error('[UiColorSettings] Failed to update accent scopes', error);
    } finally {
      setSaving(false);
    }
  }

  const defaults = defaultUiColors();
  const isDefault = UI_COLOR_ROLES.every(role => choices[role] === defaults[role]);

  return (
    <>
      <button type="button" className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-[#2A2A2A] focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        onClick={() => setOpen(true)} aria-label="Choose where accent color appears">
        <span className="mosaic-settings-icon flex items-center gap-3">
          <Palette size={18} className="text-emerald-500" aria-hidden="true" />
          <span><span className="block text-sm font-semibold text-white">Where accent color appears</span>
            <span className="block text-xs text-gray-400">Switch accents on for specific UI elements</span>
          </span>
        </span>
        <span className="h-6 w-6 shrink-0 rounded-full border border-white/20"
          style={{ backgroundColor: accentColor }} aria-hidden="true" />
      </button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Accent color placement">
        <div className="px-4 pb-6">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-surfaceHighlight p-3">
            <span className="h-8 w-8 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: accentColor }} aria-hidden="true" />
            <p className="mosaic-sheet-text text-sm text-gray-300">All switches use your single App accent color.</p>
          </div>
          {UI_COLOR_GROUPS.map(group => (
            <section key={group.title} aria-label={group.title} className="mb-4">
              <h3 className="mosaic-sheet-text mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.title}
              </h3>
              {group.roles.map(role => (
                <button key={role} type="button" role="switch"
                  aria-label={UI_COLOR_LABELS[role]}
                  aria-checked={choices[role]}
                  disabled={!uid || saving}
                  onClick={() => void update({ [role]: !choices[role] })}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-surfaceHighlight focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50">
                  <span className="mosaic-sheet-text">{UI_COLOR_LABELS[role]}</span>
                  <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${choices[role] ? 'bg-emerald-500' : 'bg-[#444444]'}`}>
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${choices[role] ? 'translate-x-5' : ''}`}/>
                  </span>
                </button>
              ))}
            </section>
          ))}
          <button type="button" disabled={!uid || saving || isDefault}
            onClick={() => void update(defaults)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50">
            <RotateCcw size={15} aria-hidden="true" /> <span className="mosaic-sheet-text">Restore default placements</span>
          </button>
          {saving && <p role="status" className="mt-2 text-xs text-gray-400">Saving…</p>}
        </div>
      </BottomSheet>
    </>
  );
};
