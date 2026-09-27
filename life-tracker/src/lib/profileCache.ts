import type { ProfileCard } from './social';

const PROFILE_CACHE_PREFIX = 'mosaic_own_profile:';

function cacheKey(userId: string): string {
  return `${PROFILE_CACHE_PREFIX}${userId}`;
}

function isProfileCard(value: unknown, userId: string): value is ProfileCard {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProfileCard>;
  return (
    candidate.user_id === userId &&
    typeof candidate.username === 'string' &&
    typeof candidate.display_name === 'string' &&
    typeof candidate.avatar_file_id === 'string' &&
    typeof candidate.bio === 'string'
  );
}

export function readCachedOwnProfile(userId: string): ProfileCard | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProfileCard(parsed, userId) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedOwnProfile(
  userId: string,
  profile: ProfileCard
): void {
  if (profile.user_id !== userId) return;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(profile));
  } catch {
    // Profile cache is a convenience layer; remote/local core state wins.
  }
}

export function clearCachedOwnProfile(userId: string): void {
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch {
    // Best effort.
  }
}
