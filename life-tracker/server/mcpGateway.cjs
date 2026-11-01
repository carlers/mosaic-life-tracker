'use strict';

/**
 * Authoritative read-only MCP tool adapter. The caller must supply a verified
 * Appwrite OAuth2 resource token owner, never a user-provided owner ID.
 */
const tools = Object.freeze([
  {name:'mosaic_list_categories',description:'List the connected user’s categories (up to 20)',
    inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'mosaic_list_tasks',description:'List connected user’s tasks (up to 20), optionally by date',
    inputSchema:{type:'object',properties:{
      date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}
    },additionalProperties:false}},
]);
const allowOwner = id => typeof id==='string' && /^[a-zA-Z0-9._-]{1,36}$/.test(id);
const ok = (id,result) => ({jsonrpc:'2.0',id,result});
const error = (id,code,message) => ({jsonrpc:'2.0',id,error:{code,message}});
function dateValid(value) {
  if(typeof value!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
async function dispatch(body,owner,store) {
  if(!allowOwner(owner))throw Error('Invalid authenticated user');
  const id=body?.id??null;
  if(!body||typeof body!=='object'||Array.isArray(body)||
    body.jsonrpc!=='2.0'||typeof body.method!=='string')
    return error(id,-32600,'Invalid request');
  if(body.method==='notifications/initialized')return null;
  if(body.method==='initialize')return ok(id,{
    protocolVersion:'2025-11-25',capabilities:{tools:{}},
    serverInfo:{name:'mosaic-scratch-readonly',version:'0.1.0'}});
  if(body.method==='ping')return ok(id,{});
  if(body.method==='tools/list')return ok(id,{tools});
  if(body.method!=='tools/call')return error(id,-32601,'Method not found');
  const tool=body.params?.name,args=body.params?.arguments??{};
  if(!tools.some(x=>x.name===tool))return error(id,-32602,'Tool not available');
  if(!args||typeof args!=='object'||Array.isArray(args))
    return error(id,-32602,'Invalid tool input');
  if(tool==='mosaic_list_categories'&&Object.keys(args).length)
    return error(id,-32602,'No arguments supported');
  if(tool==='mosaic_list_tasks'&&
    (Object.keys(args).some(x=>x!=='date')||
     (args.date!==undefined&&!dateValid(args.date))))
    return error(id,-32602,'Invalid date');
  try {
    const rows=tool==='mosaic_list_categories'?
      await store.categories(owner):await store.tasks(owner,args.date);
    if(!Array.isArray(rows)||rows.length>20||
      rows.some(x=>!x||x.user_id!==owner||x.deleted!==false))
      throw Error('Unsafe datastore result');
    const result=rows.map(x=>tool==='mosaic_list_categories'?
      {id:String(x.$id??''),name:String(x.name??'')}:
      {id:String(x.$id??''),title:String(x.title??''),date:String(x.date??''),
        categoryId:String(x.category_id??''),completed:x.is_completed===true});
    return ok(id,{content:[{type:'text',text:JSON.stringify(result)}],isError:false});
  } catch {
    return ok(id,{content:[{type:'text',text:'Unable to safely list records.'}],isError:true});
  }
}
module.exports={dispatch,tools,dateValid,allowOwner};
