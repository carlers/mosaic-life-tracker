export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const USERNAME_REQUIREMENTS =
  'Username must be 3–20 characters: a–z, 0–9, underscore.';

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(value.trim().toLowerCase());
}
