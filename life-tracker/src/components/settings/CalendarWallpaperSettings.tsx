import React from 'react';
import type { CalendarWallpaperId, CalendarWallpaperScope } from '../../lib/calendarWallpaper';
import { CALENDAR_WALLPAPER_PRESETS } from '../../lib/calendarWallpaperPresets';

interface CalendarWallpaperSettingsProps {
  value: CalendarWallpaperId;
  dim: number;
  scope: CalendarWallpaperScope;
  onChange: (value: CalendarWallpaperId) => void;
  onDimChange: (value: number) => void;
  onScopeChange: (value: CalendarWallpaperScope) => void;
}

// Unlike a file picker, built-in presets never request media permissions or
// retain user-uploaded data. Each SVG is shipped and precached with the PWA.
export const CalendarWallpaperSettings: React.FC<CalendarWallpaperSettingsProps> = ({
  value, dim, scope, onChange, onDimChange, onScopeChange,
}) => (
  <div className="px-4 pb-5">
    <h3 className="mb-1 pt-2 text-sm font-semibold text-gray-300">Calendar wallpaper</h3>
    <p className="mb-3 text-xs text-gray-400">
      Choose a background for your calendar or all of Home. Task colors and other pages stay unchanged.
    </p>
    <div role="group" aria-label="Calendar wallpaper" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <button
        type="button" aria-pressed={value === 'none'} aria-label="No wallpaper"
        onClick={() => onChange('none')}
        className="min-w-0 rounded-lg text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        <span aria-hidden="true" className={`flex h-20 items-center justify-center rounded-lg border-2 bg-background text-xs text-gray-400 ${value === 'none' ? 'border-emerald-500' : 'border-[#444444]'}`}>
          Default
        </span>
        <span className="mt-1 block text-xs font-medium text-gray-300">None</span>
      </button>
      {CALENDAR_WALLPAPER_PRESETS.map(preset => (
        <button
          key={preset.id} type="button"
          aria-pressed={value === preset.id}
          aria-label={`${preset.label} wallpaper`}
          onClick={() => onChange(preset.id)}
          className="min-w-0 rounded-lg text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          <span
            aria-hidden="true"
            className={`block h-20 rounded-lg border-2 ${value === preset.id ? 'border-emerald-500' : 'border-[#444444]'}`}
            style={{
              backgroundColor: '#101827',
              backgroundImage: `url("${preset.src}")`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
          />
          <span className="mt-1 block text-xs font-medium text-gray-300">{preset.label}</span>
        </button>
      ))}
    </div>
    {value !== 'none' && (
      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-gray-300">Wallpaper coverage</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Wallpaper coverage">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-gray-300">
            <input type="radio" name="calendar-wallpaper-scope" value="grid"
              checked={scope === 'grid'} onChange={() => onScopeChange('grid')} />
            Calendar grid only
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-gray-300">
            <input type="radio" name="calendar-wallpaper-scope" value="home"
              checked={scope === 'home'} onChange={() => onScopeChange('home')} />
            Full Home (headers and friends)
          </label>
        </div>
      </fieldset>
    )}
    {value !== 'none' && (
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="calendar-wallpaper-dim" className="text-sm font-medium text-gray-300">
            Darken wallpaper
          </label>
          <output htmlFor="calendar-wallpaper-dim" className="text-xs tabular-nums text-gray-400">
            {dim}%
          </output>
        </div>
        <input
          id="calendar-wallpaper-dim"
          aria-label="Darken wallpaper"
          type="range" min={0} max={100} step={1} value={dim}
          onChange={(event) => onDimChange(Number(event.currentTarget.value))}
          className="w-full accent-emerald-500"
        />
      </div>
    )}
  </div>
);
