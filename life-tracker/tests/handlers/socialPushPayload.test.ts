import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { pushPayloadForSubscription } =
  require('../../appwrite-functions/message-action/notifications.js');
const generic = { title: 'Mosaic activity', body: 'Open Mosaic to see an update.', url: '/notifications' };

describe('per-subscription social push disclosure', () => {
  it('keeps all social content generic on devices without explicit task-detail consent', () => {
    expect(pushPayloadForSubscription({ include_task_details: false }, generic,
      { socialBody: 'Alice sent “private text”' })).toEqual(generic);
    expect(pushPayloadForSubscription({ }, generic,
      { socialBody: 'Alice sent “private text”' })).toEqual(generic);
    expect(pushPayloadForSubscription({ include_task_details: true }, generic, null))
      .toEqual(generic);
  });
  it('sends bounded opted-in social push details on opted-in devices only', () => {
    const result = pushPayloadForSubscription({ include_task_details: true }, generic,
      { socialBody: 'Alice sent “Hello”' });
    expect(result).toEqual({ ...generic, title: 'Mosaic', body: 'Alice sent “Hello”' });
    const long = pushPayloadForSubscription({ include_task_details: true }, generic,
      { socialBody: 'x'.repeat(400) });
    expect(long.body.length).toBeLessThanOrEqual(180);
  });
  it('preserves existing task-title push opt-in behavior', () => {
    const detail = {actorName:'Alice',taskTitle:'Jogged today'};
    expect(pushPayloadForSubscription({include_task_details:true},generic,detail))
      .toEqual({...generic,title:'Mosaic',body:'Alice completed “Jogged today”'});
  });
});
