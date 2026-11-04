import React, { useEffect, useState } from 'react';
import { SettingsRow } from '../ui/SettingsRow';
import { UsersRound, UserRoundSearch } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useFeatureEnabled } from '../../hooks/useFeatureEnabled';
import { getDiscoveryControls, setDiscoveryControls, type DiscoveryControls } from '../../lib/friendDiscovery';

export const DiscoveryPrivacySettings: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.$id || '';
  const connectivity = useConnectivity();
  const enabled = useFeatureEnabled('mosaic_disable_all_social');
  const [state, setState] = useState<{ owner: string; values: DiscoveryControls | null }>({
    owner: '', values: null,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!uid || !enabled || connectivity.status !== 'online') return;
    let live = true;
    void getDiscoveryControls().then(values => {
      if (live) {
        setState({ owner: uid, values });
        setError('');
      }
    }).catch(() => {
      if (live) setError('Privacy settings unavailable. Try again when online.');
    });
    return () => { live = false; };
  }, [uid, enabled, connectivity.status]);
  const loaded = state.owner === uid ? state.values : null;
  const ready = !!loaded && connectivity.status === 'online' && enabled && !pending;
  const change = async (field: 'allowBrowse' | 'allowAppear') => {
    if (!ready || !loaded) return;
    const currentUser = uid;
    setPending(true); setError('');
    try {
      const next = await setDiscoveryControls(field, !loaded[field], loaded.version);
      if (currentUser === uid) setState({ owner: uid, values: next });
    } catch {
      setError('Could not save this privacy setting. Reload this page to refresh it.');
      try {
        const fresh = await getDiscoveryControls();
        if (currentUser === uid) setState({ owner: uid, values: fresh });
      } catch { /* Preserve last confirmed snapshot, never infer success. */ }
    } finally { setPending(false); }
  };
  if (!enabled) return null;
  return <section className="border-b border-[#333333] py-2">
    <h2 className="px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-400">Friend discovery privacy</h2>
    <SettingsRow icon={<UsersRound size={18} aria-hidden="true"/>}
      label="Let friends browse my friends" isToggle showChevron={false}
      checked={loaded?.allowBrowse === true} disabled={!ready}
      onClick={() => void change('allowBrowse')}/>
    <p className="px-4 pb-3 text-xs text-gray-400">When enabled, accepted friends can browse only connections who also opted into discovery.</p>
    <SettingsRow icon={<UserRoundSearch size={18} aria-hidden="true"/>}
      label="Appear in friends-of-friends discovery" isToggle showChevron={false}
      checked={loaded?.allowAppear === true} disabled={!ready}
      onClick={() => void change('allowAppear')}/>
    <p className="px-4 pb-3 text-xs text-gray-400">Allow eligible friends-of-friends to see your discoverable profile and send a friend request.</p>
    {connectivity.status !== 'online' && <p className="px-4 pb-3 text-xs text-gray-400">Connect to manage visibility.</p>}
    {!loaded && connectivity.status === 'online' && !error && <p role="status" className="px-4 pb-3 text-xs text-gray-400">Loading privacy settings…</p>}
    {error && <p role="alert" className="px-4 pb-3 text-xs text-red-400">{error}</p>}
  </section>;
};
