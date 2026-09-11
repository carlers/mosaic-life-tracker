import { useSettings } from './useSettings';

export function useProfile() {
  const { settings, setSetting, isLoading } = useSettings();
  
  const displayName = (settings['displayName'] as string) || '';
  const description = (settings['description'] as string) || '';
  const profileImageId = (settings['profileImageId'] as string) || '';

  const updateDisplayName = async (name: string) => setSetting('displayName', name);
  const updateDescription = async (desc: string) => setSetting('description', desc);
  const updateProfileImage = async (fileId: string) => setSetting('profileImageId', fileId);
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