import { useState } from 'react';
import { Layers3 } from 'lucide-react';
import { SettingsRow } from '../ui/SettingsRow';
import { setDeviceEdgeToEdge, toggleImmersiveFullscreen, useDeviceEdgeToEdge, useFullscreenState } from '../../lib/immersiveDisplay';

export function NavigationDisplaySettings({ ownerId, floating, onFloatingChange }: {
  ownerId?: string;
  floating: boolean;
  onFloatingChange: (value: boolean) => void;
}) {
  const edgeToEdge = useDeviceEdgeToEdge(ownerId);
  const fullscreen = useFullscreenState();
  const [error, setError] = useState('');
  const icon = <Layers3 size={18} className="text-gray-400" aria-hidden="true" />;
  return (
    <>
      <SettingsRow icon={icon} label="Floating bottom navigation" value={floating ? 'Floating' : 'Classic'}
        showChevron={false} isToggle checked={floating} onClick={() => onFloatingChange(!floating)} />
      {floating && <p className="px-4 pb-2 text-xs text-gray-400">Swipe the dock down to hide it. Swipe up or tap the bottom handle to restore it.</p>}
      <SettingsRow icon={icon} label="Edge-to-edge display" value="Experimental"
        showChevron={false} isToggle checked={edgeToEdge} disabled={!ownerId}
        onClick={() => setDeviceEdgeToEdge(ownerId, !edgeToEdge)} />
      <p className="px-4 pb-2 text-xs text-gray-400">Use the available dynamic viewport and request theme-matched browser chrome on this device. Android and the browser control the actual system bars.</p>
      <SettingsRow icon={icon} label="Immersive fullscreen"
        value={fullscreen === 'active' ? 'Exit' : fullscreen === 'available' ? 'Enter' : 'Unavailable'}
        showChevron={false} disabled={fullscreen === 'unsupported'} onClick={() => {
          setError('');
          void toggleImmersiveFullscreen().catch(() => setError('Fullscreen could not be changed in this browser.'));
        }} />
      <p className="px-4 pb-2 text-xs text-gray-400">Fullscreen may hide system controls. Exit using this setting or your browser’s fullscreen exit control. Support varies by device.</p>
      {error && <p role="status" className="px-4 pb-2 text-sm text-gray-400">{error}</p>}
    </>
  );
}
