import { describe, expect, it } from 'vitest';
import {
  VERCEL_TEAM_ID, VERCEL_PROJECT_ID, CANARY_BRANCH, CANARY_ALIAS,
  assertPrebuiltProject, findPrebuiltCandidate, assertPrebuiltReady,
  prebuiltCliArgs, decideProviderCreate, assertAliasTarget,
} from '../../scripts/lib/prebuilt-provider-policy.mjs';
const sha='a'.repeat(40), runId=123, attempt=1;
const q={sha,runId,attempt,branch:CANARY_BRANCH};
const project={id:VERCEL_PROJECT_ID,name:'mosaic-life-tracker',
  rootDirectory:'life-tracker',link:{type:'github',repoId:1361399135,productionBranch:'main'}};
const deployment={id:'dpl_123456789',projectId:VERCEL_PROJECT_ID,readyState:'READY',
  target:null,source:'cli',url:'example-hello.vercel.app',meta:{
    mosaic_prebuilt_sha:sha,mosaic_prebuilt_run:String(runId),
    mosaic_prebuilt_attempt:String(attempt),githubCommitSha:sha,
    githubCommitRef:'HEAD',githubOrg:'carlers',githubRepo:'mosaic-life-tracker'}};
describe('default-main Vercel prebuilt writer guards (#592)',()=>{
  it('requires fixed project root, linked Git repo and production branch',()=>{
    expect(assertPrebuiltProject(project)).toBe(true);
    for(const variant of [
      {rootDirectory:'/'},{id:'prj_untrusted'},
      {link:{...project.link,repoId:7}},
      {link:{...project.link,productionBranch:'dev'}},
    ]) expect(()=>assertPrebuiltProject({...project,...variant})).toThrow();
  });
  it('uses explicit Preview-only CLI args, immutable provenance and never Production',()=>{
    const args=prebuiltCliArgs(q).join(' ');
    expect(args).toContain('--prebuilt --target=preview');
    expect(args).toContain('mosaic_prebuilt_sha='+sha);
    expect(args).not.toMatch(/--prod\b|--target=production|--force/);
    for(const variant of [{sha:'wrong'},{branch:'main'},{runId:0},{attempt:0}])
      expect(()=>prebuiltCliArgs({...q,...variant})).toThrow();
  });
  it('fails closed on stale or red CI even when enabled',()=>{
    const base={enabled:'true',aliasEnabled:'true',canonicalEligible:true,
      artifactVerified:true,headStillCurrent:true,prior:null};
    expect(decideProviderCreate({...base,enabled:'false'}).action).toBe('shadow');
    expect(decideProviderCreate({...base,aliasEnabled:'false'}).action)
      .toBe('create-without-alias');
    expect(decideProviderCreate(base).action).toBe('create-then-alias');
    for(const key of ['canonicalEligible','artifactVerified','headStillCurrent'])
      expect(decideProviderCreate({...base,[key]:false}).action).toBe('reject');
    expect(decideProviderCreate({...base,prior:deployment})).toMatchObject({
      action:'reuse',id:deployment.id});
  });
  it('deduplicates by verified metadata or conservative CLI commit provenance',()=>{
    expect(findPrebuiltCandidate([deployment],q)?.id).toBe(deployment.id);
    expect(findPrebuiltCandidate([{...deployment,meta:{
      githubCommitSha:sha,githubCommitRef:'HEAD',
      githubOrg:'carlers',githubRepo:'mosaic-life-tracker'}}],q)?.id).toBe(deployment.id);
    expect(findPrebuiltCandidate([{...deployment,target:'production'}],q)).toBeNull();
    expect(()=>findPrebuiltCandidate([deployment,deployment],q)).toThrow(/Ambiguous/);
    expect(()=>findPrebuiltCandidate(null,q)).toThrow();
  });
  it('requires successful explicit CLI Preview GET before alias mutation',()=>{
    expect(assertPrebuiltReady(deployment,q)).toBe(deployment);
    for(const variant of [{target:'production'},{target:undefined},
      {source:'git'},{readyState:'ERROR'},{projectId:'prj_other'},
      {meta:{...deployment.meta,mosaic_prebuilt_sha:'f'.repeat(40)}}])
      expect(()=>assertPrebuiltReady({...deployment,...variant},q)).toThrow();
    expect(assertAliasTarget([{alias:CANARY_ALIAS}],deployment.id)).toBe(true);
    expect(()=>assertAliasTarget([{alias:'wrong.vercel.app'}],deployment.id)).toThrow();
  });
});
