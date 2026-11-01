export const SCRATCH='6a96e82d000d1310b3be';
export const ENDPOINT='https://fra.cloud.appwrite.io/v1';
export const ISSUER=ENDPOINT+'/oauth2/'+SCRATCH;
export const PROJECT_AUDIENCE=ENDPOINT+'/'+SCRATCH;
export const READ_SCOPE='tasks.read';
export const CREATE_SCOPE='tasks.create';
export const PROPOSE_SCOPE='tasks.bulk.propose';
export function config(env=process.env) {
  if(env.MOSAIC_MCP_ENABLED!=='true'||env.MOSAIC_MCP_PROJECT_ID!==SCRATCH||
     env.MOSAIC_MCP_ENV!=='scratch'||env.VERCEL_ENV!=='preview'||
     typeof env.MOSAIC_MCP_RESOURCE!=='string'||
     !/^https:\/\/[a-z0-9.-]+\.vercel\.app\/mcp$/.test(env.MOSAIC_MCP_RESOURCE)||
     typeof env.MOSAIC_MCP_KEY!=='string'||env.MOSAIC_MCP_KEY.length<20)
    throw Error('MCP disabled or incorrect environment');
  return {resource:env.MOSAIC_MCP_RESOURCE,key:env.MOSAIC_MCP_KEY};
}
export const PUBLIC_SCOPES=[READ_SCOPE,CREATE_SCOPE,PROPOSE_SCOPE];
