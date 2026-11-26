/**
 * Stage-1 payload domain allowlist. Adding a domain here never automatically
 * enables it: the server ciphertext floor and domain migration must pass first.
 */
export const PRIVATE_PAYLOAD_DOMAINS = [
  'task', 'category', 'diary', 'bucket-list', 'bucket-task-link',
  'settings-private', 'routine', 'activity', 'activity-task-link', 'chat-message', 'shared-task',
  'friend-calendar', 'social-private', 'attachment-manifest', 'offline-snapshot',
  'notification-private',
] as const;

export type PrivatePayloadDomain = (typeof PRIVATE_PAYLOAD_DOMAINS)[number];
export function isPrivatePayloadDomain(value: unknown): value is PrivatePayloadDomain {
  return typeof value === 'string' &&
    (PRIVATE_PAYLOAD_DOMAINS as readonly string[]).includes(value);
}
