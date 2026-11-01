'use strict';
const {Client,TablesDB,Query}=require('node-appwrite');
const SCRATCH='6a96e82d000d1310b3be';
const ENDPOINT='https://fra.cloud.appwrite.io/v1';
const ISSUER=ENDPOINT+'/oauth2/'+SCRATCH;
const SCOPE='tasks.read';
let jwks;
function enabled(env) {
  return env.VERCEL_ENV==='preview'&&env.MOSAIC_MCP_SCRATCH_ONLY==='true'&&
    env.MOSAIC_MCP_PROJECT_ID===SCRATCH&&env.MOSAIC_MCP_ISSUER===ISSUER&&
    typeof env.MOSAIC_MCP_RESOURCE==='string'&&
    /^https:\/\/[a-z0-9.-]+\/mcp$/.test(env.MOSAIC_MCP_RESOURCE)&&
    typeof env.MOSAIC_MCP_READ_KEY==='string'&&env.MOSAIC_MCP_READ_KEY.length>12;
}
async function verifyAuthorization(header,env) {
  if(!enabled(env))throw Error('MCP disabled');
  const m=/^Bearer ([A-Za-z0-9._~+\/-]+=*)$/.exec(header??'');
  if(!m)throw Error('Missing token');
  const {jwtVerify,createRemoteJWKSet}=await import('jose');
  jwks??=createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks.json'));
  const {payload}=await jwtVerify(m[1],jwks,{
    issuer:ISSUER,audience:env.MOSAIC_MCP_RESOURCE,
    typ:'at+jwt',algorithms:['RS256'],
  });
  if(!payload.scope?.split(' ').includes(SCOPE)||typeof payload.sub!=='string')
    throw Error('Insufficient scope');
  return payload.sub;
}
function repository(env) {
  if(!enabled(env))throw Error('MCP disabled');
  const client=new Client().setEndpoint(ENDPOINT).setProject(SCRATCH)
    .setKey(env.MOSAIC_MCP_READ_KEY);
  const db=new TablesDB(client);
  const base=owner=>[Query.equal('user_id',owner),Query.equal('deleted',false),Query.limit(20)];
  return {
    categories:async owner=>(await db.listRows({databaseId:'life_tracker',
      tableId:'categories',queries:base(owner)})).rows??[],
    tasks:async(owner,date)=>(await db.listRows({databaseId:'life_tracker',
      tableId:'tasks',queries:[...base(owner),...(date?[Query.equal('date',date)]:[])]})).rows??[],
  };
}
function metadata(env) {
  if(!enabled(env))throw Error('MCP disabled');
  return {resource:env.MOSAIC_MCP_RESOURCE,authorization_servers:[ISSUER],
    scopes_supported:[SCOPE],bearer_methods_supported:['header']};
}
module.exports={enabled,verifyAuthorization,repository,metadata,SCRATCH,ISSUER};
