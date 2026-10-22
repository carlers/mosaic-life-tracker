#!/usr/bin/env node
// Metadata-only allowlist. No SQL execution or user-row inspection.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {summarizeToc} from './inspect-archive-toc.mjs';
const required=[
 ['auth','users'],['auth','identities'],
 ['mosaic_candidate_private','core_authorities'],
 ['mosaic_candidate_private','owner_revisions'],
 ['public','mosaic_candidate_categories'],['public','mosaic_candidate_tasks'],
];
export function makeDataPlan(toc){
 const inventory=summarizeToc(toc);
 if(inventory.missingRequiredEntries.length) throw Error('Missing archive data');
 const entries=toc.split(/\r?\n/).filter(x=>/^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+/.test(x)).map(line=>{
   const m=/^\s*\d+;\s+\d+\s+\d+\s+TABLE DATA\s+(\S+)\s+(\S+)\s+/.exec(line);
   if(!m)throw Error('Unrecognized table data');
   return {schema:m[1],name:m[2],line};
 });
 const selected=required.map(([schema,name])=>{
   const matches=entries.filter(e=>e.schema===schema&&e.name===name);
   if(matches.length!==1)throw Error('Missing or duplicate required entry');
   return matches[0];
 });
 const selectedSet=new Set(selected);
 const other=entries.filter(e=>!selectedSet.has(e)&&(
   e.schema==='mosaic_candidate_private'||e.schema==='mosaic_poc_internal'||
   (e.schema==='public'&&e.name.startsWith('mosaic_'))));
 const identifiersSafe=other.every(e=>/^[a-z][a-z0-9_]*$/.test(e.schema)&&
   /^[a-z][a-z0-9_]*$/.test(e.name));
 const auth=entries.filter(e=>e.schema==='auth');
 return {
   selection:'; Data-only offline decode, not a restore\n'+selected.map(e=>e.line).join('\n')+'\n',
   report:{
     status:'DATA_SELECTION_ONLY_NOT_RESTORED',
     selectedDataObjects:required.map(([s,n])=>s+'.'+n),
     selectedDataEntries:6,
     otherMosaicDataEntries:other.length,
     otherMosaicDataObjects:identifiersSafe?
       [...new Set(other.map(e=>e.schema+'.'+e.name))].sort():[],
     otherMosaicNamesRedacted:!identifiersSafe,
     authDataEntries:auth.length,
     authSessionsDataPresent:auth.some(e=>e.name==='sessions'),
     authRefreshTokensDataPresent:auth.some(e=>e.name==='refresh_tokens'),
     archiveTocEntries:inventory.archiveTocEntries,
     managedPlatformDefinitionEntries:inventory.managedPlatformDefinitionEntries,
     dataRowsRead:0,restoresPerformed:0,independentRecoveryVerified:false,
   },
 };
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--plan-file'||!args[1].startsWith('/'))throw Error('Invalid output path');
 let text='';
 for await(const piece of process.stdin) text+=piece;
 const {selection,report}=makeDataPlan(text);
 await writeFile(args[1],selection,{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(()=>{process.stderr.write('Incomplete or ambiguous archive data metadata\n');process.exitCode=1;});
}
