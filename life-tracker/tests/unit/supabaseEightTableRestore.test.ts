import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const test = fileURLToPath(new URL('../../supabase-poc/tests/test_personal_settings_restore_contract.py', import.meta.url));
const shell = fileURLToPath(new URL('../../supabase-poc/run-private-core-recovery.sh', import.meta.url));
describe('strict 6/7/8/10-table Supabase recovery and future personal-domain refusal', () => {
  it('refuses Settings, Bucket/link and unknown personal omissions under obsolete restore modes', () => {
    const p=spawnSync('python3',[test],{
      encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH ?? '',HOME:'/nonexistent'},
    });
    expect(p.status,p.stderr || p.error?.message).toBe(0);
    expect(p.stderr).toContain('Ran 15 tests');
    expect(p.stderr).toContain('OK');
  });
  it('retains valid guarded private restore shell',()=>{
    const p=spawnSync('bash',['-n',shell],{encoding:'utf8',timeout:10000});
    expect(p.status,p.stderr).toBe(0);
  });
});
