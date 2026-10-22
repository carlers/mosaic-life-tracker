import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const dir = dirname(fileURLToPath(new URL('../../supabase-poc/restore_private_core_to_disposable.py', import.meta.url)));
const code = [
  'import sys',
  'sys.path.insert(0, sys.argv[1])',
  'from restore_private_core_to_disposable import approved_source_sha256, EXPECTED_AGE_SHA256',
  'print(approved_source_sha256())',
  'print(EXPECTED_AGE_SHA256)',
].join('\n');
function select(override?: string) {
  const env = { ...process.env };
  delete env.MOSAIC_FRESH_SNAPSHOT_SHA256;
  if (override !== undefined) env.MOSAIC_FRESH_SNAPSHOT_SHA256 = override;
  return spawnSync('python3', ['-c', code, dir], { env, encoding: 'utf8' });
}
describe('new encrypted Supabase backup source selection (#1027)', () => {
  it('keeps the original independently reviewed SHA pin by default', () => {
    const result = select();
    expect(result.status).toBe(0);
    const [selected, original] = result.stdout.trim().split('\n');
    expect(original).toMatch(/^[a-f0-9]{64}$/);
    expect(selected).toBe(original);
  });
  it('accepts a new operator-pinned encrypted archive digest without mutating the original pin', () => {
    const requested = 'a'.repeat(64);
    const result = select(requested);
    expect(result.status).toBe(0);
    const [selected, original] = result.stdout.trim().split('\n');
    expect(selected).toBe(requested);
    expect(original).not.toBe(requested);
  });
  it.each(['', 'f'.repeat(63), 'A'.repeat(64), 'z'.repeat(64), 'b'.repeat(64) + '\n'])(
    'refuses noncanonical or malformed operator overrides', bad => {
      const result = select(bad);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
    },
  );
});
