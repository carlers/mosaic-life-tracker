import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {config,SCRATCH,ENDPOINT,PRODUCTION,PRODUCTION_ENDPOINT,PRODUCTION_RESOURCE,PRODUCTION_ISSUER,SCRATCH_RESOURCE,tenant} from '../server/config.js';
import {isValidDate,callTool,proposal,TOOL_DEFS} from '../server/tools.js';
import mcpHandler,{handleRpc} from '../api/mcp.js';
import {assertActiveResourceToken,challenge,protectedResourceMetadata} from '../server/auth.js';
import {ISSUER,PROJECT_AUDIENCE} from '../server/config.js';
import {metadataForBuild} from '../scripts/build-resource-metadata.mjs';
import {createRepository} from '../server/repository.js';
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

test('resource-bound tokens require matching JWT and introspection audiences plus jti',()=>{
 const resource=secureEnv.MOSAIC_MCP_RESOURCE;
 const payload={sub:'owner',client_id:'client',jti:'valid-jti',scope:'tasks.read',aud:[resource]};
 const active={active:true,token_use:'access_token',token_type:'Bearer',
   sub:'owner',client_id:'client',jti:'valid-jti',scope:'tasks.read',
   aud:[resource],iss:ISSUER,exp:2000000000};
 assert.doesNotThrow(()=>assertActiveResourceToken(active,payload,'tasks.read',resource,1800000000));
 for(const change of [
   {aud:[PROJECT_AUDIENCE]}, {aud:['https://unrelated.example/api/mcp']},
   {jti:'another-token'}, {active:false}, {sub:'other-owner'},
   {scope:'tasks.create'}, {exp:1799999999}
 ])assert.throws(()=>assertActiveResourceToken({...active,...change},
    payload,'tasks.read',resource,1800000000));
 for(const change of [{aud:[PROJECT_AUDIENCE]},{jti:'other-jti'},{scope:'tasks.create'}])
    assert.throws(()=>assertActiveResourceToken(active,{...payload,...change},'tasks.read',resource,1800000000));
});

