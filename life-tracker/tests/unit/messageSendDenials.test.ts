import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const records = new Map<string, string>();
const storage = {
  getItem: (key: string) => records.get(key) ?? null,
  setItem: (key: string, value: string) => { records.set(key, value); },
  removeItem: (key: string) => { records.delete(key); },
};

describe('owner-only permanent message denial metadata', () => {
  beforeEach(() => {
    vi.resetModules();
    records.clear();
    vi.stubGlobal('localStorage', storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('persists only IDs by owner across module reload without storing message content', async () => {
    const denials = await import('../../src/lib/messageSendDenials');
    denials.markDeniedOutgoing('user_A', 'msg_123');
    expect(denials.isDeniedOutgoing('user_A', 'msg_123')).toBe(true);
    expect(denials.isDeniedOutgoing('user_B', 'msg_123')).toBe(false);
    expect(JSON.stringify([...records.values()])).not.toContain('secret body');
    vi.resetModules();
    const reloaded = await import('../../src/lib/messageSendDenials');
    expect(reloaded.isDeniedOutgoing('user_A', 'msg_123')).toBe(true);
    expect(reloaded.isDeniedOutgoing('user_B', 'msg_123')).toBe(false);
    reloaded.clearDeniedOutgoing('user_A', 'msg_123');
    expect(reloaded.isDeniedOutgoing('user_A', 'msg_123')).toBe(false);
  });

  it('bounds local metadata per owner and does not evict a different owner', async () => {
    const denials = await import('../../src/lib/messageSendDenials');
    denials.markDeniedOutgoing('user_B', 'msg_keep');
    for (let index = 0; index < 505; index++) {
      denials.markDeniedOutgoing('user_A', 'msg_' + index);
    }
    expect(denials.isDeniedOutgoing('user_A', 'msg_0')).toBe(false);
    expect(denials.isDeniedOutgoing('user_A', 'msg_504')).toBe(true);
    expect(denials.isDeniedOutgoing('user_B', 'msg_keep')).toBe(true);
  });
});
