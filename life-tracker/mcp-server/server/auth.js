import {createRemoteJWKSet,jwtVerify} from 'jose';
import {config,ISSUER,SCRATCH,PUBLIC_SCOPES} from './config.js';
const JWKS=createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks.json'),{timeoutDuration:5000});
export async function authenticate(header,scope,env=process.env,fetcher=fetch) {
 const {key,resource}=config(env);
 const bearer=/^Bearer ([A-Za-z0-9_~+./=-]+)$/.exec(header??'');
 if(!bearer)throw Error('Missing bearer credential');
 const token=bearer[1];
 const {payload,protectedHeader}=await jwtVerify(token,JWKS,{
   issuer:ISSUER,audience:resource,algorithms:['RS256'],
   typ:'at+jwt',clockTolerance:10,maxTokenAge:'1h'});
 if(protectedHeader.alg!=='RS256'||typeof payload.jti!=='string'||!payload.jti||!payload.client_id||
    !String(payload.scope??'').split(/\s+/).includes(scope)||
    typeof payload.sub!=='string'||!/^[a-zA-Z0-9_.-]{1,36}$/.test(payload.sub))
    throw Error('Invalid access-token type or owner');
 const reply=await fetcher(ISSUER+'/introspect',{
   method:'POST',headers:{'X-Appwrite-Project':SCRATCH,
     'X-Appwrite-Key':key,'Content-Type':'application/json'},
   body:JSON.stringify({token,token_type_hint:'access_token'}),
   signal:AbortSignal.timeout(8000)});
 if(!reply.ok)throw Error('Token introspection unavailable');
 const state=await reply.json();
 assertActiveResourceToken(state,payload,scope,resource);
 return {owner:payload.sub,clientId:payload.client_id,scopes:state.scope};
}

export function assertActiveResourceToken(state,payload,scope,resource,now=Math.floor(Date.now()/1000)) {
 const audiences=value=>Array.isArray(value)?value:[value];
 const granted=value=>typeof value==='string'&&value.split(/\s+/).includes(scope);
 if(!state||state.active!==true||state.token_use!=='access_token'||
    typeof state.token_type!=='string'||state.token_type.toLowerCase()!=='bearer'||
    state.sub!==payload.sub||state.client_id!==payload.client_id||
    state.jti!==payload.jti||typeof state.jti!=='string'||!state.jti||
    !audiences(payload.aud).includes(resource)||!audiences(state.aud).includes(resource)||
    state.iss!==ISSUER||typeof state.exp!=='number'||state.exp<=now||
    !granted(state.scope)||!granted(payload.scope))
    throw Error('Revoked, invalid or resource-unbound access token');
}
export function protectedResourceMetadata(env=process.env){
 const {resource}=config(env);
 return {resource,authorization_servers:[ISSUER],scopes_supported:PUBLIC_SCOPES,
   bearer_methods_supported:['header']};
}
export function challenge(resource) {
 return 'Bearer resource_metadata="'+new URL('/.well-known/oauth-protected-resource',resource).href+
   '", error="invalid_token"';
}
