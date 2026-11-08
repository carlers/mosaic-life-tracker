import {config,READ_SCOPE} from '../server/config.js';
import {resourceMetadata,authenticateBearer} from '../server/oauth.js';
import {TOOL_DEFS,requiredScope,runTool} from '../server/tools.js';
const ok=(id,result)=>({jsonrpc:'2.0',id,result});
const fail=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
export async function handleRpc(body,access) {
  const id=(typeof body?.id==='number'||typeof body?.id==='string')?body.id:null;
  if (!body || typeof body!=='object' || Array.isArray(body) || body.jsonrpc!=='2.0' ||
      typeof body.method!=='string') return fail(id,-32600,'Invalid JSON-RPC');
  if (body.method==='notifications/initialized') return null;
  if (body.method==='initialize') {
    return ok(id,{protocolVersion:'2025-06-18',
      serverInfo:{name:'mosaic-github-projects-admin',version:'0.1.0'},
      capabilities:{tools:{listChanged:false}}});
  }
  if (body.method==='ping') return ok(id,{});
  if (body.method==='tools/list') return ok(id,{tools:TOOL_DEFS});
  if (body.method!=='tools/call') return fail(id,-32601,'Unsupported method');
  const name=body.params?.name;
  if (!TOOL_DEFS.some(t=>t.name===name)) return fail(id,-32602,'Unsupported tool');
  let identity;
  try {identity=authenticateBearer(access.header,access.cfg,requiredScope(name));}
  catch{return ok(id,{isError:true,content:[{type:'text',text:'Insufficient granted MCP scope.'}]});}
  try {
    const args=body.params?.arguments??{};
    const result=await runTool(name,args,identity.githubToken);
    return ok(id,{content:[{type:'text',text:JSON.stringify(result)}],isError:false});
  } catch {
    return ok(id,{content:[{type:'text',text:'GitHub configuration read/write rejected or incomplete. Verify current project state before retrying.'}],isError:true});
  }
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  let cfg;
  try {cfg=config();}catch{return res.status(503).json({error:'Admin MCP disabled'});}
  const auth=req.headers.authorization;
  const challenge='Bearer resource_metadata="'+cfg.origin+'/.well-known/oauth-protected-resource", scope="projects.read"';
  try {authenticateBearer(auth,cfg,READ_SCOPE);} catch {
    res.setHeader('WWW-Authenticate',challenge);
    return res.status(401).json({error:'Unauthorized',resource_metadata:resourceMetadata(cfg)});
  }
  if (req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).end();}
  if (Number(req.headers['content-length'])>65536) return res.status(413).end();
  const body=(typeof req.body==='string')?(()=>{try{return JSON.parse(req.body);}catch{return null;}})():req.body;
  if (!body || JSON.stringify(body).length>65536) return res.status(400).json({error:'Malformed request'});
  const result=await handleRpc(body,{header:auth,cfg});
  return result===null?res.status(202).end():res.status(200).json(result);
}
