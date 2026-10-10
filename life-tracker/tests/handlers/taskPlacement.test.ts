import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isScheduledTask } = require('../../appwrite-functions/message-action/task-placement.js');

describe('server task placement privacy', () => {
  it('accepts valid calendar dates only', () => {
    expect(isScheduledTask({ date: '2026-10-10' })).toBe(true);
    expect(isScheduledTask({ date: '2024-02-29' })).toBe(true);
    for (const date of ['', null, undefined, '2026-02-30', '2026-10-1', 'today', '2026-13-10']) {
      expect(isScheduledTask({ date })).toBe(false);
    }
    expect(isScheduledTask(null)).toBe(false);
  });
});
