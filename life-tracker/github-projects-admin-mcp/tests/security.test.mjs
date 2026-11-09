import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal,unseal,pkceChallenge} from '../server/crypto.js';
import {authorize,githubCallback,exchangeCode,registerClient,authenticateBearer,resourceMetadata} from '../server/oauth.js';
const secret=randomBytes(32).toString('base64url');
const cfg={secret,resource:'https://admin-example.vercel.app/api/mcp',origin:'https://admin-example.vercel.app',
 clientId:'Iv1_abcdefabcdef1234',clientSecret:'secret-is-only-used-in-the-server',
 clientRedirect:'https://chatgpt.com/connector_platform_oauth_redirect'};
test('sealed credentials are authenticated, time-bound and opaque',()=>{
 const value=seal(secret,{type:'access',githubToken:'github-secret'},60,1000);
 assert.ok(!value.includes('github-secret'));
 assert.equal(unseal(secret,value,'access',1010).githubToken,'github-secret');
 assert.throws(()=>unseal(secret,value,'access',1061));
 assert.throws(()=>unseal(secret,value.slice(0,-3)+'abc','access',1010));
 assert.throws(()=>unseal(secret,value,'code',1010));
});
test('dynamic registration enforces a single approved redirect',()=>{
 assert.throws(()=>registerClient({redirect_uris:['https://evil.example/callback']},cfg));
 assert.throws(()=>registerClient({redirect_uris:[cfg.clientRedirect,cfg.clientRedirect]},cfg));
 const registered=registerClient({redirect_uris:[cfg.clientRedirect]},cfg);
 assert.equal(registered.token_endpoint_auth_method,'none');
 assert.equal(unseal(secret,registered.client_id,'client').redirect,cfg.clientRedirect);
});
test('ChatGPT per-connector callbacks register and bind exactly across OAuth',async()=>{
 const modern='https://chatgpt.com/connector/oauth/abcdef12-3456-7890-abcd-0123456789ef';
 const registered=registerClient({redirect_uris:[modern],token_endpoint_auth_method:'none'},cfg);
 assert.equal(unseal(secret,registered.client_id,'client').redirect,modern);
 const verifier='x'.repeat(55);
 const authorization=new URL(authorize({response_type:'code',code_challenge_method:'S256',
   code_challenge:pkceChallenge(verifier),state:'modern-callback-001',client_id:registered.client_id,
   redirect_uri:modern,resource:cfg.resource,scope:'projects.read'},cfg));
 const callback=new URL(githubCallback({code:'githubcode-modern-123',state:authorization.searchParams.get('state')},cfg));
 assert.equal(callback.origin,'https://chatgpt.com');
 assert.equal(callback.pathname,'/connector/oauth/abcdef12-3456-7890-abcd-0123456789ef');
 assert.equal(callback.searchParams.get('state'),'modern-callback-001');
 const params={grant_type:'authorization_code',code:callback.searchParams.get('code'),
   client_id:registered.client_id,redirect_uri:modern,code_verifier:verifier};
 const fakeGithub=async target=>({ok:true,json:async()=>target.includes('access_token')
   ?{access_token:'simulated-gh-grant',scope:'project read:user'}:{login:'carlers'}});
 await assert.rejects(exchangeCode({...params,redirect_uri:cfg.clientRedirect},cfg,fakeGithub));
 const token=await exchangeCode(params,cfg,fakeGithub);
 assert.equal(token.scope,'projects.read');
 assert.equal(authenticateBearer('Bearer '+token.access_token,cfg,'projects.read').login,'carlers');
 assert.throws(()=>authenticateBearer('Bearer '+token.access_token,cfg,'projects.write'));
});
test('redirect validation rejects spoofed domains, query strings, and nested paths',()=>{
 const bad=[
  'https://chatgpt.com.evil.example/connector/oauth/abcdef123456',
  'https://evil-chatgpt.com/connector/oauth/abcdef123456',
  'http://chatgpt.com/connector/oauth/abcdef123456',
  'https://chatgpt.com/connector/oauth/abcdef123456?next=https://evil.example',
  'https://chatgpt.com/connector/oauth/abcdef123456#fragment',
  'https://chatgpt.com/connector/oauth/abcdef123456/extra',
  'https://chatgpt.com@evil.example/connector/oauth/abcdef123456',
  'https://chatgpt.com/connector/oauth/a',
  'https://chatgpt.com/connector/oauth/abcdef123456%2Fextra'
 ];
 for (const uri of bad) assert.throws(()=>registerClient({redirect_uris:[uri]},cfg),uri);
});
test('PKCE and resource binding apply throughout GitHub OAuth code exchange',async()=>{
 const client=registerClient({redirect_uris:[cfg.clientRedirect]},cfg).client_id;
 const verifier='b'.repeat(50);
 const state='test-state-123';
 const url=new URL(authorize({response_type:'code',code_challenge_method:'S256',
   code_challenge:pkceChallenge(verifier),state,client_id:client,redirect_uri:cfg.clientRedirect,
   resource:cfg.resource,scope:'projects.read projects.write'},cfg));
 assert.equal(url.hostname,'github.com');
 assert.equal(url.searchParams.get('scope'),'project read:user');
 const back=new URL(githubCallback({code:'githubcode123456',state:url.searchParams.get('state')},cfg));
 assert.equal(back.origin,'https://chatgpt.com');
 assert.equal(back.searchParams.get('state'),state);
 const code=back.searchParams.get('code');
 let exchanges=0;
 const fetcher=async target=>{
   if (target.includes('access_token')) {exchanges++;return {ok:true,json:async()=>({access_token:'upstream-token',scope:'project read:user'})};}
   return {ok:true,json:async()=>({login:'carlers'})};
 };
 const form={grant_type:'authorization_code',code,client_id:client,redirect_uri:cfg.clientRedirect,code_verifier:verifier};
 await assert.rejects(exchangeCode({...form,code_verifier:'c'.repeat(50)},cfg,fetcher));
 await assert.rejects(exchangeCode({...form,redirect_uri:'https://evil.example/'},cfg,fetcher));
 const out=await exchangeCode(form,cfg,fetcher);
 assert.equal(exchanges,1);
 assert.equal(out.scope,'projects.read projects.write');
 const grant=authenticateBearer('Bearer '+out.access_token,cfg,'projects.write');
 assert.equal(grant.login,'carlers');
 assert.equal(grant.githubToken,'upstream-token');
 assert.equal(resourceMetadata(cfg).resource,cfg.resource);
 assert.throws(()=>authenticateBearer('Bearer '+out.access_token,{...cfg,resource:'https://other.vercel.app/api/mcp'},'projects.read'));
});
test('wrong GitHub owner and missing GitHub project permission fail closed',async()=>{
 const client=registerClient({redirect_uris:[cfg.clientRedirect]},cfg).client_id;
 const verifier='e'.repeat(48);
 const auth=new URL(authorize({response_type:'code',code_challenge_method:'S256',
   code_challenge:pkceChallenge(verifier),state:'secure-test-state',client_id:client,
   redirect_uri:cfg.clientRedirect},cfg));
 const code=new URL(githubCallback({state:auth.searchParams.get('state'),code:'anotherGithubCode'},cfg)).searchParams.get('code');
 const params={grant_type:'authorization_code',code,client_id:client,redirect_uri:cfg.clientRedirect,code_verifier:verifier};
 await assert.rejects(exchangeCode(params,cfg,async url=>({ok:true,json:async()=>url.includes('access_token')
   ?{access_token:'x',scope:'read:user'}:{login:'carlers'}})));
 await assert.rejects(exchangeCode(params,cfg,async url=>({ok:true,json:async()=>url.includes('access_token')
   ?{access_token:'x',scope:'project'}:{login:'somebody-else'}})));
});
