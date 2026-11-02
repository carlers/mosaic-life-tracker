import {oauthRedirectUrl} from './redirect.js';
import {Client,Account,Oauth2} from 'appwrite';

const TENANTS={
 'https://mosaic-mcp-scratch-preview.vercel.app':{id:'6a96e82d000d1310b3be',endpoint:'https://fra.cloud.appwrite.io/v1',label:'Scratch'},
 'https://mosaic-mcp-prod.vercel.app':{id:'6a9703c50016b37110ff',endpoint:'https://sgp.cloud.appwrite.io/v1',label:'Production'}
};
const tenant=TENANTS[location.origin];
if(!tenant)throw Error('Untrusted Mosaic OAuth consent origin');
const RESOURCE=new URL('/api/mcp',location.origin).href;
const client=new Client().setEndpoint(tenant.endpoint).setProject(tenant.id);
const account=new Account(client),oauth=new Oauth2(client);
const elt=id=>document.getElementById(id);
const qs=new URLSearchParams(location.search);
let grantId=qs.get('grant_id')||'';
let grant=null;
let busy=false;
const safe=(s)=>String(s??'').slice(0,450);
function status(message,error=false){
 elt('status').textContent=error?'':message;
 elt('error').textContent=error?message:'';
}
function reportGrantError(error){
 if(error?.code===404 && /grant/i.test(String(error?.message??''))){
   grant=null;grantId='';
   elt('consent').style.display='none';
   status('The authorization grant is no longer available. Return to the requesting application and start a new authorization.',true);
 }else status(error?.message||'OAuth authorization failed.',true);
}
async function redirectResult(result) {
 if(!result?.redirectUrl)throw Error('OAuth provider did not supply a redirect.');
 const expectedRedirect=grant?.redirectUri??qs.get('redirect_uri');
 location.assign(oauthRedirectUrl(result,expectedRedirect));
}
async function renderGrant(id){
 const loaded=await oauth.getGrant({grantId:id});
 const scopes=loaded.scopes??loaded.scope??[];
 const tokens=Array.isArray(scopes)?scopes:String(scopes).split(' ');
 const allowed=tenant.label==='Production' ? ['tasks.read'] :
   ['openid','profile','email','phone','tasks.read','tasks.create','tasks.bulk.propose'];
 if(tokens.some(scope=>!allowed.includes(scope)))throw Error('Unknown requested permission; reject the request.');
 const resources=loaded.resources??loaded.resource??[];
 const targets=Array.isArray(resources)?resources:[resources];
 if(!targets.includes(RESOURCE))throw Error('Request was not explicitly bound to this Mosaic resource.');
 grant=loaded;grantId=id;
 elt('client').textContent=safe(loaded.appId??loaded.clientId??'Unknown client');
 elt('redirect').textContent=safe(loaded.redirectUri??'Provider-managed redirect');
 elt('resource').textContent=RESOURCE;
 elt('scopes').replaceChildren();
 for(const token of tokens){const li=document.createElement('li');li.textContent=token;elt('scopes').append(li);}
 elt('consent').style.display='block';elt('login').style.display='none';
 status('Review each requested permission before approving.');
}
async function authorizeAfterLogin(){
 if(grantId){await renderGrant(grantId);return;}
 const clientId=qs.get('client_id'),redirectUri=qs.get('redirect_uri'),
   responseType=qs.get('response_type'),resource=qs.getAll('resource');
 if(!clientId||!redirectUri||responseType!=='code'||!resource.includes(RESOURCE)||
    qs.get('code_challenge_method')!=='S256'||!qs.get('code_challenge'))
   throw Error('Unsupported or incomplete OAuth authorization request.');
 const result=await oauth.authorize({
   clientId,redirectUri,responseType:'code',resource,scope:qs.get('scope')??'',
   state:qs.get('state')??undefined,codeChallenge:qs.get('code_challenge'),
   codeChallengeMethod:'S256',prompt:qs.get('prompt')??undefined,
   requestUri:qs.get('request_uri')??undefined,
 });
 if(result.grantId)await renderGrant(result.grantId);
 else await redirectResult(result);
}
async function init(){
 try{
   await account.get();
   await authorizeAfterLogin();
 }catch(e){
   if(e?.code===401){
     elt('login').style.display='block';status('Sign in to your '+tenant.label+' Mosaic account to review the grant.');
   }else{reportGrantError(e);}
 }
}
elt('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;busy=true;
 try{
   const fd=new FormData(e.currentTarget);
   const email=String(fd.get('email')||'').trim();
   const password=String(fd.get('password')||'');
   if(!email||!password)throw Error('Email and password required.');
   await account.createEmailPasswordSession({email,password});
   e.currentTarget.reset();await authorizeAfterLogin();
 }catch(e){reportGrantError(e);}finally{busy=false;}
});
elt('ack').addEventListener('change',e=>{elt('approve').disabled=!e.currentTarget.checked;});
elt('approve').addEventListener('click',async()=>{
 if(busy||!grantId||!grant||!elt('ack').checked)return;busy=true;
 elt('approve').disabled=true;elt('reject').disabled=true;
 try{const result=await oauth.approve({grantId});await redirectResult(result);}
 catch(e){reportGrantError(e);
   busy=false;elt('approve').disabled=!grant||!elt('ack').checked;elt('reject').disabled=!grant;}
});
elt('reject').addEventListener('click',async()=>{
 if(busy||!grantId)return;busy=true;
 try{const result=await oauth.reject({grantId});await redirectResult(result);}
 catch(e){reportGrantError(e);busy=false;}
});
void init();
