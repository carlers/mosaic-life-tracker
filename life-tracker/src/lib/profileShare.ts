export type ProfileShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';

export function buildProfileShareData(
  origin: string,
  username?: string,
  displayName?: string
): ShareData {
  const identity = username
    ? `@${username}`
    : displayName?.trim() || 'me';
  return {
    title: 'Mosaic',
    text: `Connect with ${identity} on Mosaic.`,
    url: new URL('/', origin).toString(),
  };
}

export async function shareProfile(
  data: ShareData,
  browserNavigator: Navigator = navigator
): Promise<ProfileShareResult> {
  if (browserNavigator.share) {
    try {
      await browserNavigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }

  if (browserNavigator.clipboard?.writeText) {
    const content = [data.text, data.url].filter(Boolean).join('\n');
    try {
      await browserNavigator.clipboard.writeText(content);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }
  return 'unavailable';
}
