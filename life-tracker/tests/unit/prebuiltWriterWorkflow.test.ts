import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertCanaryGitDisabled, CANARY_BRANCH } from '../../scripts/lib/prebuilt-provider-policy.mjs';
const yaml=()=>readFileSync(new URL('../../../.github/workflows/trusted-preview-delivery.yml',import.meta.url),'utf8');
const writer=()=>readFileSync(new URL('../../scripts/run-trusted-prebuilt-writer.mjs',import.meta.url),'utf8');
describe('main-only prebuilt writer stays independently disabled (#592)',()=>{
  it('has separate read-only and privileged jobs; no credential in shadow',()=>{
    const text=yaml(),shadow=text.split('\n  prebuilt_writer:\n')[0],privileged=text.split('\n  prebuilt_writer:\n')[1];
    expect(privileged).toBeTruthy();
    expect(shadow).toContain("MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED: 'false'");
    expect(shadow).not.toContain('VERCEL_TOKEN');
    expect(shadow).not.toContain('environment: mosaic-preview-auto');
    expect(privileged).toContain("vars.MOSAIC_PREBUILT_WRITER_ENABLED == 'true'");
    expect(privileged).toContain("vars.MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED == 'true'");
    expect(privileged).toContain('needs: trusted_preview');
    expect(privileged).toContain('environment: mosaic-preview-auto');
    expect(privileged).toContain('vercel@63.1.2');
    expect(privileged).toContain('--ignore-scripts');
    expect(privileged).toContain('node life-tracker/scripts/run-trusted-prebuilt-writer.mjs');
  });
  it('prevents any CLI POST before exact canary Git auto-disable',()=>{
    const src=writer();
    expect(src).toContain("MOSAIC_PREBUILT_WRITER_ENABLED !== 'true'");
    expect(src).toContain('await canaryGitAutoDeploymentDisabled(acceptedRun.sha)');
    expect(src).toContain('await recheckTrustedAdmission(event, acceptedRun)');
    expect(src).toContain('assertPrebuiltProject(project)');
    expect(src).toContain('findAlreadyDeployed(acceptedRun,');
    expect(src).toContain('assembleVerifiedCandidateStatic(verified, root)');
    expect(src).toContain('assertPrebuiltReady');
    expect(src).not.toContain('npm run build');
    expect(src).not.toContain('--prod');
  });
  it('uses NON-OVERLAPPING Vercel minimatch deployment rules',()=>{
    const config={framework:'vite',outputDirectory:'dist',git:{
      deploymentEnabled:{'*':false,main:true,dev:true,'feature/*':true,
        'fix/!(592-trusted-archive-20261014)':true,'perf/*':true,
        'security/*':true,'refactor/*':true,'chatgpt/*':false,'codex/*':false}}};
    expect(assertCanaryGitDisabled(config)).toBe(true);
    for(const change of [
      {'fix/*':true}, {'fix/592-trusted-archive-20261014':true},
      {'main':false}, {'dev':false}, {'*':true},
    ]){
      const next=structuredClone(config);
      Object.assign(next.git.deploymentEnabled,change);
      expect(()=>assertCanaryGitDisabled(next)).toThrow();
    }
  });
});
