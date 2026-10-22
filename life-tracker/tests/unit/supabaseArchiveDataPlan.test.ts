import {describe, expect, it} from 'vitest'
import {spawnSync} from 'node:child_process'
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

const command=fileURLToPath(new URL('../../supabase-poc/plan-private-archive-data.mjs',import.meta.url))
const toc=[
 '1; 1259 220 TABLE public mosaic_candidate_tasks postgres',
 '2; 0 220 TABLE DATA public mosaic_candidate_tasks postgres',
 '3; 1259 221 TABLE public mosaic_candidate_categories postgres',
 '4; 0 221 TABLE DATA public mosaic_candidate_categories postgres',
 '5; 0 1 TABLE DATA auth users supabase_auth_admin',
 '6; 0 2 TABLE DATA auth identities supabase_auth_admin',
 '7; 0 3 TABLE DATA mosaic_candidate_private core_authorities postgres',
 '8; 0 4 TABLE DATA mosaic_candidate_private owner_revisions postgres',
 '9; 0 5 TABLE DATA mosaic_candidate_private core_sessions postgres',
 '10; 0 6 TABLE DATA public mosaic_candidate_diary postgres',
 '11; 0 7 TABLE DATA auth sessions supabase_auth_admin',
 '12; 1255 8 FUNCTION realtime list_changes(text) supabase_admin',
].join('\n')
function check(input:string) {
 const dir=mkdtempSync(join(tmpdir(),'mosaic-toc-'))
 const output=join(dir,'only.toc')
 const result=spawnSync(process.execPath,[command,'--plan-file',output],{input,encoding:'utf8'})
 const body=existsSync(output)?readFileSync(output,'utf8'):null
 rmSync(dir,{recursive:true,force:true})
 return {result,body}
}
describe('private encrypted archive data-only selection plan',()=>{
 it('selects six ordered objects without platform internals or extra Mosaic data',()=>{
  const {result,body}=check(toc)
  expect(result.status).toBe(0)
  const report=JSON.parse(result.stdout)
  expect(report.selectedDataEntries).toBe(6)
  expect(report.selectedDataObjects).toEqual([
   'auth.users','auth.identities','mosaic_candidate_private.core_authorities',
   'mosaic_candidate_private.owner_revisions',
   'public.mosaic_candidate_categories','public.mosaic_candidate_tasks',
  ])
  expect(report.otherMosaicDataObjects).toEqual([
   'mosaic_candidate_private.core_sessions','public.mosaic_candidate_diary',
  ])
  expect(report.authSessionsDataPresent).toBe(true)
  expect(report.independentRecoveryVerified).toBe(false)
  expect(report.restoresPerformed).toBe(0)
  expect(body?.split('\n').filter(s=>s.includes('TABLE DATA'))).toHaveLength(6)
  expect(body).not.toContain('core_sessions')
  expect(body).not.toContain('mosaic_candidate_diary')
  expect(body).not.toContain('list_changes')
  expect(result.stdout).not.toContain('supabase_auth_admin')
 })
 it('does not create a plan when identity or revision rows are absent',()=>{
  const {result,body}=check(toc.split('\n').filter(s=>
    !s.includes('TABLE DATA auth identities') &&
    !s.includes('TABLE DATA mosaic_candidate_private owner_revisions')).join('\n'))
  expect(result.status).toBe(1)
  expect(body).toBeNull()
 })
 it('refuses duplicate required table-data entries',()=>{
  const {result,body}=check(toc+'\n13; 0 14 TABLE DATA auth users supabase_auth_admin\n')
  expect(result.status).toBe(1)
  expect(body).toBeNull()
 })
})
