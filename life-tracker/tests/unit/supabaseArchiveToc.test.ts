import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const command = fileURLToPath(new URL('../../supabase-poc/inspect-archive-toc.mjs', import.meta.url))
const base = [
  '; Archive created at 2026-10-22',
  '1; 1259 220 TABLE public mosaic_candidate_tasks postgres',
  '2; 0 220 TABLE DATA public mosaic_candidate_tasks postgres',
  '3; 1259 221 TABLE public mosaic_candidate_categories postgres',
  '4; 0 221 TABLE DATA public mosaic_candidate_categories postgres',
  '5; 0 000 TABLE DATA auth users supabase_auth_admin',
  '6; 1255 133 FUNCTION realtime list_changes(text) supabase_admin',
  '7; 2615 133 SCHEMA - mosaic_candidate_private postgres',
  '8; 1259 300 TABLE mosaic_candidate_private core_authorities postgres',
  '9; 0 300 TABLE DATA mosaic_candidate_private core_authorities postgres',
  '10; 1255 303 FUNCTION public mosaic_core_session(text) postgres',
  '11; 1259 304 TABLE storage objects supabase_storage_admin',
].join('\n')
function run(input: string) {
  return spawnSync(process.execPath, [command], { input, encoding: 'utf8' })
}

describe('isolated Supabase encrypted archive TOC inspection', () => {
  it('summarizes only metadata and detects platform-managed definitions', () => {
    const result = run(base)
    expect(result.status).toBe(0)
    const report = JSON.parse(result.stdout)
    expect(report.status).toBe('METADATA_ONLY_NOT_RESTORED')
    expect(report.authUsersDataEntryPresent).toBe(true)
    expect(report.managedPlatformDefinitionEntries).toBe(2)
    expect(report.mosaicOwnedDataEntries).toBe(3)
    expect(report.restoresPerformed).toBe(0)
    expect(result.stdout).not.toContain('list_changes')
    expect(result.stdout).not.toContain('core_authorities')
  })
  it('fails closed when a core table or Auth data entry is absent', () => {
    const result = run(base.split('\n').filter((line) =>
      !line.includes('TABLE DATA auth users') &&
      !line.includes('TABLE DATA public mosaic_candidate_tasks')).join('\n'))
    expect(result.status).toBe(1)
    const report = JSON.parse(result.stdout)
    expect(report.missingRequiredEntries).toContain('auth.users:TABLE DATA')
    expect(report.missingRequiredEntries).toContain('public.mosaic_candidate_tasks:TABLE DATA')
  })
  it('rejects invalid or empty archive TOC', () => {
    const result = run('untrusted arbitrary text without pg_restore objects\n')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No PostgreSQL archive TOC entries')
  })
})
