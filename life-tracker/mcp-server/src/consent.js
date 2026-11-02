import {Client,Account,Oauth2} from 'appwrite';

const SCRATCH='6a96e82d000d1310b3be';
const ENDPOINT='https://fra.cloud.appwrite.io/v1';
const RESOURCE=new URL('/api/mcp',location.origin).href;
const client=new Client().setEndpoint(ENDPOINT).setProject(SCRATCH);
const account=new Account(client),oauth=new Oauth2(client);
const elt=id=>document.getElementById(id);
const qs=new URLSearchParams(location.search);
let grantId=qs.get('grant_id')||'';
let grant=null;
let busy=false;
const safe=(s)=>String(s??'').slice(0,450);
function status(message,error=false){elt(error?'error':'status').textContent=message;}
async function redirectResult(result) {
 if(!result?.redirectUrl)throw Error('OAuth provider did not supply a redirect.');
 const url=new URL(result.redirectUrl);
 if(url.protocol!=='https:')throw Error('Invalid provider redirect');
 location.assign(url.href);
}
async function renderGrant(id){
 const loaded=await oauth.getGrant({grantId:id});
 const scopes=loaded.scopes??loaded.scope??[];
 const tokens=Array.isArray(scopes)?scopes:String(scopes).split(' ');
 const allowed=['openid','profile','email','phone','tasks.read','tasks.create','tasks.bulk.propose'];
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
     elt('login').style.display='block';status('Sign in to your Scratch Mosaic account to review the grant.');
   }else{status(e?.message||'Authorization could not be loaded.',true);}
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
 }catch(e){status(e?.message||'Sign-in failed.',true);}finally{busy=false;}
});
elt('ack').addEventListener('change',e=>{elt('approve').disabled=!e.currentTarget.checked;});
elt('approve').addEventListener('click',async()=>{
 if(busy||!grantId||!grant||!elt('ack').checked)return;busy=true;
 elt('approve').disabled=true;elt('reject').disabled=true;
 try{const result=await oauth.approve({grantId});await redirectResult(result);}
 catch(e){status(e?.message||'Could not approve grant.',true);
   busy=false;elt('approve').disabled=false;elt('reject').disabled=false;}
});
elt('reject').addEventListener('click',async()=>{
 if(busy||!grantId)return;busy=true;
 try{const result=await oauth.reject({grantId});await redirectResult(result);}
 catch(e){status(e?.message||'Could not reject grant.',true);busy=false;}
});
void init();
