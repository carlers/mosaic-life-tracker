import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

async function restrictedErrors(source: string, filePath = 'src/hooks/__appwrite_boundary_fixture__.ts') {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.filter((message) => [
    'no-restricted-imports', 'no-restricted-syntax',
  ].includes(message.ruleId ?? ''));
}

describe('browser Appwrite import boundary', () => {
  it.each(['TablesDB', 'Databases', 'Client', 'Users', 'Storage', 'Functions', 'Account'])(
    'rejects direct %s service access outside sdk owners', async (service) => {
      const errors = await restrictedErrors(`import { ${service} } from 'appwrite';`);
      expect(errors.length).toBeGreaterThan(0);
    }
  );

  it('rejects namespace imports which bypass the guarded API', async () => {
    const errors = await restrictedErrors("import * as Appwrite from 'appwrite';");
    expect(errors.some((message) => message.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('permits value helpers and the two source-of-truth SDK owner modules', async () => {
    const safe = await restrictedErrors("import { Query, ID, Permission, Role } from 'appwrite';");
    expect(safe).toEqual([]);
    for (const owner of ['src/lib/sdk.ts', 'src/lib/appwrite.ts']) {
      const errors = await restrictedErrors("import { TablesDB, Client } from 'appwrite';", owner);
      expect(errors).toEqual([]);
    }
  });
});
