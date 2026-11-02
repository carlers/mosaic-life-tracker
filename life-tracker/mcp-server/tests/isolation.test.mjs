import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleIsolation} from '../api/isolation.js';
import {SCRATCH} from '../server/config.js';
const env={VERCEL_ENV:'preview',MOSAIC_MCP_ENV:'scratch',
 MOSAIC_MCP_PROJECT_ID:SCRATCH,
 MOSAIC_MCP_RESOURCE:'https://mosaic-mcp-scratch-preview.vercel.app/api/mcp',
 MOSAIC_MCP_KEY:'test-secret-sufficient-length-12345678',
 MOSAIC_MCP_ENABLED:'false',MOSAIC_MCP_ALLOW_WRITES:'false',
 MOSAIC_MCP_PREFLIGHT_ENABLED:'true',
 MOSAIC_MCP_ISOLATION_ENABLED:'true',
 MOSAIC_MCP_ISOLATION_USER_A:'testusera',
 MOSAIC_MCP_ISOLATION_USER_B:'testuserb'};
const fixtures={
 a:{category:'mcp_iso_cat_a_20261102',task:'mcp_iso_task_a_20261102'},
 b:{category:'mcp_iso_cat_b_20261102',task:'mcp_iso_task_b_20261102'}};
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v;},
 status(n){this.statusCode=n;return this;},end(){this.ended=true;return this;}};}
function repo(label,owner,config={}){
 const fixture=fixtures[label];
 return ()=>({
 categories:async()=>({total:1,rows:[{$id:fixture.category,user_id:owner,deleted:false}]}),
 tasks:async q=>{
  assert.equal(q.date,'2026-11-02');
  return {total:1,rows:[{$id:fixture.task,user_id:owner,deleted:false,category_id:fixture.category,...config}]};
 }
 });
}
const auth=(owner)=>async(header,scope,e)=>{
 assert.equal(header,'Bearer approvedtoken');
 assert.equal(scope,'tasks.read');
 assert.equal(e.MOSAIC_MCP_ENABLED,'true');
 assert.equal(e.MOSAIC_MCP_ALLOW_WRITES,'false');
 return {owner,scopes:scope};
};
const request={method:'POST',headers:{authorization:'Bearer approvedtoken'}};
test('both owners see their own category and task and never receive data',async()=>{
 for(const [label,owner] of [['a',env.MOSAIC_MCP_ISOLATION_USER_A],['b',env.MOSAIC_MCP_ISOLATION_USER_B]]){
  const r=res();await handleIsolation(request,r,env,auth(owner),repo(label,owner));
  assert.equal(r.statusCode,204);
  assert.equal(r.ended,true);
  assert.equal(r.body,undefined);
  assert.equal(r.headers['Cache-Control'],'no-store');
 }
});
test('cross-owner rows or fixture mismatches reject instead of leaking content',async()=>{
 const r=res();await handleIsolation(request,r,env,auth(env.MOSAIC_MCP_ISOLATION_USER_A),repo('b',env.MOSAIC_MCP_ISOLATION_USER_B));
 assert.equal(r.statusCode,409);
 const x=res();await handleIsolation(request,x,env,auth('unregistered-user'),repo('a','unregistered-user'));
 assert.equal(x.statusCode,403);
 const y=res();await handleIsolation(request,y,env,auth(env.MOSAIC_MCP_ISOLATION_USER_A),repo('a','other-owner'));
 assert.equal(y.statusCode,409);
});
test('normal gateway or writes enabled, nonpreview, bad Scratch or disabled probe returns 404',async()=>{
 for(const change of [
 {MOSAIC_MCP_ENABLED:'true'},{MOSAIC_MCP_ALLOW_WRITES:'true'},
 {MOSAIC_MCP_PREFLIGHT_ENABLED:'false'}, {MOSAIC_MCP_ISOLATION_ENABLED:'false'},
 {MOSAIC_MCP_ISOLATION_USER_A:'testuserb'}, {MOSAIC_MCP_ISOLATION_USER_B:''},
 {VERCEL_ENV:'production'}, {MOSAIC_MCP_PROJECT_ID:'production'},
 ]){
  const r=res();await handleIsolation(request,r,{...env,...change});
  assert.equal(r.statusCode,404);
 }
});
test('invalid token, cross-origin and malformed requests reject without calling storage',async()=>{
 for(const [req,expected] of [
 [{method:'GET',headers:{}},405],
 [{method:'POST',headers:{}},401],
 [{...request,headers:{...request.headers,origin:'https://evil.example'}},403],
 [{...request,body:{}},400]
 ]){
   const r=res();await handleIsolation(req,r,env,async()=>{throw Error('unexpected auth')});
   assert.equal(r.statusCode,expected);
 }
 const revoked=res();await handleIsolation(request,revoked,env,async()=>{throw Error('revoked')});
 assert.equal(revoked.statusCode,401);
 const missing=res();await handleIsolation(request,missing,env,auth(env.MOSAIC_MCP_ISOLATION_USER_A),
 async()=>{throw Error('backend down')});
 assert.equal(missing.statusCode,503);
});
