export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    : null;
}
