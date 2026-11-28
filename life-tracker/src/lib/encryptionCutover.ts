/** Only the exact, signed server-side encryption cutover blocks legacy dispatch. */
export function isExactEncryptionCutoverError(error: unknown): boolean {
  const candidate = error as { code?: unknown; result?: { error?: unknown } } | null;
  return candidate?.code === 409 &&
    candidate.result?.error === 'Legacy action unavailable during encryption';
}
