import {authenticate} from '../server/auth.js';
import {config,READ_SCOPE} from '../server/config.js';

// This diagnostic reuses canonical JWT and live Appwrite introspection without
// exposing any MCP tools, account identifiers, task data, or credentials.
export function preflightConfig(env=process.env) {
 if(env.MOSAIC_MCP_PREFLIGHT_ENABLED!=='true'||
    env.MOSAIC_MCP_ENABLED!=='false'||
    env.MOSAIC_MCP_ALLOW_WRITES!=='false')
   throw Error('Scratch MCP preflight disabled');
 return config({...env,MOSAIC_MCP_ENABLED:'true'});
}

export async function handlePreflight(req,res,env=process.env,verify=authenticate) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 let cfg;
 try {cfg=preflightConfig(env);}catch{return res.status(404).end();}
 if(req.method!=='POST') {
   res.setHeader('Allow','POST');
   return res.status(405).end();
 }
 if(req.headers.origin&&req.headers.origin!==new URL(cfg.resource).origin)
   return res.status(403).end();
 if(Number(req.headers['content-length']??0)>0 || req.body!==undefined && req.body!==null)
   return res.status(400).end();
 const header=req.headers.authorization;
 if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_~+./=-]+$/.test(header))
   return res.status(401).end();
 try {
   await verify(header,READ_SCOPE,{...env,MOSAIC_MCP_ENABLED:'true'});
   return res.status(204).end();
 }catch{
   return res.status(401).end();
 }
}

export default function handler(req,res) {
 return handlePreflight(req,res);
}
