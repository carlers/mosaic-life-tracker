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

/**
 * Computes the row id that the recipient's copy of a message will have.
 * Mirrors the `rmsg_${sha256(messageId).slice(0,30)}` logic inside the
 * `message-action` Appwrite Function so that reply cascades can locate
 * replies that were sent from the recipient's side.
 */
export async function makeRecipientRowId(
  senderMessageId: string
): Promise<string> {
  const hex = await sha256Hex(senderMessageId);
  return `rmsg_${hex.slice(0, 30)}`;
}