export const MAX_ROW_ID_LENGTH = 36;

export function hashString(str: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = ((h2 << 5) + h2 + c * 31) | 0;
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

export function makeSettingsRowId(userId: string, key: string): string {
  const raw = `${userId}_${key}`;
  if (raw.length <= MAX_ROW_ID_LENGTH) return raw;
  return `s_${hashString(raw)}`;
}

/**
 * Diary row id. Appwrite rowIds are constrained to `[a-zA-Z0-9_]+`
 * (AGENTS §0 item 3) — the `yyyy-MM-dd` date contains hyphens, which
 * cannot appear in a rowId. The date is stripped of non-alphanumeric
 * characters (yielding `yyyyMMdd`) before the length check, so a short
 * uid keeps a human-readable id and a long uid falls back to the
 * deterministic hash.
 */
export function makeDiaryRowId(userId: string, date: string): string {
  const safeDate = date.replace(/[^a-zA-Z0-9]/g, '');
  const raw = `${userId}_${safeDate}`;
  if (raw.length <= MAX_ROW_ID_LENGTH) return raw;
  return `d_${hashString(raw)}`;
}
