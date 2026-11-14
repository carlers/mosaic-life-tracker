import React from 'react';
import { Check } from 'lucide-react';
import { MosaicSelect, type MosaicSelectOption } from '../ui/MosaicSelect';
import type {
  WallpaperUploadSlot, CalendarWallpaperId, CalendarWallpaperScope,
} from '../../lib/calendarWallpaper';
import {
  WALLPAPER_PAGE_KEYS, type WallpaperPageKey, type PageWallpaperChoice,
  type PageWallpaperChoices,
} from '../../lib/wallpaperPageSettings';
import { CALENDAR_WALLPAPER_PRESETS } from '../../lib/calendarWallpaperPresets';
import type { WallpaperMaterial } from '../../lib/wallpaperPageSettings';

const PAGE_LABELS: Record<WallpaperPageKey, string> = {
  explore: 'Explore',
  alerts: 'Alerts',
  chat: 'Chat and conversations',
  me: 'Me and profile',
  settings: 'Settings',
  settingsSubpages: 'Settings subpages',
  other: 'Other pages (Backlogs, Bucket List)',
};
interface Props {
  value: CalendarWallpaperId;
  dim: number;
  scope: CalendarWallpaperScope;
  pages: PageWallpaperChoices;
  uploadSlots: readonly WallpaperUploadSlot[];
  material: WallpaperMaterial;
  transparency: number;
  onMaterialChange: (value: WallpaperMaterial) => void;
  onTransparencyChange: (value: number) => void;
  uploadLibrary?: React.ReactNode;
  onChange: (id: CalendarWallpaperId) => void;
  onDimChange: (dim: number) => void;
  onScopeChange: (scope: CalendarWallpaperScope) => void;
  onPageChange: (page: WallpaperPageKey, choice: PageWallpaperChoice) => void;
}
export const CalendarWallpaperSettings: React.FC<Props> = ({
  value, dim, scope, pages, uploadSlots, uploadLibrary, material, transparency,
  onChange, onDimChange, onScopeChange, onPageChange, onMaterialChange, onTransparencyChange,
}) => {
  const options: MosaicSelectOption[] = [
    { value: 'off', label: 'Off' },
    { value: 'home', label: 'Use Home wallpaper' },
    ...CALENDAR_WALLPAPER_PRESETS.map(item => ({ value: item.id, label: item.label })),
    ...uploadSlots.map(slot => ({ value: `upload:${slot}`, label: `My photo ${slot + 1}` })),
  ];
  return (
    <div className="px-4 pb-6" data-setting-label="Wallpaper & glass preferences">
      <h3 className="mb-1 pt-2 text-sm font-semibold text-gray-300">Page backgrounds</h3>
      <p className="mb-4 text-xs leading-relaxed text-gray-400">
        Choose a Home background, then reuse it or set a different one for each page.
      </p>
      <h4 className="mb-2 text-sm font-semibold text-gray-300">Home wallpaper</h4>
      {value.startsWith('upload:') && (
        <p className="mb-3 text-xs text-emerald-400">Selected for Home: My photo {Number(value.slice(-1)) + 1}</p>
      )}
      <div role="group" aria-label="Home wallpaper" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button type="button" aria-pressed={value === 'none'} aria-label="No wallpaper"
          onClick={() => onChange('none')}
          className="min-w-0 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <span aria-hidden="true" className={`flex h-20 items-center justify-center rounded-lg border-2 bg-background text-xs text-gray-400 ${value === 'none' ? 'border-emerald-500' : 'border-border'}`}>Default</span>
          <span className="mt-1 block text-xs font-medium text-gray-300">None</span>
        </button>
        {CALENDAR_WALLPAPER_PRESETS.map(preset => (
          <button key={preset.id} type="button" aria-pressed={value === preset.id}
            aria-label={`${preset.label} wallpaper`} onClick={() => onChange(preset.id)}
            className="min-w-0 rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <span aria-hidden="true" className={`relative block h-20 overflow-hidden rounded-lg border-2 ${value === preset.id ? 'border-emerald-500' : 'border-border'}`}
              style={{ backgroundColor: '#101827', backgroundImage: `url("${preset.src}")`, backgroundPosition: 'center', backgroundSize: 'cover' }}>
              {value === preset.id && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-sm">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="mt-1 block text-xs font-medium text-gray-300">{preset.label}</span>
          </button>
        ))}
      </div>
      {uploadLibrary}
      {value !== 'none' && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-gray-300">Home wallpaper coverage</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Wallpaper coverage">
            {([
              ['grid', 'Calendar grid only'],
              ['home', 'Full Home (headers and friends)'],
            ] as const).map(([id, title]) => (
              <button key={id} type="button" aria-pressed={scope === id} onClick={() => onScopeChange(id)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${scope === id ? 'border-emerald-500 bg-emerald-500/15 text-white' : 'border-border bg-surface text-gray-300'}`}>
                {title}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="mt-6 border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-gray-300">Other pages</h4>
        <p className="mb-3 mt-1 text-xs text-gray-400">
          Choose Off, reuse Home, or give each page its own background. Changes sync to your account.
        </p>
        <div className="mosaic-material-panel space-y-3 rounded-2xl border border-border p-2">
          {WALLPAPER_PAGE_KEYS.map(page => (
            <div key={page} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2.5">
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-300">{PAGE_LABELS[page]}</span>
              <MosaicSelect label={PAGE_LABELS[page] + ' wallpaper'}
                value={pages[page]}
                options={options}
                onChange={choice => onPageChange(page, choice as PageWallpaperChoice)}
                variant="compact" className="w-[min(55%,210px)] shrink-0" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="calendar-wallpaper-dim" className="text-sm font-medium text-gray-300">
            Darken wallpaper
          </label>
          <output htmlFor="calendar-wallpaper-dim" className="text-xs tabular-nums text-gray-400">{dim}%</output>
        </div>
        <input id="calendar-wallpaper-dim" aria-label="Darken wallpaper" type="range"
          min={0} max={100} step={1} value={dim}
          onChange={event => onDimChange(Number(event.currentTarget.value))}
          className="w-full accent-emerald-500" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-400">Darkening affects every enabled wallpaper, independently of glass clarity.</p>
      <div className="mt-5 border-t border-border pt-4" data-setting-label="Interface material">
        <h4 className="text-sm font-semibold text-gray-300">Interface material</h4>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-gray-400">
          Affects pages with wallpaper only. Keep Solid for maximum text separation.
        </p>
        <div role="group" aria-label="Interface material" className="grid grid-cols-2 gap-2">
          {(['soft', 'solid'] as const).map(option => (
            <button key={option} type="button" aria-pressed={material === option}
              aria-label={option === 'soft' ? 'Soft Frosted' : 'Solid'}
              onClick={() => onMaterialChange(option)}
              className={`flex min-h-20 flex-col justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${material === option ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-surface'}`}>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{option === 'soft' ? 'Soft Frosted' : 'Solid'}</span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${material === option ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-border'}`} aria-hidden="true">
                  {material === option && <Check size={13} strokeWidth={3} />}
                </span>
              </span>
              <span className="text-xs leading-snug text-gray-400">
                {option === 'soft' ? 'Blurs and tints wallpaper behind controls.' : 'Original opaque surfaces and controls.'}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4" data-setting-label="Glass transparency">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="calendar-glass-transparency" className="text-sm font-medium text-gray-300">Glass transparency</label>
            <output htmlFor="calendar-glass-transparency" className="text-xs tabular-nums text-gray-400">{transparency}%</output>
          </div>
          <input id="calendar-glass-transparency" type="range" min={0} max={100} step={10}
            value={transparency} disabled={material === 'solid'}
            aria-label="Glass transparency"
            onChange={event => onTransparencyChange(Number(event.currentTarget.value))}
            className="w-full accent-emerald-500 disabled:opacity-40" />
          <div className="mt-1 flex justify-between text-xs text-gray-400"><span>More opaque</span><span>More transparent</span></div>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            Relative strength: even at 100%, glass retains a tint to help text stay legible.
          </p>
        </div>
      </div>
    </div>
  );
};
