import { useSettings } from './useSettings';

/**
 * HB-10: thin wrapper over `useSettings`. Kept as a named hook (rather
 * than inlined into ProfilePage) because the three profile keys
 * (`displayName`, `description`, `profileImageId`) are a coherent
 * domain concept and giving them a typed surface keeps ProfilePage's
 * call site readable. Every method is a one-line `setSetting`
 * delegation; the wrapper adds no logic.
 */
export function useProfile() {
  const { settings, setSetting, isLoading } = useSettings();

  const displayName = (settings['displayName'] as string) || '';
  const description = (settings['description'] as string) || '';
  const profileImageId = (settings['profileImageId'] as string) || '';

  const updateDisplayName = async (name: string) =>
    setSetting('displayName', name);
  const updateDescription = async (desc: string) =>
    setSetting('description', desc);
  const updateProfileImage = async (fileId: string) =>
    setSetting('profileImageId', fileId);
  const removeProfileImage = async () => setSetting('profileImageId', '');

  return {
    displayName,
    description,
    profileImageId,
    isLoading,
    updateDisplayName,
    updateDescription,
    updateProfileImage,
    removeProfileImage,
  };
}
