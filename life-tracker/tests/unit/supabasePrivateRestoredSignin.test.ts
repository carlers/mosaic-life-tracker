import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
const dir = dirname(fileURLToPath(new URL('../../supabase-poc/verify-private-core-signin.py', import.meta.url)))
const run = (source: string) => spawnSync('python3', ['-c',
  'import sys; sys.path.insert(0,sys.argv[1]); ' + source, dir], { encoding: 'utf8' })
describe('private restored signed owner read preflight (#1027)', () => {
  it('selects only a browser-scoped local key, never a service secret', () => {
    const code = `from verify_private_core_signin import parse_status; assert parse_status('SECRET_KEY=super-secret-long-test-string\\n') is None; assert parse_status('PUBLISHABLE_KEY=sb_publishable_abcdefghijklmnop\\nSECRET_KEY=super-secret-long-test-string\\n') == 'sb_publishable_abcdefghijklmnop'; assert parse_status('ANON_KEY=mock-anon-key-abcdefghijklmnop') == 'mock-anon-key-abcdefghijklmnop'`
    const result = run(code)
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
  })
  it('refuses arbitrary remote directories and invalid project identities', () => {
    const code = `from verify_private_core_signin import resolve_project; from unittest import TestCase; tc=TestCase(); [tc.assertRaises(ValueError,resolve_project,x) for x in ['/tmp','/var','.','/home/other/mosaic-project']]`
    const result = run(code)
    expect(result.status).toBe(0)
  })
  it('forbids non-local redirect destinations', () => {
    const code = `from verify_private_core_signin import NoRedirect; from unittest import TestCase; TestCase().assertRaises(ValueError,NoRedirect().redirect_request,None,None,302,'redirect',{},'https://somewhere.example')`
    expect(run(code).status).toBe(0)
  })
})
