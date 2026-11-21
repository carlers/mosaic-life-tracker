import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_CHANNELS, NOTIFICATION_CHANNELS,
  resolveNotificationChannels,
} from '../../src/lib/notificationChannels';

describe('notification channel preferences', () => {
  it('defaults all new categories and preserves existing completion delivery', () => {
    const policy = resolveNotificationChannels(null);
    expect(policy).toEqual(DEFAULT_NOTIFICATION_CHANNELS);
    expect(policy.task_completed).toEqual({ feed:true,push:true });
    expect(policy.task_request_received).toEqual({ feed:true,push:true });
    expect(policy.task_request_status).toEqual({ feed:true,push:false });
    expect(NOTIFICATION_CHANNELS).toHaveLength(9);
  });
  it('validates partial and malformed synced data, without broadening defaults', () => {
    expect(resolveNotificationChannels({
      direct_message: { feed:false,push:true },
      message_reaction: { push:'yes' },
      unknown: { feed:false,push:false },
    })).toMatchObject({
      direct_message: { feed:false,push:true },
      message_reaction: { feed:true,push:false },
    });
    expect(resolveNotificationChannels(['broken'])).toEqual(DEFAULT_NOTIFICATION_CHANNELS);
  });
});