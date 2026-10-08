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
  value: unknown,
  officialFallback: string,
  forkFallback = officialFallback
): string {
  return resolveAppwriteEnvValue(
    value,
    officialFallback,
    forkFallback
  );
}

export const APPWRITE_ENDPOINT = envValue(
  import.meta.env.VITE_APPWRITE_ENDPOINT,
  'https://sgp.cloud.appwrite.io/v1',
  'https://appwrite.invalid/v1'
);
export const APPWRITE_PROJECT_ID = envValue(
  import.meta.env.VITE_APPWRITE_PROJECT_ID,
  '6a9703c50016b37110ff',
  'REPLACE_WITH_APPWRITE_PROJECT_ID'
);
export const APPWRITE_DATABASE_ID = envValue(
  import.meta.env.VITE_APPWRITE_DATABASE_ID,
  'life_tracker'
);
export const APPWRITE_STORAGE_BUCKET_ID = envValue(
  import.meta.env.VITE_APPWRITE_STORAGE_BUCKET_ID,
  'task_images'
);
export const APPWRITE_MESSAGE_ACTION_FUNCTION_ID = envValue(
  import.meta.env.VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID,
  '6aa8057f002a4c306fdd',
  'REPLACE_WITH_MESSAGE_ACTION_FUNCTION_ID'
);

export const APPWRITE_TABLES = {
  tasks: envValue(
  import.meta.env.VITE_APPWRITE_TABLE_TASKS, 'tasks'),
  categories: envValue(
  import.meta.env.VITE_APPWRITE_TABLE_CATEGORIES, 'categories'),
  diary: envValue(
  import.meta.env.VITE_APPWRITE_TABLE_DIARY, 'diary'),
  settings: envValue(
  import.meta.env.VITE_APPWRITE_TABLE_SETTINGS, 'settings'),
  friendships: envValue(
  import.meta.env.VITE_APPWRITE_TABLE_FRIENDSHIPS, 'friendships'),
  profiles: envValue(
  import.meta.env.VITE_APPWRITE_TABLE_PROFILES, 'profiles'),
  messages: envValue(
  import.meta.env.VITE_APPWRITE_TABLE_MESSAGES, 'messages'),
} as const;
