import React, { useState } from 'react';
import { Activity, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';

/**
 * Issue #862: review-only visual concept. Uses invented fixed values.
 * No OAuth, API requests, local storage, task writes, category mapping or social payloads.
 * This MUST NOT be repurposed for real Strava data before provider policy clearance.
 */
export const StravaConceptSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [layout, setLayout] = useState<'standalone' | 'linked'>('standalone');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [density, setDensity] = useState<'minimal' | 'standard' | 'detailed'>('standard');

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Strava activity concept" height="auto">
      <div className="flex flex-col gap-4 px-4 pb-8 pt-2 text-white">
        <div role="status" className="mosaic-material-panel rounded-xl border border-[#444444] p-3 text-sm text-gray-300">
          <div className="flex items-center gap-2 font-semibold text-white">
            <ShieldCheck size={17} aria-hidden="true" />
            Sample-only UX prototype
          </div>
          <p className="mt-1">All workout details shown here are invented. Mosaic has not connected to Strava, read an activity, or changed a task.</p>
        </div>

        <section aria-labelledby="strava-connection-title" className="mosaic-material-panel rounded-xl border border-[#333333] p-3">
          <h3 id="strava-connection-title" className="flex items-center gap-2 text-sm font-semibold">
            <LockKeyhole size={16} aria-hidden="true" /> Connection
          </h3>
          <p className="mt-1 text-sm text-gray-400">Not connected. API access, consent and data-use policy approval are required.</p>
          <button type="button" disabled className="mt-3 w-full rounded-lg bg-[#333333] px-3 py-2 text-sm font-medium text-gray-400 disabled:cursor-not-allowed">
            Connect to Strava (unavailable)
          </button>
        </section>

        <section aria-label="Example activity placement">
          <h3 className="mb-2 text-sm font-semibold">Card placement</h3>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Activity layout">
            <button type="button" aria-pressed={layout === 'standalone'}
              onClick={() => setLayout('standalone')}
              className={'rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500 ' + (layout === 'standalone' ? 'border-emerald-500 bg-emerald-500/15' : 'border-[#444444] bg-[#222222]')}>
              Standalone
            </button>
            <button type="button" aria-pressed={layout === 'linked'}
              onClick={() => setLayout('linked')}
              className={'rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-emerald-500 ' + (layout === 'linked' ? 'border-emerald-500 bg-emerald-500/15' : 'border-[#444444] bg-[#222222]')}>
              Linked concept
            </button>
          </div>
        </section>

        <section aria-label="Activity appearance">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="strava-concept-density" className="text-sm font-semibold">Display density</label>
            <select id="strava-concept-density" value={density}
              onChange={(event) => setDensity(event.target.value as typeof density)}
              className="mosaic-material-control rounded-lg border border-[#444444] bg-[#222222] px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-emerald-500">
              <option value="minimal">Minimal</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div className="mosaic-material-panel rounded-xl border border-[#444444] p-3">
            {layout === 'linked' && (
              <div className="mb-3 border-b border-[#444444] pb-3">
                <p className="text-xs text-gray-400">Illustrative planned Mosaic task</p>
                <p className="mt-1 text-sm font-semibold">○ Go for a run</p>
                <p className="mt-1 text-xs text-amber-300">Not actually linked or completed</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-emerald-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold">Sample morning run</h4>
                <p className="text-xs text-gray-400">Running · Fictional activity</p>
              </div>
              <button type="button" aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
                className="rounded-lg px-2 py-1 text-xs text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500">
                {detailsOpen ? 'Hide details' : 'Show details'}
              </button>
            </div>
            {density !== 'minimal' && (
              <dl className="mt-3 grid grid-cols-3 gap-2">
                <div><dt className="text-xs text-gray-400">Distance</dt><dd className="text-sm font-semibold">5.0 km</dd></div>
                <div><dt className="text-xs text-gray-400">Moving</dt><dd className="text-sm font-semibold">29 min</dd></div>
                <div><dt className="text-xs text-gray-400">Pace</dt><dd className="text-sm font-semibold">5:48/km</dd></div>
              </dl>
            )}
            {detailsOpen && (
              <div className="mt-3 border-t border-[#444444] pt-2 text-xs text-gray-300">
                {density === 'detailed' && <p>Example elevation: 42 m</p>}
                <p>GPS routes and heart-rate information are intentionally excluded.</p>
                <p className="mt-1">In an approved integration, a separate View on Strava control would open the original activity.</p>
              </div>
            )}
          </div>
        </section>

        <div className="rounded-lg border border-[#444444] px-3 py-3 text-sm">
          <p className="font-semibold">Automation unavailable</p>
          <p className="mt-1 text-gray-400">Task matching, completion changes, imported history and social display require separate Strava policy clearance.</p>
          <button type="button" disabled className="mt-2 rounded-lg bg-[#333333] px-3 py-2 text-gray-400 disabled:cursor-not-allowed">
            Attach activity to task (unavailable)
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
