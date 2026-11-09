import {config,OWNER,READ_SCOPE,WRITE_SCOPE,SCOPES} from './config.js';
import {seal,unseal,pkceChallenge,safeMatch} from './crypto.js';
export const authorizationMetadata = cfg => ({
  issuer:cfg.origin,authorization_endpoint:cfg.origin+'/api/oauth/authorize',
  token_endpoint:cfg.origin+'/api/oauth/token',registration_endpoint:cfg.origin+'/api/oauth/register',
  response_types_supported:['code'],grant_types_supported:['authorization_code'],
  token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],
  scopes_supported:SCOPES
});
export const resourceMetadata = cfg => ({resource:cfg.resource,authorization_servers:[cfg.origin],
  bearer_methods_supported:['header'],scopes_supported:SCOPES});
export function validateRedirect(value,cfg) {
  // ChatGPT's current callback is scoped per connector, not the legacy fixed URI.
  // Accept only the exact ChatGPT origin and an opaque single-segment callback ID.
  if (typeof value !== 'string' || value.length > 512) throw Error('Invalid client redirect URI');
  let parsed;
  try { parsed = new URL(value); } catch { throw Error('Invalid client redirect URI'); }
  const segments = parsed.pathname.split('/');
  const modern = parsed.origin === 'https://chatgpt.com' &&
    segments.length === 4 && segments[0] === '' &&
    segments[1] === 'connector' && segments[2] === 'oauth' &&
    /^[A-Za-z0-9_-]{8,256}$/.test(segments[3]);
  if ((value !== cfg.clientRedirect && !modern) ||
      parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.search || parsed.hash || parsed.href !== value)
    throw Error('Unapproved client redirect URI');
  return value;
}
export function requestedScopes(scope) {
  if (scope === undefined || scope === null || scope === '') return [READ_SCOPE,WRITE_SCOPE];
  const values = scope.split(/\s+/).filter(Boolean);
  if (!values.length || values.some(v=>!SCOPES.includes(v))) throw Error('Unsupported scope');
  return [...new Set(values)];
}
export function registerClient(body,cfg) {
  if (!body || !Array.isArray(body.redirect_uris) || body.redirect_uris.length !== 1)
    throw Error('One redirect URI required');
  const redirect = validateRedirect(body.redirect_uris[0],cfg);
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none')
    throw Error('Public PKCE clients only');
  const clientId = seal(cfg.secret,{type:'client',redirect},86400 * 30);
  return {client_id:clientId,client_id_issued_at:Math.floor(Date.now()/1000),
    client_id_expires_in:86400*30,redirect_uris:[redirect],
    grant_types:['authorization_code'],response_types:['code'],token_endpoint_auth_method:'none'};
}
export function authorize(params,cfg) {
  if (params.response_type !== 'code' || params.code_challenge_method !== 'S256' ||
    !/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge || '') ||
    typeof params.state !== 'string' || params.state.length < 8 || params.state.length > 2000)
    throw Error('Invalid authorization code/PKCE request');
  const client = unseal(cfg.secret,params.client_id,'client');
  validateRedirect(params.redirect_uri,cfg);
  if (client.redirect !== params.redirect_uri) throw Error('Client redirect mismatch');
  if (params.resource && params.resource !== cfg.resource) throw Error('Resource audience mismatch');
  const scopes = requestedScopes(params.scope);
  const state = seal(cfg.secret,{type:'state',client:params.client_id,redirect:params.redirect_uri,
    challenge:params.code_challenge,clientState:params.state,scopes,resource:cfg.resource},300);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id',cfg.clientId);
  url.searchParams.set('redirect_uri',cfg.origin+'/api/oauth/github-callback');
  url.searchParams.set('scope','project read:user');
  url.searchParams.set('state',state);
  return url.toString();
}
export function githubCallback(params,cfg) {
  if (!/^[a-zA-Z0-9_-]{5,300}$/.test(params.code || '')) throw Error('Invalid GitHub code');
  const state = unseal(cfg.secret,params.state,'state');
  if (state.resource !== cfg.resource) throw Error('Wrong resource');
  const code = seal(cfg.secret,{type:'code',githubCode:params.code,client:state.client,
    redirect:state.redirect,challenge:state.challenge,scopes:state.scopes,resource:state.resource},120);
  const url = new URL(validateRedirect(state.redirect,cfg));
  url.searchParams.set('code',code);
  url.searchParams.set('state',state.clientState);
  return url.toString();
}
export async function exchangeCode(params,cfg,fetcher=fetch) {
  if (params.grant_type !== 'authorization_code' || typeof params.code_verifier !== 'string' ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(params.code_verifier)) throw Error('Invalid PKCE token request');
  const payload = unseal(cfg.secret,params.code,'code');
  if (payload.resource !== cfg.resource || !safeMatch(payload.client,params.client_id) ||
      payload.redirect !== validateRedirect(params.redirect_uri,cfg) ||
      !safeMatch(pkceChallenge(params.code_verifier),payload.challenge)) throw Error('PKCE or resource mismatch');
  unseal(cfg.secret,params.client_id,'client');
  const reply = await fetcher('https://github.com/login/oauth/access_token',{
    method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},
    body:JSON.stringify({client_id:cfg.clientId,client_secret:cfg.clientSecret,code:payload.githubCode,
      redirect_uri:cfg.origin+'/api/oauth/github-callback'}),signal:AbortSignal.timeout(8000)});
  if (!reply.ok) throw Error('GitHub OAuth exchange failed');
  const exchange = await reply.json();
  if (typeof exchange.access_token !== 'string' || !exchange.access_token ||
      !(exchange.scope || '').split(/[ ,]+/).includes('project')) throw Error('GitHub project scope denied');
  const profile = await fetcher('https://api.github.com/user',{headers:{
    'Authorization':'Bearer '+exchange.access_token,'Accept':'application/vnd.github+json',
    'User-Agent':'mosaic-gh-projects-admin-mcp'},signal:AbortSignal.timeout(8000)});
  if (!profile.ok) throw Error('Cannot verify GitHub user');
  const user = await profile.json();
  if (user.login !== OWNER) throw Error('Wrong GitHub account');
  const expiresIn = 3600;
  const token = seal(cfg.secret,{type:'access',githubToken:exchange.access_token,login:user.login,
    scopes:payload.scopes,resource:cfg.resource,client:payload.client},expiresIn);
  return {access_token:token,token_type:'Bearer',expires_in:expiresIn,
    scope:payload.scopes.join(' ')};
}
export function authenticateBearer(header,cfg,scope) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw Error('Missing bearer');
  const value = unseal(cfg.secret,header.slice(7),'access');
  if (value.resource !== cfg.resource || value.login !== OWNER ||
      !Array.isArray(value.scopes) || !value.scopes.includes(scope) ||
      typeof value.githubToken !== 'string') throw Error('Unauthorized token');
  return {login:value.login,githubToken:value.githubToken};
}
