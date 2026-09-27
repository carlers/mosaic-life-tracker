function envValue(name: string, fallback: string): string {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export const APPWRITE_ENDPOINT = envValue(
  'VITE_APPWRITE_ENDPOINT',
  'https://sgp.cloud.appwrite.io/v1'
);
export const APPWRITE_PROJECT_ID = envValue(
  'VITE_APPWRITE_PROJECT_ID',
  '6a9703c50016b37110ff'
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
  '6aa8057f002a4c306fdd'
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
