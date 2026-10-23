import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(new URL('../../supabase-poc/restore_private_core_to_disposable.py', import.meta.url)));
const program = [
  'import json, sys',
  'sys.path.insert(0, sys.argv[1])',
  'from restore_private_core_to_disposable import CORE, EXPECTED_SOURCE, selected_data_tables, validate_source_counts',
  'mode = sys.argv[2]',
  'counts = dict(EXPECTED_SOURCE)',
  'if mode == "changed": counts["public.mosaic_candidate_tasks"] += 5; counts["public.mosaic_candidate_categories"] += 1',
  'if mode == "disagree": counts["auth.identities"] += 1',
  'if mode == "empty": counts["auth.users"] = 0; counts["auth.identities"] = 0; counts["mosaic_candidate_private.core_authorities"] = 0',
  'if mode == "excess": counts["public.mosaic_candidate_tasks"] = 250001',
  'if len(selected_data_tables()) > len(CORE): counts["public.mosaic_candidate_diary"] = 1',
  'try:',
  '    validated = validate_source_counts(counts)',
  '    print(json.dumps({"tables": len(validated), "tasks": validated["public.mosaic_candidate_tasks"]}))',
  'except ValueError:',
  '    print("REFUSED")',
].join('\n');

function verify(fresh: boolean, mode: string) {
  const env = { ...process.env };
  delete env.MOSAIC_FRESH_SNAPSHOT_SHA256;
  if (fresh) env.MOSAIC_FRESH_SNAPSHOT_SHA256 = 'a'.repeat(64);
  const result = spawnSync('python3', ['-c', program, folder, mode], {
    env, encoding: 'utf8', timeout: 10000,
  });
  expect(result.status).toBe(0);
  return result.stdout.trim();
}

describe('age-pinned new mosaic-dev snapshot core+Diary isolated restore', () => {
  it('keeps original six-table snapshot and exact original count pin unchanged', () => {
    expect(verify(false, 'original')).toContain('"tables": 6');
    expect(verify(false, 'changed')).toBe('REFUSED');
  });

  it('accepts changing row counts only for an explicitly new digest-pinned source', () => {
    expect(verify(true, 'changed')).toContain('"tables": 7');
    expect(verify(true, 'changed')).toContain('"tasks": 63');
  });

  it.each(['disagree', 'empty', 'excess'])(
    'refuses malformed or suspicious Auth or data cardinalities in fresh mode: %s',
    mode => expect(verify(true, mode)).toBe('REFUSED'),
  );
});
