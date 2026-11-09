import { describe, expect, it } from 'vitest';
import { normalizeSdkQuery, sdkQuery } from '../helpers/invoke-handler';

describe('Appwrite Function handler query contract', () => {
  it('uses the installed node-appwrite JSON-string serializer', () => {
    const serialized = sdkQuery.equal('user_id', 'owner_a');

    expect(serialized).toBe(
      '{"method":"equal","attribute":"user_id","values":["owner_a"]}'
    );
    expect(normalizeSdkQuery(serialized)).toEqual({
      op: 'equal',
      key: 'user_id',
      value: 'owner_a',
    });
  });

  it('preserves array filters and pagination/order arguments', () => {
    expect(normalizeSdkQuery(
      sdkQuery.equal('status', ['verified', 'pending_delete'])
    )).toEqual({
      op: 'equal',
      key: 'status',
      value: ['verified', 'pending_delete'],
    });
    expect(normalizeSdkQuery(sdkQuery.limit(40))).toEqual({
      op: 'limit',
      n: 40,
    });
    expect(normalizeSdkQuery(sdkQuery.orderDesc('$createdAt'))).toEqual({
      op: 'orderDesc',
      field: '$createdAt',
    });
    expect(normalizeSdkQuery(sdkQuery.cursorAfter('row_1'))).toEqual({
      op: 'cursorAfter',
      id: 'row_1',
    });
  });

  it('rejects object-shaped mock queries and malformed serialized queries', () => {
    expect(() => normalizeSdkQuery({
      op: 'equal',
      key: 'user_id',
      value: 'owner_a',
    })).toThrow('serialized node-appwrite query string');
    expect(() => normalizeSdkQuery('not-json')).toThrow(
      'valid serialized node-appwrite query string'
    );
  });
});
