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

  it('has no client execution roles or production schedule before the drill', () => {
    expect(config.execute).toEqual([]);
    expect(config.schedule).toBe('');
  });

  it('contains read-only Appwrite scopes', () => {
    expect(config.scopes.length).toBeGreaterThan(0);
    expect(config.scopes.every((scope: string) => scope.endsWith('.read'))).toBe(
      true
    );
  });

  it('records secret names without secret values', () => {
    expect(config.requiredSecretVariables).toContain('DR_ENCRYPTION_KEY_B64');
    expect(config).not.toHaveProperty('secrets');
  });
});
