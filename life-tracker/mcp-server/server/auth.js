import {createRemoteJWKSet,jwtVerify} from 'jose';
import {config,ISSUER,SCRATCH,PROJECT_AUDIENCE,PUBLIC_SCOPES} from './config.js';
const JWKS=createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks.json'),{timeoutDuration:5000});
export async function authenticate(header,scope,env=process.env,fetcher=fetch) {
 const {key}=config(env);
 const bearer=/^Bearer ([A-Za-z0-9_~+./=-]+)$/.exec(header??'');
 if(!bearer)throw Error('Missing bearer credential');
 const token=bearer[1];
 const {payload,protectedHeader}=await jwtVerify(token,JWKS,{
   issuer:ISSUER,audience:PROJECT_AUDIENCE,algorithms:['RS256'],
   clockTolerance:10,maxTokenAge:'1h'});
 if(protectedHeader.alg!=='RS256'||!payload.tokenId||!payload.client_id||
    typeof payload.sub!=='string'||!/^[a-zA-Z0-9_.-]{1,36}$/.test(payload.sub))
    throw Error('Invalid access-token type or owner');
 const reply=await fetcher(ISSUER+'/introspect',{
   method:'POST',headers:{'X-Appwrite-Project':SCRATCH,
     'X-Appwrite-Key':key,'Content-Type':'application/json'},
   body:JSON.stringify({token,token_type_hint:'access_token'}),
   signal:AbortSignal.timeout(8000)});
 if(!reply.ok)throw Error('Token introspection unavailable');
 const state=await reply.json();
 if(state.active!==true||state.token_use!=='access_token'||
    state.token_type?.toLowerCase()!=='bearer'||
    state.sub!==payload.sub||state.client_id!==payload.client_id||
    ![state.aud].flat().includes(PROJECT_AUDIENCE)||state.iss!==ISSUER||
    typeof state.exp!=='number'||state.exp<Math.floor(Date.now()/1000)||
    !String(state.scope??'').split(/\s+/).includes(scope))
    throw Error('Revoked, invalid or missing token scope');
 return {owner:payload.sub,clientId:payload.client_id,scopes:state.scope};
}
export function protectedResourceMetadata(env=process.env){
 const {resource}=config(env);
 return {resource,authorization_servers:[ISSUER],scopes_supported:PUBLIC_SCOPES,
   bearer_methods_supported:['header']};
}
export function challenge(resource) {
 return 'Bearer resource_metadata="'+new URL('/.well-known/oauth-protected-resource/mcp',resource).href+
   '", error="invalid_token"';
}
