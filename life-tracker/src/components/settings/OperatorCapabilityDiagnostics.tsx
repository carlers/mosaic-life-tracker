import React, { useState, useSyncExternalStore } from 'react';
import { BUILD_CAPABILITIES, BUILD_CAPABILITY_PROFILE, BUILD_PROVIDER, CAPABILITY_KEYS } from '../../lib/capabilityProfile';
import { FEATURE_DISABLE_FLAGS } from '../../lib/featureControls';
import { getPostHogFeatureFlagState, subscribePostHogFeatureFlags } from '../../lib/posthog';

const flags = Object.values(FEATURE_DISABLE_FLAGS);
function snapshot(): string {
  return flags.map(flag => {
    const state = getPostHogFeatureFlagState(flag);
    return (state.enabled ? '1' : '0') + (state.isLoaded ? '1' : '0') + (state.hasError ? '1' : '0');
  }).join(':');
}
/** Read-only diagnostics. No PostHog admin credentials or mutation calls. */
export const OperatorCapabilityDiagnostics: React.FC = () => {
  const [query, setQuery] = useState('');
  const states = useSyncExternalStore(subscribePostHogFeatureFlags, snapshot, () => '');
  const values = states.split(':');
  const visible = flags.filter(flag => flag.toLowerCase().includes(query.toLowerCase()));
  return <div className="border-t border-[#333333] px-4 py-4">
    <h3 className="text-sm font-semibold">Developer capability diagnostics (read only)</h3>
    <p className="mt-1 text-xs text-gray-400">Build: {BUILD_CAPABILITY_PROFILE} · Provider: {BUILD_PROVIDER}. Remote flags cannot grant unsupported capabilities.</p>
    <p className="mt-1 text-xs text-gray-400">Build capabilities: {CAPABILITY_KEYS.filter(key => BUILD_CAPABILITIES[key]).length}/{CAPABILITY_KEYS.length}</p>
    <input aria-label="Search operator flags" type="search" value={query} onChange={event => setQuery(event.target.value)}
      placeholder="Search controls" className="my-3 w-full rounded-md bg-[#242424] p-2 text-sm text-white" />
    <ul aria-label="Operator flag states" className="max-h-80 space-y-1 overflow-y-auto text-xs">
      {visible.map(flag => {
        const state = values[flags.indexOf(flag)] || '';
        const label = state[1] === '0' ? 'Pending/offline' : state[2] === '1' ? 'Unavailable' : state[0] === '1' ? 'Disabled' : 'Available';
        return <li key={flag} className="flex justify-between gap-2 py-1"><span className="break-all">{flag}</span><span className="shrink-0 text-gray-400">{label}</span></li>;
      })}
    </ul>
  </div>;
};
