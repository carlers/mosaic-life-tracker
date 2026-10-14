import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  approvedHighLevelConfigHashes, TRUSTED_HIGH_LEVEL_CONFIG_SHA256,
} from '../../scripts/lib/prebuilt-candidate-payload.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

describe('one-branch Git-auto cutover safety (#592)', () => {
  it('allows only exact reviewed source config or fix-category-disabled variant', async () => {
    const raw = await readFile(resolve(process.cwd(),
      'scripts/lib/trusted-prebuilt-vercel.json'));
    expect(digest(raw)).toBe(TRUSTED_HIGH_LEVEL_CONFIG_SHA256);
    const text = raw.toString('utf8');
    expect(text.split('"fix/*": true,')).toHaveLength(2);
    const off = Buffer.from(text.replace('"fix/*": true,', '"fix/*": false,'));
    const allowlist = approvedHighLevelConfigHashes();
    expect(allowlist.size).toBe(2);
    expect(allowlist.has(digest(raw))).toBe(true);
    expect(allowlist.has(digest(off))).toBe(true);
    expect(allowlist.has(digest(Buffer.from(text.replace('"main": true,', '"main": false,')))))
      .toBe(false);
    const initial = JSON.parse(text);
    const disabled = JSON.parse(off.toString('utf8'));
    expect(disabled.git.deploymentEnabled['fix/*']).toBe(false);
    expect(disabled.git.deploymentEnabled.main).toBe(true);
    expect(disabled.git.deploymentEnabled.dev).toBe(true);
    expect(disabled.git.deploymentEnabled['feature/*']).toBe(true);
    expect(disabled.headers).toEqual(initial.headers);
    expect(disabled.rewrites).toEqual(initial.rewrites);
    expect(disabled.framework).toBe(initial.framework);
    expect(disabled.buildCommand).toBe(initial.buildCommand);
    expect(disabled.outputDirectory).toBe(initial.outputDirectory);
  });
});
