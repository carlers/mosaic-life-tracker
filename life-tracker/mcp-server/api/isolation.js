import {authenticate} from '../server/auth.js';
import {READ_SCOPE} from '../server/config.js';
import {createRepository} from '../server/repository.js';
import {preflightConfig} from './preflight.js';

const DAY='2026-11-02';
const fixtures={
 a:{category:'mcp_iso_cat_a_20261102',task:'mcp_iso_task_a_20261102'},
 b:{category:'mcp_iso_cat_b_20261102',task:'mcp_iso_task_b_20261102'},
};
function allowedUsers(env){
 const a=env.MOSAIC_MCP_ISOLATION_USER_A,b=env.MOSAIC_MCP_ISOLATION_USER_B;
 if(env.MOSAIC_MCP_ISOLATION_ENABLED!=='true'||
    !/^[a-zA-Z0-9_.-]{1,36}$/.test(a??'')||
    !/^[a-zA-Z0-9_.-]{1,36}$/.test(b??'')||a===b)
   throw Error('Isolation probe disabled');
 preflightConfig(env);
 return {a,b};
}
// Status-only test for disposable Scratch users; never reveal private data.
export async function handleIsolation(req,res,env=process.env,verify=authenticate,makeRepo=createRepository){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 let users;
 try{users=allowedUsers(env);}catch{return res.status(404).end();}
 if(req.method!=='POST'){
   res.setHeader('Allow','POST');return res.status(405).end();
 }
 if(req.headers.origin&&req.headers.origin!==new URL(env.MOSAIC_MCP_RESOURCE).origin)
   return res.status(403).end();
 if(req.body!==undefined&&req.body!==null||Number(req.headers['content-length']??0)>0)
   return res.status(400).end();
 const header=req.headers.authorization;
 if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_~+./=-]+$/.test(header))
   return res.status(401).end();
 let identity;
 try{identity=await verify(header,READ_SCOPE,{...env,MOSAIC_MCP_ENABLED:'true'});}
 catch{return res.status(401).end();}
 const label=identity.owner===users.a?'a':identity.owner===users.b?'b':null;
 if(label===null)return res.status(403).end();
 try{
   const repo=makeRepo(identity.owner,{...env,MOSAIC_MCP_ENABLED:'true'});
   const [cats,tasks]=await Promise.all([repo.categories(),repo.tasks({date:DAY})]);
   const own=fixtures[label],other=fixtures[label==='a'?'b':'a'];
   const valid=Array.isArray(cats.rows)&&Array.isArray(tasks.rows)&&
     cats.total===1&&tasks.total===1&&
     cats.rows.length===1&&tasks.rows.length===1&&
     cats.rows[0].$id===own.category&&cats.rows[0].user_id===identity.owner&&
     tasks.rows[0].$id===own.task&&tasks.rows[0].user_id===identity.owner&&
     tasks.rows[0].category_id===own.category&&
     !cats.rows.some(x=>x.$id===other.category)&&
     !tasks.rows.some(x=>x.$id===other.task);
   return res.status(valid?204:409).end();
 }catch{return res.status(503).end();}
}
export default function handler(req,res){return handleIsolation(req,res);}
