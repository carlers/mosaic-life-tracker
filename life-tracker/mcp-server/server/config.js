// Independently pinned tenants: never infer an issuer/project from a caller's URL.
export const SCRATCH='6a96e82d000d1310b3be';
export const PRODUCTION='6a9703c50016b37110ff';
export const ENDPOINT='https://fra.cloud.appwrite.io/v1';
export const PRODUCTION_ENDPOINT='https://sgp.cloud.appwrite.io/v1';
export const ISSUER=ENDPOINT+'/oauth2/'+SCRATCH;
export const PRODUCTION_ISSUER=PRODUCTION_ENDPOINT+'/oauth2/'+PRODUCTION;
export const PROJECT_AUDIENCE=ENDPOINT+'/'+SCRATCH;
export const READ_SCOPE='tasks.read';
export const CREATE_SCOPE='tasks.create';
export const PROPOSE_SCOPE='tasks.bulk.propose';
export const SCRATCH_RESOURCE='https://mosaic-mcp-scratch-preview.vercel.app/api/mcp';
export const PRODUCTION_RESOURCE='https://mosaic-mcp-prod.vercel.app/api/mcp';
export const PUBLIC_SCOPES=[READ_SCOPE,CREATE_SCOPE,PROPOSE_SCOPE];

export const PINNED={
 scratch:{projectId:SCRATCH,endpoint:ENDPOINT,issuer:ISSUER,resource:SCRATCH_RESOURCE,vercelEnv:'preview'},
 production:{projectId:PRODUCTION,endpoint:PRODUCTION_ENDPOINT,issuer:PRODUCTION_ISSUER,resource:PRODUCTION_RESOURCE,vercelEnv:'production'}
};
export function tenant(env=process.env){
 const name=env.MOSAIC_MCP_ENV,selected=Object.hasOwn(PINNED,name??'')?PINNED[name]:null;
 if(!selected || env.MOSAIC_MCP_PROJECT_ID!==selected.projectId||
    env.MOSAIC_MCP_RESOURCE!==selected.resource||
    env.VERCEL_ENV!==selected.vercelEnv)
    throw Error('MCP tenant, resource or deployment target mismatch');
 return {name,...selected};
}
export function config(env=process.env) {
 const selected=tenant(env);
 if(env.MOSAIC_MCP_ENABLED!=='true'||
    typeof env.MOSAIC_MCP_KEY!=='string'||env.MOSAIC_MCP_KEY.length<20)
    throw Error('MCP disabled or missing isolated key');
 if(selected.name==='production' &&
    (env.MOSAIC_MCP_PRODUCTION_ENABLED!=='true'||env.MOSAIC_MCP_ALLOW_WRITES!=='false'))
    throw Error('Read-only Production MCP not activated');
 return {...selected,key:env.MOSAIC_MCP_KEY};
}
