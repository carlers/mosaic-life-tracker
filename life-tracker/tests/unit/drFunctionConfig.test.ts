import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('DR Function least-privilege configuration', () => {
  const config = JSON.parse(
    readFileSync(
      resolve('appwrite-functions/dr-backup/function.config.json'),
      'utf8'
    )
  );

  it('has no client execution roles and uses the accepted daily production schedule', () => {
    expect(config.execute).toEqual([]);
    expect(config.schedule).toBe('0 11 * * *');
  });

  it('contains read-only Appwrite scopes', () => {
    expect(config.scopes.length).toBeGreaterThan(0);
    expect(config.scopes.every((scope: string) => scope.endsWith('.read'))).toBe(
      true
    );
  });

  it('distinguishes required public R2 routing from secret credentials', () => {
    expect(config.requiredNonSecretVariables).toEqual([
      'R2_ACCOUNT_ID',
      'R2_BUCKET',
    ]);
    expect(config.requiredSecretVariables).toEqual([
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'DR_ENCRYPTION_KEY_B64',
    ]);
    expect(config.optionalNonSecretVariables).toEqual(['R2_ENDPOINT']);
    expect(config.optionalSecretVariables).toEqual([
      'DR_ENCRYPTION_KEYS_JSON',
    ]);
    expect(config).not.toHaveProperty('secrets');
  });
});

describe('recoverable two-Function configuration', () => {
  const dr = JSON.parse(
    readFileSync(resolve('appwrite-functions/dr-backup/function.config.json'), 'utf8')
  );
  const appApi = JSON.parse(
    readFileSync(resolve('appwrite-functions/message-action/function.config.json'), 'utf8')
  );

  it('records exactly two distinct Function responsibilities', () => {
    expect(dr.$id).not.toBe(appApi.$id);
    expect(dr.execute).toEqual([]);
    expect(appApi.execute).toEqual(['users']);
  });

  it('keeps source DR scopes read-only while granting app-api only its account-erasure writes', () => {
    expect(dr.scopes.every((scope: string) => scope.endsWith('.read'))).toBe(true);
    expect(appApi.scopes).toEqual(
      expect.arrayContaining([
        'rows.write',
        'users.write',
        'sessions.write',
        'files.read',
        'files.write',
        'execution.write',
      ])
    );
    expect(appApi.timeout).toBeGreaterThanOrEqual(120);
    expect(appApi.schedule).toBe('0 * * * *');
  });
});
