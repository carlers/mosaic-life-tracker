/**
 * Deterministic thread & message delivery IDs.
 *
 * - Thread IDs are derived from the sorted pair of user IDs so both clients
 *   compute the same value without coordination.
 * - Recipient row IDs are derived from the local message ID so the sender's
 *   outbox can retry delivery idempotently.
 *
 * All IDs are ≤36 chars and match [a-zA-Z0-9_]+ (Appwrite row ID rules).
 */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function makeThreadId(a: string, b: string): Promise<string> {
  const [x, y] = a < b ? [a, b] : [b, a];
  const hex = await sha256Hex(`${x}|${y}`);
  // "th_" + 30 hex chars = 33 chars total
  return `th_${hex.slice(0, 30)}`;
}