test('unauthenticated GET advertises JSON metadata endpoint without enabling writes',async()=>{
 const resource=secureEnv.MOSAIC_MCP_RESOURCE;
 assert.equal(challenge(resource),'Bearer resource_metadata="https://mosaic-mcp-scratch-preview.vercel.app/api/protected-resource", error="invalid_token"');
 const previous=Object.fromEntries(Object.keys(secureEnv).map(key=>[key,process.env[key]]));
 Object.assign(process.env,secureEnv);
 const headers={};
 const res={setHeader(k,v){headers[k.toLowerCase()]=v;},
   status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 try {
   await mcpHandler({method:'GET',headers:{}},res);
   assert.equal(res.statusCode,401);
   assert.equal(headers['www-authenticate'],challenge(resource));
   assert.equal(headers['cache-control'],'no-store');
 } finally {
   for(const [key,value] of Object.entries(previous)){
     if(value===undefined)delete process.env[key];else process.env[key]=value;
   }
 }
});

test('read-only Scratch advertises only tasks.read tools and fails closed on other calls',async()=>{
 const env={...secureEnv,MOSAIC_MCP_ALLOW_WRITES:'false'};
 const identity={owner:'owner',scopes:'tasks.read'};
 const found=await handleRpc({jsonrpc:'2.0',id:61,method:'tools/list'},identity,env);
 assert.deepEqual(found.result.tools.map(x=>x.name),
   ['mosaic_list_categories','mosaic_search_tasks']);
 for(const name of ['mosaic_create_task','mosaic_propose_bulk_command']){
   const result=await handleRpc({jsonrpc:'2.0',id:62,method:'tools/call',
     params:{name,arguments:{}}},identity,env);
   assert.equal(result.error.code,-32602);
 }
 const enabled=await handleRpc({jsonrpc:'2.0',id:63,method:'tools/list'},identity,secureEnv);
 assert.equal(enabled.result.tools.length,4);
});
test('standard OAuth protected-resource metadata has explicit JSON MIME without rewrites',()=>{
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(v.rewrites,undefined);
 const rule=v.headers?.find(x=>x.source==='/.well-known/oauth-protected-resource');
 assert.ok(rule);
 const headers=Object.fromEntries(rule.headers.map(h=>[h.key.toLowerCase(),h.value]));
 assert.match(headers['content-type'],/^application\/json(?:;|$)/);
 assert.equal(headers['cache-control'],'no-store');
 assert.equal(headers['x-content-type-options'],'nosniff');
});

test('OAuth resource discovery advertises only read permission when writes are disabled',()=>{
 const readOnly={...secureEnv,MOSAIC_MCP_ALLOW_WRITES:'false'};
 assert.deepEqual(protectedResourceMetadata(readOnly).scopes_supported,['tasks.read']);
 assert.deepEqual(protectedResourceMetadata(secureEnv).scopes_supported,
   ['tasks.read','tasks.create','tasks.bulk.propose']);
 const staticDiscovery=JSON.parse(readFileSync(new URL('../public/.well-known/oauth-protected-resource',import.meta.url),'utf8'));
 assert.deepEqual(staticDiscovery.scopes_supported,['tasks.read']);
 assert.equal(staticDiscovery.resource,readOnly.MOSAIC_MCP_RESOURCE);
});

const productionEnv={
 MOSAIC_MCP_ENABLED:'true',MOSAIC_MCP_ENV:'production',
 MOSAIC_MCP_PRODUCTION_ENABLED:'true',MOSAIC_MCP_PROJECT_ID:PRODUCTION,
 MOSAIC_MCP_RESOURCE:PRODUCTION_RESOURCE,MOSAIC_MCP_KEY:'test-prod-only-read-scoped-secret-123',
 MOSAIC_MCP_ALLOW_WRITES:'false',VERCEL_ENV:'production'
};
test('Production activation is an independent, read-only, exact-tenant opt-in',()=>{
 const chosen=config(productionEnv);
 assert.equal(chosen.name,'production');
 assert.equal(chosen.projectId,PRODUCTION);
 assert.equal(chosen.endpoint,PRODUCTION_ENDPOINT);
 assert.equal(chosen.issuer,PRODUCTION_ISSUER);
 assert.equal(chosen.resource,PRODUCTION_RESOURCE);
 assert.equal(config({...secureEnv,MOSAIC_MCP_ALLOW_WRITES:'false'}).issuer,ISSUER);
 for(const change of [
   {MOSAIC_MCP_PRODUCTION_ENABLED:'false'},
   {MOSAIC_MCP_ENABLED:'false'}, {MOSAIC_MCP_ALLOW_WRITES:'true'},
   {MOSAIC_MCP_PROJECT_ID:SCRATCH}, {MOSAIC_MCP_RESOURCE:SCRATCH_RESOURCE},
   {MOSAIC_MCP_RESOURCE:'https://attacker.example/api/mcp'},
   {VERCEL_ENV:'preview'}, {MOSAIC_MCP_ENV:'scratch'},
   {MOSAIC_MCP_KEY:''},
 ])assert.throws(()=>config({...productionEnv,...change}));
});
test('Production resource tokens cannot be substituted with Scratch access tokens',()=>{
 const prod={sub:'prod-user',client_id:'prod-client',jti:'prod-token',scope:'tasks.read',aud:[PRODUCTION_RESOURCE]};
 const active={active:true,token_use:'access_token',token_type:'Bearer',
   sub:'prod-user',client_id:'prod-client',jti:'prod-token',scope:'tasks.read',
   aud:[PRODUCTION_RESOURCE],iss:PRODUCTION_ISSUER,exp:2000000000};
 assert.doesNotThrow(()=>assertActiveResourceToken(active,prod,'tasks.read',PRODUCTION_RESOURCE,1800000000,PRODUCTION_ISSUER));
 for(const c of [
  {iss:ISSUER},{aud:[SCRATCH_RESOURCE]},{sub:'scratch-user'},
  {client_id:'scratch-client'},{jti:'scratch-jti'}, {active:false},
 ])assert.throws(()=>assertActiveResourceToken({...active,...c},prod,
   'tasks.read',PRODUCTION_RESOURCE,1800000000,PRODUCTION_ISSUER));
 assert.throws(()=>assertActiveResourceToken(active,{...prod,aud:[SCRATCH_RESOURCE]},
    'tasks.read',PRODUCTION_RESOURCE,1800000000,PRODUCTION_ISSUER));
});
test('Production never exposes or directly dispatches write tools',async()=>{
 const id={owner:'prod-user',scopes:'tasks.read'};
 const tools=await handleRpc({jsonrpc:'2.0',id:71,method:'tools/list'},id,productionEnv);
 assert.deepEqual(tools.result.tools.map(x=>x.name),['mosaic_list_categories','mosaic_search_tasks']);
 for(const name of ['mosaic_create_task','mosaic_propose_bulk_command']){
   const response=await handleRpc({jsonrpc:'2.0',id:72,method:'tools/call',
     params:{name,arguments:{}}},id,productionEnv,async()=>{throw Error('should not invoke');});
   assert.equal(response.error.code,-32602);
 }
 await assert.rejects(createRepository(productionEnv.MOSAIC_MCP_PROJECT_ID,productionEnv)
    .createTask({title:'forbidden',categoryId:'x',date:''}),/disabled/);
});
test('Build metadata fails closed on invalid Production and stays independent of keys',()=>{
 const product=metadataForBuild(productionEnv);
 assert.equal(product.resource,PRODUCTION_RESOURCE);
 assert.deepEqual(product.authorization_servers,[PRODUCTION_ISSUER]);
 assert.deepEqual(product.scopes_supported,['tasks.read']);
 assert.equal(JSON.stringify(product).includes(productionEnv.MOSAIC_MCP_KEY),false);
 assert.equal(metadataForBuild({}).resource,SCRATCH_RESOURCE);
 assert.throws(()=>metadataForBuild({VERCEL_ENV:'production'}));
 for(const bad of [{MOSAIC_MCP_PROJECT_ID:SCRATCH},
  {MOSAIC_MCP_RESOURCE:SCRATCH_RESOURCE},{VERCEL_ENV:'preview'},
  {MOSAIC_MCP_ENV:'scratch'}])
   assert.throws(()=>metadataForBuild({...productionEnv,...bad}));
 const scratch={...secureEnv,MOSAIC_MCP_ALLOW_WRITES:'false'};
 assert.equal(metadataForBuild(scratch).resource,SCRATCH_RESOURCE);
 assert.equal(tenant(productionEnv).name,'production');
});
