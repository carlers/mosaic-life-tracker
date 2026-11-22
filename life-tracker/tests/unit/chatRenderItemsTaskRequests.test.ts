import { describe, expect, it } from 'vitest';
import type { MessageDocument } from '../../src/db/schema';
import { buildRenderItems, messageMatchesQuery } from '../../src/components/messages/chatRenderItems';

describe('chat Task Request rendering', () => {
  it('keeps RxDB-style getter-backed messages intact when request titles become searchable', () => {
    // RxDB document fields can be inherited/non-enumerable; object spreading
    // loses them and produces an invalid createdAt for date divider rendering.
    const message = Object.create(null) as MessageDocument;
    Object.defineProperties(message, {
      id: { get: () => 'msg_req_1' },
      content: { get: () => 'Task request sent' },
      createdAt: { get: () => '2026-11-22T12:00:00.000Z' },
      taskRequestId: { get: () => 'treq_1' },
      taskRefTitle: { get: () => '' },
      replyToContent: { get: () => '' },
    });
    expect(Object.keys(message)).toEqual([]);

    const titleFor = (item: MessageDocument) =>
      item.taskRequestId === 'treq_1' ? 'Pick up groceries' : '';

    const all = buildRenderItems([message], false, '', titleFor);
    expect(all.map(item => item.kind)).toEqual(['divider', 'message']);
    expect(all[1].kind === 'message' && all[1].message).toBe(message);

    const filtered = buildRenderItems([message], true, 'GROCERIES', titleFor);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].kind === 'message' && filtered[0].message).toBe(message);
    expect(messageMatchesQuery(message, 'groceries', titleFor(message))).toBe(true);
    expect(buildRenderItems([message], true, 'unrelated', titleFor)).toEqual([]);
    expect(message.content).toBe('Task request sent');
    expect(message.createdAt).toBe('2026-11-22T12:00:00.000Z');
  });
});
