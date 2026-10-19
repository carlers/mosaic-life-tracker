import { describe, expect, it } from 'vitest';
import {
  bucketListSchema, bucketTaskLinksSchema, categoriesSchema, diarySchema,
  friendshipsSchema, messagesSchema, settingsSchema, tasksSchema,
} from '../../src/db/schema';
import { SYNCED_COLLECTION_NAMES } from '../../src/db/replicationIds';
import { fromAppwriteFormat, toAppwriteFormat } from '../../src/lib/syncMapping';
import {
  toCandidateCategoryWrite, toCandidateTaskWrite, type CandidateIdentity,
} from '../../supabase-poc/candidateMapping';
import {
  makeBackendParityFixtures, PARITY_OWNERS,
} from '../fixtures/backendProviderParity';

const schemas = {
  tasks: tasksSchema,
  categories: categoriesSchema,
  diary: diarySchema,
  settings: settingsSchema,
  friendships: friendshipsSchema,
  messages: messagesSchema,
  bucketList: bucketListSchema,
  bucketTaskLinks: bucketTaskLinksSchema,
};
const ids = {
  a: { legacyUserId: PARITY_OWNERS.a, supabaseUserId: '11111111-1111-4111-8111-111111111111' },
  b: { legacyUserId: PARITY_OWNERS.b, supabaseUserId: '22222222-2222-4222-8222-222222222222' },
} satisfies Record<'a' | 'b', CandidateIdentity>;

type FieldSpec = { type?: string; maxLength?: number; enum?: readonly unknown[]; minimum?: number; maximum?: number };

describe('provider-neutral eight-domain synthetic acceptance fixtures (#967/#975)', () => {
  it('tracks the exact current RxDB replication identifiers and valid document schemas', () => {
    const fixtures = makeBackendParityFixtures();
    expect(Object.keys(schemas).sort()).toEqual([...SYNCED_COLLECTION_NAMES].sort());
    for (const owner of ['a', 'b'] as const) {
      expect(Object.keys(fixtures[owner]).sort()).toEqual([...SYNCED_COLLECTION_NAMES].sort());
      for (const collection of SYNCED_COLLECTION_NAMES) {
        const schema = schemas[collection];
        const fields = schema.properties as Record<string, FieldSpec>;
        const rows = fixtures[owner][collection] as Record<string, unknown>[];
        expect(rows.length).toBeGreaterThanOrEqual(2);
        expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
        for (const doc of rows) {
          expect(doc.userId).toBe(PARITY_OWNERS[owner]);
          expect(doc._deleted).toBeUndefined();
          expect(doc.isDeleted).toEqual(expect.any(Boolean));
          for (const required of schema.required ?? []) expect(doc).toHaveProperty(required);
          for (const [key, value] of Object.entries(doc)) {
            const property = fields[key];
            expect(property, collection + '.' + key).toBeDefined();
            if (value === undefined) continue;
            if (property.type === 'string') {
              expect(typeof value).toBe('string');
              if (property.maxLength !== undefined) {
                expect((value as string).length).toBeLessThanOrEqual(property.maxLength);
              }
            } else if (property.type === 'boolean') expect(typeof value).toBe('boolean');
            else if (property.type === 'integer') {
              expect(Number.isInteger(value)).toBe(true);
              if (property.minimum !== undefined) expect(value as number).toBeGreaterThanOrEqual(property.minimum);
              if (property.maximum !== undefined) expect(value as number).toBeLessThanOrEqual(property.maximum);
            }
            if (property.enum) expect(property.enum).toContain(value);
          }
        }
        expect(rows.some((row) => row.isDeleted === false)).toBe(true);
        expect(rows.some((row) => row.isDeleted === true)).toBe(true);
      }
    }
  });

  it('round-trips all eight local document contracts through existing Appwrite field mapping', () => {
    const fixtures = makeBackendParityFixtures();
    for (const owner of ['a', 'b'] as const) {
      for (const collection of SYNCED_COLLECTION_NAMES) {
        for (const document of fixtures[owner][collection]) {
          const doc = document as unknown as Record<string, unknown>;
          const wire = toAppwriteFormat(doc, collection, PARITY_OWNERS[owner]);
          expect(wire.user_id).toBe(PARITY_OWNERS[owner]);
          expect(wire.deleted).toBe(doc.isDeleted);
          const restored = fromAppwriteFormat({ $id: doc.id, ...wire }, collection);
          expect(restored, collection + ' / ' + String(doc.id)).toEqual(doc);
        }
      }
    }
  });

  it('keeps message fanout owner-scoped and does not mistake recipient copies for write authorization', () => {
    const { a, b } = makeBackendParityFixtures();
    const outgoingA = a.messages.find((msg) => msg.direction === 'outgoing' && !msg.isDeleted);
    const incomingB = b.messages.find((msg) => msg.direction === 'incoming' && !msg.isDeleted);
    expect(outgoingA).toBeDefined();
    expect(incomingB).toBeDefined();
    expect(incomingB).toMatchObject({
      userId: PARITY_OWNERS.b,
      senderId: PARITY_OWNERS.a,
      recipientId: PARITY_OWNERS.b,
      originalMessageId: outgoingA?.id,
    });
    expect(outgoingA?.readAt).toBe(''); // Outgoing read receipt is server-owned.
    expect(incomingB?.readAt).not.toBe('');
    expect(a.friendships.some((doc) => doc.status === 'blocked')).toBe(true);
    expect(b.friendships.some((doc) => doc.status === 'blocked')).toBe(true);
  });

  it('preserves goal/task links and proves candidate task/category mapping fails closed for a foreign legacy owner', () => {
    const { a, b } = makeBackendParityFixtures();
    for (const group of [a, b]) {
      for (const link of group.bucketTaskLinks.filter((row) => !row.isDeleted)) {
        expect(group.tasks.some((row) => row.id === link.taskId && !row.isDeleted)).toBe(true);
        expect(group.bucketList.some((row) => row.id === link.bucketListId && !row.isDeleted)).toBe(true);
      }
    }
    for (const document of a.tasks) {
      const write = toCandidateTaskWrite(document, ids.a);
      expect(write.owner_id).toBe(ids.a.supabaseUserId);
      expect(write).not.toHaveProperty('change_seq');
      expect(() => toCandidateTaskWrite(document, ids.b)).toThrow('different legacy account');
    }
    for (const document of a.categories) {
      expect(toCandidateCategoryWrite(document, ids.a).owner_id).toBe(ids.a.supabaseUserId);
      expect(() => toCandidateCategoryWrite(document, ids.b)).toThrow('different legacy account');
    }
  });

  it('returns independent deterministic datasets for replay and preserves deletion markers', () => {
    const first = makeBackendParityFixtures();
    const second = makeBackendParityFixtures();
    expect(first).toEqual(second);
    first.a.tasks[0].title = 'mutated synthetic fixture';
    expect(second.a.tasks[0].title).toBe('synthetic private task');
    for (const collection of SYNCED_COLLECTION_NAMES) {
      expect(second.a[collection].some((doc) => doc.isDeleted)).toBe(true);
      expect(second.b[collection].some((doc) => doc.isDeleted)).toBe(true);
    }
  });
});
