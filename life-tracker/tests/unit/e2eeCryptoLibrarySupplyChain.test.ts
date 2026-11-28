import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

// Source-only policy: no third-party HPKE/MLS/Signal crypto package has
// completed Mosaic version-specific security review. Never silently adopt one.
const CANDIDATES=['@hpke/core','hpke-js','@hpke/hpke-js',
  'openmls','ts-mls','@signalapp/libsignal-client'] as const;
const APPROVED_EXACT_VERSIONS:Readonly<Record<string,string>>=Object.freeze({});

function affectedHpkeCore(version:string):boolean{
  const m=/^(\d+)\.(\d+)\.(\d+)(?:\+[A-Za-z0-9.-]+)?$/.exec(version);
  if(!m)return true; // Unknown and pre-release versions fail closed.
  const major=Number(m[1]),minor=Number(m[2]),patch=Number(m[3]);
  return major<1||(major===1&&(minor<7||(minor===7&&patch<=4)));
}
function approvedClientCrypto(lock:unknown):Readonly<Record<string,string>>{
  if(!lock||typeof lock!=='object'||Array.isArray(lock))throw Error('Malformed lock');
  const rows=(lock as {packages?:unknown}).packages;
  if(!rows||typeof rows!=='object'||Array.isArray(rows))throw Error('Missing packages');
  const found:Record<string,string>={};
  for(const [path,entry] of Object.entries(rows)){
    const name=CANDIDATES.find(candidate=>path==='node_modules/'+candidate||
      path.endsWith('/node_modules/'+candidate));
    if(!name)continue;
    const version=(entry as {version?:unknown})?.version;
    if(typeof version!=='string'||!version)throw Error('Unpinned E2EE crypto');
    if(name==='@hpke/core'&&affectedHpkeCore(version))
      throw Error('GHSA-73g8-5h73-26h4 affected @hpke/core');
    if(APPROVED_EXACT_VERSIONS[name]!==version)
      throw Error('Unreviewed E2EE crypto requires exact approved version');
    found[path]=version;
  }
  return found;
}
describe('M3/M4 source-only crypto supply chain gate',()=>{
  it('refuses vulnerable HPKE releases and ambiguous prereleases',()=>{
    for(const v of ['0.9.0','1.7.4','1.7.5-rc.1','unknown'])
      expect(affectedHpkeCore(v)).toBe(true);
    for(const v of ['1.7.5','1.9.0'])
      expect(affectedHpkeCore(v)).toBe(false);
  });
  it('rejects any new unreviewed candidate package in actual client lockfile',()=>{
    const lock=JSON.parse(readFileSync(
      new URL('../../package-lock.json',import.meta.url),'utf8')) as unknown;
    expect(approvedClientCrypto(lock)).toEqual({});
    expect(()=>approvedClientCrypto({packages:{
      'node_modules/@hpke/core':{version:'1.7.4'},
    }})).toThrow('GHSA-73g8');
    expect(()=>approvedClientCrypto({packages:{
      'node_modules/@hpke/core':{version:'1.9.0'},
    }})).toThrow('Unreviewed');
    expect(()=>approvedClientCrypto({packages:{
      'node_modules/openmls':{version:'0.9.2'},
    }})).toThrow('Unreviewed');
  });
});
