import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handlePreflight,preflightConfig} from '../api/preflight.js';
import {SCRATCH} from '../server/config.js';

const env={VERCEL_ENV:'preview',MOSAIC_MCP_ENV:'scratch',
  MOSAIC_MCP_PROJECT_ID:SCRATCH,
  MOSAIC_MCP_RESOURCE:'https://mosaic-mcp-scratch-preview.vercel.app/api/mcp',
  MOSAIC_MCP_KEY:'sandbox-only-test-secret-of-sufficient-length',
  MOSAIC_MCP_ENABLED:'false',MOSAIC_MCP_ALLOW_WRITES:'false',
  MOSAIC_MCP_PREFLIGHT_ENABLED:'true'};
function response() {
 const headers={};
 return {headers,setHeader(key,value){headers[key.toLowerCase()]=value;},
  status(code){this.statusCode=code;return this;},end(){this.ended=true;return this;}};
}
test('preflight refuses wrong project, nonpreview, enabled gateway or writes',()=>{
 assert.equal(preflightConfig(env).resource,env.MOSAIC_MCP_RESOURCE);
 for(const fail of [{VERCEL_ENV:'production'},{MOSAIC_MCP_PROJECT_ID:'production'},
  {MOSAIC_MCP_ENABLED:'true'},{MOSAIC_MCP_ALLOW_WRITES:'true'},
  {MOSAIC_MCP_PREFLIGHT_ENABLED:'false'},
  {MOSAIC_MCP_RESOURCE:'https://other.example/api/mcp'},
  {MOSAIC_MCP_KEY:''}])assert.throws(()=>preflightConfig({...env,...fail}));
});
test('preflight verifies only read-scope via canonical JWT + live-introspection auth',async()=>{
 const req={method:'POST',headers:{authorization:'Bearer opaque-sample'}};
 const r=response();
 await handlePreflight(req,r,env,async (header,scope,authEnv)=>{
  assert.equal(header,req.headers.authorization);
  assert.equal(scope,'tasks.read');
  assert.equal(authEnv.MOSAIC_MCP_ENABLED,'true');
  assert.equal(authEnv.MOSAIC_MCP_ALLOW_WRITES,'false');
  return {owner:'never-echo-owner',scopes:scope};
 });
 assert.equal(r.statusCode,204);
 assert.equal(r.ended,true);
 assert.equal(r.headers['cache-control'],'no-store');
 assert.equal(r.body,undefined);
});
test('preflight returns 401 for revoked or invalid, never returns private user data',async()=>{
 const r=response();
 await handlePreflight({method:'POST',headers:{authorization:'Bearer revoked'}},r,env,
  async()=>{throw Error('introspection denied, no account details');});
 assert.equal(r.statusCode,401);
 assert.equal(r.body,undefined);
 assert.equal(r.ended,true);
});
test('preflight does not accept wrong methods, body, cross-site origin, or missing auth',async()=>{
 const tests=[
  [{method:'GET',headers:{}},405],
  [{method:'POST',headers:{}},401],
  [{method:'POST',headers:{authorization:'Bearer a',origin:'https://evil.example'}},403],
  [{method:'POST',headers:{authorization:'Bearer a','content-length':'1'}},400],
  [{method:'POST',headers:{authorization:'Bearer a'},body:{}},400],
 ];
 for(const [req,code] of tests){
  const r=response();await handlePreflight(req,r,env,async()=>{throw Error('should not reach auth');});
  assert.equal(r.statusCode,code);
 }
 const r=response();
 await handlePreflight({method:'POST',headers:{}},r,{...env,MOSAIC_MCP_PREFLIGHT_ENABLED:'false'});
 assert.equal(r.statusCode,404);
});
