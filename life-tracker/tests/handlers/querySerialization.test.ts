import { describe, expect, it } from 'vitest';
import { Permission as browserPermission, Query as browserQuery, Role as browserRole } from 'appwrite';
import { normalizeSdkQuery, sdkPermission, sdkQuery, sdkRole } from '../helpers/invoke-handler';

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

  it('uses the installed node-appwrite permission and role serializers', () => {
    const role = sdkRole.user('owner_a');
    const browserRoleValue = browserRole.user('owner_a');
    expect(role).toBe(browserRoleValue);

    const serverPermissions = [
      sdkPermission.read(role),
      sdkPermission.update(role),
      sdkPermission.delete(role),
    ];
    expect(serverPermissions).toEqual([
      'read("user:owner_a")',
      'update("user:owner_a")',
      'delete("user:owner_a")',
    ]);
    expect(serverPermissions).toEqual([
      browserPermission.read(browserRoleValue),
      browserPermission.update(browserRoleValue),
      browserPermission.delete(browserRoleValue),
    ]);
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

  it('uses the browser Appwrite SDK query and permission serializers', () => {
    const serialized = browserQuery.equal('user_id', 'owner_a');
    expect(serialized).toBe(
      '{"method":"equal","attribute":"user_id","values":["owner_a"]}'
    );
    expect(JSON.parse(serialized)).toEqual({
      method: 'equal',
      attribute: 'user_id',
      values: ['owner_a'],
    });

    const nested = browserQuery.or([
      browserQuery.greaterThan('$updatedAt', '2026-10-05T00:00:02.000Z'),
      browserQuery.and([
        browserQuery.equal('$updatedAt', '2026-10-05T00:00:02.000Z'),
        browserQuery.greaterThan('$id', 'row_a'),
      ]),
    ]);
    expect(JSON.parse(nested)).toEqual({
      method: 'or',
      values: [
        {
          method: 'greaterThan',
          attribute: '$updatedAt',
          values: ['2026-10-05T00:00:02.000Z'],
        },
        {
          method: 'and',
          values: [
            {
              method: 'equal',
              attribute: '$updatedAt',
              values: ['2026-10-05T00:00:02.000Z'],
            },
            {
              method: 'greaterThan',
              attribute: '$id',
              values: ['row_a'],
            },
          ],
        },
      ],
    });

    const ownerRole = browserRole.user('owner_a');
    expect([
      browserPermission.read(ownerRole),
      browserPermission.update(ownerRole),
      browserPermission.delete(ownerRole),
    ]).toEqual([
      'read("user:owner_a")',
      'update("user:owner_a")',
      'delete("user:owner_a")',
    ]);
  });
});
