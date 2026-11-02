import {test} from 'node:test';
import assert from 'node:assert/strict';
import {config,SCRATCH,ENDPOINT} from '../server/config.js';
import {isValidDate,callTool,proposal,TOOL_DEFS} from '../server/tools.js';
import {handleRpc} from '../api/mcp.js';
const secureEnv={MOSAIC_MCP_ENABLED:'true',MOSAIC_MCP_PROJECT_ID:SCRATCH,
 MOSAIC_MCP_ENV:'scratch',VERCEL_ENV:'preview',MOSAIC_MCP_KEY:'sandbox-only-test-placeholder-123',
 MOSAIC_MCP_RESOURCE:'https://mosaic-mcp-scratch-preview.vercel.app/api/mcp',MOSAIC_MCP_ALLOW_WRITES:'true'};
const cat={$id:'cat1',name:'School',color:'red',user_id:'owner',deleted:false};
const task={$id:'task1',title:'Physics',date:'2026-11-03',category_id:'cat1',
 is_completed:false,user_id:'owner',deleted:false,memo:'never-expose'};
const repo=()=>({categories:async()=>({rows:[cat],total:1}),
 tasks:async()=>({rows:[task],total:1}),
 createTask:async row=>({id:'task2',created:true,...row})});
test('project, preview, resource and key are all required',()=>{
 assert.equal(config(secureEnv).resource,secureEnv.MOSAIC_MCP_RESOURCE);
 for(const change of [
 {MOSAIC_MCP_PROJECT_ID:'production-id'},{VERCEL_ENV:'production'},
 {MOSAIC_MCP_KEY:''},{MOSAIC_MCP_ENV:'production'},
 {MOSAIC_MCP_RESOURCE:'http://localhost/mcp'},
 {MOSAIC_MCP_ENABLED:'false'},
 ])assert.throws(()=>config({...secureEnv,...change}));
});
test('only known tools and precise scopes are advertised',()=>{
 assert.deepEqual(TOOL_DEFS.map(x=>x.name),
 ['mosaic_list_categories','mosaic_search_tasks','mosaic_create_task','mosaic_propose_bulk_command']);
});
test('task field allowlist removes secret fields and never selects other owner',async()=>{
 const t=await callTool('mosaic_search_tasks',{date:'2026-11-03'},'owner',secureEnv,repo);
 assert.equal(t.tasks[0].title,'Physics');assert.equal('memo' in t.tasks[0],false);
 assert.equal(t.tasks[0].id,'task1');
});
test('read and mutation reject unexpected filters and invalid calendar days',async()=>{
 assert.equal(isValidDate('2026-02-31'),false);
 assert.equal(isValidDate('2026-11-03'),true);
 for(const p of [{ownerId:'victim'}, {completed:'yes'}, {date:'2026-02-31'}])
  await assert.rejects(callTool('mosaic_search_tasks',p,'owner',secureEnv,repo));
});
test('create enforces confirmation and idempotency request key',async()=>{
 const base={title:'Chemistry',categoryId:'cat1',date:'',idempotencyKey:'0123456789abcdef'};
 await assert.rejects(callTool('mosaic_create_task',{...base,confirm:false},'owner',secureEnv,repo));
 await assert.rejects(callTool('mosaic_create_task',{...base,confirm:true,idempotencyKey:'bad'},'owner',secureEnv,repo));
 const created=await callTool('mosaic_create_task',{...base,confirm:true},'owner',secureEnv,repo);
 assert.equal(created.title,'Chemistry');
 await assert.rejects(callTool('mosaic_create_task',{...base,confirm:true},'owner',
   {...secureEnv,MOSAIC_MCP_ALLOW_WRITES:'false'},repo));
});
test('bulk proposal is read-only and requires actual Mosaic confirmation',async()=>{
 const result=await callTool('mosaic_propose_bulk_command',
   {command:'delete all tasks in School'},'owner',secureEnv,repo);
 assert.equal(result.execution,'NOT_EXECUTED');
 assert.equal(result.taskCount,1);
 assert.match(result.next,/confirm explicitly/);
 assert.throws(()=>proposal('delete all tasks in Missing',[cat],[task]));
 assert.throws(()=>proposal('delete my account',[cat],[task]));
});
test('MCP dispatcher rejects ungranted scopes, invented tools and unknown methods',async()=>{
 const auth={owner:'owner',scopes:'tasks.read'};
 const w=await handleRpc({jsonrpc:'2.0',id:1,method:'tools/call',
 params:{name:'mosaic_create_task',arguments:{}}},auth,secureEnv,callTool);
 assert.equal(w.result.isError,true);
 const missing=await handleRpc({jsonrpc:'2.0',id:2,method:'tools/call',
 params:{name:'mosaic_delete_all_tasks',arguments:{}}},auth);
 assert.equal(missing.error.code,-32602);
 const unsupported=await handleRpc({jsonrpc:'2.0',id:3,method:'reset_database'},auth);
 assert.equal(unsupported.error.code,-32601);
 const init=await handleRpc({jsonrpc:'2.0',id:4,method:'initialize'},auth);
 assert.equal(init.result.capabilities.tools.listChanged,false);
 assert.equal(ENDPOINT.includes('fra'),true);
});
