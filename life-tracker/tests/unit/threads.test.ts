import { describe, it, expect } from 'vitest';
import { makeThreadId, makeRecipientRowId } from '../../src/lib/threads';

describe('makeThreadId', () => {
  it('matches /^th_[a-f0-9]{30}$/ and is 33 chars total', async () => {
    const id = await makeThreadId('alice', 'bob');
    expect(id).toMatch(/^th_[a-f0-9]{30}$/);
    expect(id).toHaveLength(33);
  });

  it('is deterministic for the same inputs', async () => {
    const a = await makeThreadId('alice', 'bob');
    const b = await makeThreadId('alice', 'bob');
    expect(a).toBe(b);
  });

  it('is order-independent (a|b === b|a)', async () => {
    const ab = await makeThreadId('alice', 'bob');
    const ba = await makeThreadId('bob', 'alice');
    expect(ab).toBe(ba);
  });

  it('produces different ids for different inputs', async () => {
    const a = await makeThreadId('alice', 'bob');
    const b = await makeThreadId('alice', 'carol');
    expect(a).not.toBe(b);
  });
});

describe('makeRecipientRowId', () => {
  it('matches /^rmsg_[a-f0-9]{30}$/', async () => {
    const id = await makeRecipientRowId('msg_abc');
    expect(id).toMatch(/^rmsg_[a-f0-9]{30}$/);
  });

  it('is deterministic for the same inputs', async () => {
    const a = await makeRecipientRowId('msg_x');
    const b = await makeRecipientRowId('msg_x');
    expect(a).toBe(b);
  });

  it('produces different ids for different inputs', async () => {
    const a = await makeRecipientRowId('msg_a');
    const b = await makeRecipientRowId('msg_b');
    expect(a).not.toBe(b);
  });
});
