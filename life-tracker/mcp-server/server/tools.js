import {createRepository} from './repository.js';
import {CREATE_SCOPE,READ_SCOPE,PROPOSE_SCOPE} from './config.js';
const empty={type:'object',properties:{},additionalProperties:false};
export const TOOL_DEFS=[
 {name:'mosaic_list_categories',description:'List up to 20 of my active Mosaic categories.',
   inputSchema:empty},
 {name:'mosaic_search_tasks',description:'Search my Mosaic tasks by exact date, category or completed status. Results are capped to 20.',
   inputSchema:{type:'object',properties:{
     date:{type:'string',description:'Local YYYY-MM-DD date, or empty for Backlogs'},
     categoryId:{type:'string'},completed:{type:'boolean'},titleContains:{type:'string'}
   },additionalProperties:false}},
 {name:'mosaic_create_task',description:'Create exactly one private task I explicitly confirmed in my existing category. Requires tasks.create permission.',
   inputSchema:{type:'object',required:['title','categoryId','date','idempotencyKey','confirm'],
     properties:{title:{type:'string'},categoryId:{type:'string'},
       date:{type:'string'},idempotencyKey:{type:'string'},
       confirm:{type:'boolean',description:'Must be true after user confirmation'}},
     additionalProperties:false}},
 {name:'mosaic_propose_bulk_command',description:'Preview a bulk task command for review inside Mosaic. This does NOT execute changes.',
   inputSchema:{type:'object',required:['command'],properties:{
     command:{type:'string'}},additionalProperties:false}},
];
export const requiredScope=name=>{
 if(name==='mosaic_create_task')return CREATE_SCOPE;
 if(name==='mosaic_propose_bulk_command')return PROPOSE_SCOPE;
 return READ_SCOPE;
};
export function isValidDate(value,allowBacklogs=true) {
 if(value===''&&allowBacklogs)return true;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function exactObject(input,allowed) {
 return !!input && typeof input==='object' && !Array.isArray(input) &&
   Object.keys(input).every(k=>allowed.includes(k));
}
function uniqueCategory(categories,name) {
 const matches=categories.filter(c=>c.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase());
 if(matches.length!==1)throw Error('Source category missing or ambiguous');
 return matches[0];
}
export function proposal(input,allCategories,tasks){
 const trimmed=input.trim().replace(/\s+/g,' ');
 const m=/^move all (?:uncompleted |unfinished |completed )?tasks from (.+?) to (.+)$|^complete all (?:uncompleted |unfinished )?tasks in (.+)$|^reschedule all (?:uncompleted |unfinished )?tasks in (.+?) to (\d{4}-\d{2}-\d{2}|tomorrow)$|^delete all tasks in (.+)$/i.exec(trimmed);
 if(!m)throw Error('Unsupported bulk command; no changes performed');
 const source=m[1]??m[3]??m[4]??m[6];
 const category=uniqueCategory(allCategories,source);
 const found=tasks.filter(t=>t.category_id===category.$id);
 if(found.length>20)throw Error('Bulk proposal exceeds 20 tasks; refine the request');
 return {command:trimmed,category:category.name,taskCount:found.length,
   matched:found.map(t=>({id:t.$id,title:t.title,date:t.date,
     completed:t.is_completed===true})),execution:'NOT_EXECUTED',
   next:'Open Mosaic Home > Commands, enter this exact command, review selected tasks and confirm explicitly.'};
}
export async function callTool(name,args,owner,env=process.env,repositoryFactory=createRepository){
 if(!TOOL_DEFS.some(t=>t.name===name))throw Error('Unknown tool');
 const repo=repositoryFactory(owner,env);
 if(name==='mosaic_list_categories'){
   if(!exactObject(args,[]))throw Error('Unexpected tool arguments');
   const categories=(await repo.categories()).rows;
   return categories.map(c=>({id:c.$id,name:c.name,color:c.color}));
 }
 if(name==='mosaic_search_tasks'){
   if(!exactObject(args,['date','categoryId','completed','titleContains']))throw Error('Unexpected task filters');
   if(args.date!==undefined&&!isValidDate(args.date))throw Error('Invalid date');
   if(args.categoryId!==undefined&&
     (typeof args.categoryId!=='string'||args.categoryId.length>36))throw Error('Invalid category');
   if(args.completed!==undefined&&typeof args.completed!=='boolean')throw Error('Invalid completion');
   if(args.titleContains!==undefined&&
     (typeof args.titleContains!=='string'||args.titleContains.length>70))throw Error('Invalid title filter');
   const {rows,total}=await repo.tasks(args);
   const results=rows.filter(t=>!args.titleContains||
     String(t.title).toLocaleLowerCase().includes(args.titleContains.toLocaleLowerCase()));
   return {tasks:results.slice(0,20).map(t=>({id:t.$id,title:t.title,date:t.date,
       categoryId:t.category_id,completed:t.is_completed===true})),
     totalMatchingPage:results.length,partial:total>rows.length||results.length>20};
 }
 if(name==='mosaic_create_task'){
   if(env.MOSAIC_MCP_ALLOW_WRITES!=='true')throw Error('External create is disabled');
   if(!exactObject(args,['title','categoryId','date','idempotencyKey','confirm'])||
     args.confirm!==true||typeof args.title!=='string'||!args.title.trim()||
     args.title.trim().length>255||typeof args.categoryId!=='string'||
     !/^[a-zA-Z0-9_]{1,36}$/.test(args.categoryId)||
     !isValidDate(args.date)||typeof args.idempotencyKey!=='string'||
     !/^[A-Za-z0-9_-]{12,64}$/.test(args.idempotencyKey))
     throw Error('Creation requires one valid, explicitly confirmed task');
   return await repo.createTask({...args,title:args.title.trim()});
 }
 if(!exactObject(args,['command'])||typeof args.command!=='string'||args.command.length>240)
   throw Error('Invalid bulk command');
 const [categories,tasks]=await Promise.all([repo.categories(),repo.tasks()]);
 if(tasks.total>100)throw Error('Selection not complete; review inside Mosaic');
 return proposal(args.command,categories.rows,tasks.rows);
}
