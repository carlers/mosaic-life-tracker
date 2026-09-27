const OFFICIAL_BUILD =
  import.meta.env.VITE_MOSAIC_OFFICIAL_BUILD === 'true';

export function resolveAppwriteEnvValue(
  value: unknown,
  officialFallback: string,
  forkFallback = officialFallback,
  officialBuild = OFFICIAL_BUILD
): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return officialBuild ? officialFallback : forkFallback;
}

function envValue(
  name: string,
  officialFallback: string,
  forkFallback = officialFallback
): string {
  return resolveAppwriteEnvValue(
    import.meta.env[name],
    officialFallback,
    forkFallback
  );
}

export const APPWRITE_ENDPOINT = envValue(
  'VITE_APPWRITE_ENDPOINT',
  'https://sgp.cloud.appwrite.io/v1',
  'https://appwrite.invalid/v1'
);
export const APPWRITE_PROJECT_ID = envValue(
  'VITE_APPWRITE_PROJECT_ID',
  '6a9703c50016b37110ff',
  'REPLACE_WITH_APPWRITE_PROJECT_ID'
);
export const APPWRITE_DATABASE_ID = envValue(
  'VITE_APPWRITE_DATABASE_ID',
  'life_tracker'
);
export const APPWRITE_STORAGE_BUCKET_ID = envValue(
  'VITE_APPWRITE_STORAGE_BUCKET_ID',
  'task_images'
);
export const APPWRITE_MESSAGE_ACTION_FUNCTION_ID = envValue(
  'VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID',
  '6aa8057f002a4c306fdd',
  'REPLACE_WITH_MESSAGE_ACTION_FUNCTION_ID'
);

export const APPWRITE_TABLES = {
  tasks: envValue('VITE_APPWRITE_TABLE_TASKS', 'tasks'),
  categories: envValue('VITE_APPWRITE_TABLE_CATEGORIES', 'categories'),
  diary: envValue('VITE_APPWRITE_TABLE_DIARY', 'diary'),
  settings: envValue('VITE_APPWRITE_TABLE_SETTINGS', 'settings'),
  friendships: envValue('VITE_APPWRITE_TABLE_FRIENDSHIPS', 'friendships'),
  profiles: envValue('VITE_APPWRITE_TABLE_PROFILES', 'profiles'),
  messages: envValue('VITE_APPWRITE_TABLE_MESSAGES', 'messages'),
} as const;
