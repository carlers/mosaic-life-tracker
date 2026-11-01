import {authenticate,challenge} from '../server/auth.js';
import {config,READ_SCOPE} from '../server/config.js';
import {TOOL_DEFS,requiredScope,callTool} from '../server/tools.js';

const fail=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const ok=(id,result)=>({jsonrpc:'2.0',id,result});
const now=new Map();
function checkRate(owner) {
 const t=Date.now(),recent=now.get(owner)||[];
 const next=recent.filter(x=>t-x<60000);
 if(next.length>=40)throw Error('Rate limited');
 next.push(t);now.set(owner,next);
 if(now.size>500)now.clear();
}
export async function handleRpc(body,auth,env=process.env,invoke=callTool){
 const id=(typeof body?.id==='number'||typeof body?.id==='string')?body.id:null;
 if(!body||typeof body!=='object'||Array.isArray(body)||body.jsonrpc!=='2.0'||
    typeof body.method!=='string')return fail(id,-32600,'Invalid JSON-RPC');
 if(body.method==='notifications/initialized')return null;
 if(body.method==='initialize')return ok(id,{protocolVersion:'2025-06-18',
     serverInfo:{name:'mosaic-scratch',version:'0.1.0'},capabilities:{tools:{listChanged:false}}});
 if(body.method==='ping')return ok(id,{});
 if(body.method==='tools/list')return ok(id,{tools:TOOL_DEFS});
 if(body.method!=='tools/call')return fail(id,-32601,'Unknown method');
 const name=body.params?.name;
 if(!TOOL_DEFS.some(x=>x.name===name))return fail(id,-32602,'Unsupported tool');
 const scope=requiredScope(name);
 if(!auth.scopes.split(/\s+/).includes(scope))
   return ok(id,{isError:true,content:[{type:'text',text:'Insufficient granted permission.'}]});
 try {
   checkRate(auth.owner);
   const args=body.params?.arguments??{};
   const value=await invoke(name,args,auth.owner,env);
   return ok(id,{content:[{type:'text',text:JSON.stringify(value)}],isError:false});
 }catch {
   return ok(id,{content:[{type:'text',text:'Request rejected or incomplete. Nothing was implicitly changed.'}],isError:true});
 }
}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 let cfg;
 try{cfg=config();}catch{return res.status(404).json({error:'Not found'});}
 if(req.headers.origin && req.headers.origin!==new URL(cfg.resource).origin)
   return res.status(403).json({error:'Origin forbidden'});
 if(req.method!=='POST'){
   res.setHeader('Allow','POST');
   return res.status(405).json({error:'Method not allowed'});
 }
 if(Number(req.headers['content-length'])>65536)
   return res.status(413).json({error:'Payload too large'});
 const body=typeof req.body==='string'?(()=>{try{return JSON.parse(req.body);}catch{return null;}})():req.body;
 if(!body||JSON.stringify(body).length>65536)
   return res.status(400).json({error:'Malformed request'});
 const method=body.method,scope=method==='tools/call'?requiredScope(body.params?.name):READ_SCOPE;
 let identity;
 try {identity=await authenticate(req.headers.authorization,scope);}
 catch {
   res.setHeader('WWW-Authenticate',challenge(cfg.resource));
   return res.status(401).json({error:'Unauthorized'});
 }
 const result=await handleRpc(body,identity);
 return result===null?res.status(202).end():res.status(200).json(result);
}
