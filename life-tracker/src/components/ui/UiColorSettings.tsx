import React, { useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAppearance } from '../../hooks/useAppearance';
import { useSettings } from '../../hooks/useSettings';
import { ACCENT_COLOR_PALETTES, isValidAccentColor } from '../../constants/colors';
import { BottomSheet } from './BottomSheet';
import { ColorPalettePicker } from './ColorPalettePicker';
import {
  UI_COLOR_ROLES, UI_COLOR_LABELS, applyUiColors, cacheUiColors,
  defaultUiColors, readCachedUiColors, resolveUiColorChoice, uiColorSettingKey,
  type UiColorChoice, type UiColorRole,
} from '../../lib/uiColors';

/** The global accent remains the simple mode. These settings opt in per visual region. */
export const UiColorSettings: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.$id ?? '';
  const { accentColor } = useAppearance();
  const { getSetting, setSetting, isLoading } = useSettings();
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UiColorRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ uid: string; role: UiColorRole; choice: UiColorChoice } | null>(null);
  const cached = React.useMemo(() => readCachedUiColors(uid), [uid]);
  // Derive the transient optimistic choice instead of clearing it in an effect.
  // Once the synced row catches up, the draft stops shadowing later device changes.
  const pendingDraft = draft?.uid === uid && (isLoading ||
    resolveUiColorChoice(getSetting(uiColorSettingKey(draft.role), 'default')) !== draft.choice)
    ? draft : null;
  const choices = defaultUiColors();
  for (const role of UI_COLOR_ROLES) {
    const value = isLoading ? cached[role] : resolveUiColorChoice(getSetting(uiColorSettingKey(role), 'default'));
    choices[role] = pendingDraft?.role === role ? pendingDraft.choice : value;
  }

  async function change(role: UiColorRole, next: UiColorChoice) {
    if (!uid || saving) return;
    const choice = resolveUiColorChoice(next);
    setDraft({ uid, role, choice });
    const updated = { ...choices, [role]: choice };
    cacheUiColors(uid, updated);
    applyUiColors(updated, accentColor);
    setSaving(true);
    try {
      await setSetting(uiColorSettingKey(role), choice);
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    if (!uid || saving) return;
    setSelectedRole(null);
    const defaults = defaultUiColors();
    cacheUiColors(uid, defaults);
    applyUiColors(defaults, accentColor);
    setDraft(null);
    setSaving(true);
    try {
      await Promise.all(UI_COLOR_ROLES.map(role => setSetting(uiColorSettingKey(role), 'default')));
    } finally {
      setSaving(false);
    }
  }

  const chosen = selectedRole ? choices[selectedRole] : 'default';
  const paletteColor = isValidAccentColor(chosen) ? chosen : '';
  return (
    <>
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#2A2A2A] focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        onClick={() => setOpen(true)} aria-label="Customize UI colors">
        <span className="flex items-center gap-3">
          <Palette size={18} className="text-emerald-500" aria-hidden="true" />
          <span><span className="block text-sm font-semibold text-white">Customize UI colors</span>
            <span className="block text-xs text-gray-400">Calendar, holidays, profile, navigation, icons and text</span>
          </span>
        </span>
        <span className="text-gray-400" aria-hidden="true">›</span>
      </button>
      <BottomSheet isOpen={open} onClose={() => { setOpen(false); setSelectedRole(null); }}
        title="Customize UI colors">
        <div className="space-y-3 px-4 pb-6">
          <p className="text-sm text-gray-400">Each color is independent. Default preserves the original theme.</p>
          {UI_COLOR_ROLES.map(role => {
            const choice = choices[role];
            const color = choice === 'default' ? null : choice === 'app' ? accentColor : choice;
            return (
              <button key={role} type="button" onClick={() => setSelectedRole(role)}
                disabled={!uid || saving} className="flex w-full items-center justify-between rounded-lg border border-[#333333] p-3 text-left focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                aria-label={`Customize ${UI_COLOR_LABELS[role]}`}>
                <span className="text-sm text-white">{UI_COLOR_LABELS[role]}</span>
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  {choice === 'default' ? 'Default' : choice === 'app' ? 'App accent' : 'Custom'}
                  <span className="h-6 w-6 rounded-full border border-[#444444]"
                    style={{ backgroundColor: color ?? 'var(--mosaic-surface)' }} aria-hidden="true" />
                </span>
              </button>
            );
          })}
          <button type="button" disabled={!uid || saving} onClick={() => void resetAll()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500/60">
            <RotateCcw size={15} aria-hidden="true" /> Reset all UI colors
          </button>
        </div>
      </BottomSheet>
      <BottomSheet isOpen={selectedRole !== null} onClose={() => setSelectedRole(null)}
        title={selectedRole ? UI_COLOR_LABELS[selectedRole] : 'Color'}>
        {selectedRole && (
          <div className="space-y-3 px-4 pb-5">
            <div role="group" aria-label={`${UI_COLOR_LABELS[selectedRole]} source`} className="flex gap-2">
              <button type="button" disabled={saving} aria-pressed={chosen === 'default'}
                className="rounded-lg border border-[#444444] px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                onClick={() => void change(selectedRole, 'default')}>Default</button>
              <button type="button" disabled={saving} aria-pressed={chosen === 'app'}
                className="rounded-lg border border-[#444444] px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                onClick={() => void change(selectedRole, 'app')}>App accent</button>
            </div>
            <ColorPalettePicker selectedColor={paletteColor} palettes={ACCENT_COLOR_PALETTES}
              ariaLabel={`Choose ${UI_COLOR_LABELS[selectedRole]} color`}
              onSelect={color => { if (!saving) void change(selectedRole, color); }} />
            {saving && <p role="status" className="text-xs text-gray-400">Saving preference…</p>}
          </div>
        )}
      </BottomSheet>
    </>
  );
};
