import {createHash} from 'node:crypto';
import {OWNER,PROJECT,READ_SCOPE,WRITE_SCOPE} from './config.js';
import {snapshot,graphql,CREATE_FIELD,UPDATE_FIELD} from './github.js';
const STATUS = ['Backlog','Planned','Approved','In Progress','Verification','Done'];
const CONFIG = [
  {name:'Work type',values:['Feature','Bug','Research','Infrastructure','Documentation']},
  {name:'Delivery stage',values:['Not started','Task branch','Preview','Dev','Production','N/A']},
  {name:'Blocked',values:['No','Yes']}
];
const COLORS = {Backlog:'GRAY',Planned:'BLUE',Approved:'GREEN','In Progress':'YELLOW',
  Verification:'PURPLE',Done:'GREEN',Feature:'BLUE',Bug:'RED',Research:'PURPLE',
  Infrastructure:'ORANGE',Documentation:'GRAY','Not started':'GRAY',
  'Task branch':'BLUE',Preview:'PURPLE',Dev:'YELLOW',Production:'GREEN','N/A':'GRAY',No:'GREEN',Yes:'RED'};
const stringKey = (name) => name.toLowerCase();
const makeNew = (name) => ({name,color:COLORS[name]??'GRAY',description:''});
export const fingerprint = state => createHash('sha256').update(JSON.stringify({
  id:state.id,
  fields:state.fields.map(f=>({id:f.id,name:f.name,type:f.__typename,
    options:f.options?.map(o=>({id:o.id,name:o.name,color:o.color,description:o.description}))})),
  items:state.items.map(x=>({id:x.id,number:x.content?.number,repo:x.content?.repository?.nameWithOwner,
    fields:x.fieldValues?.nodes?.map(v=>({type:v.__typename,optionId:v.optionId,name:v.name}))})),
  workflows:state.workflows.map(x=>({id:x.id,name:x.name,enabled:x.enabled}))
})).digest('hex');
function fieldByName(state,name) {
  return state.fields.find(f=>stringKey(f.name)===stringKey(name));
}
function mergeOptions(field,desired,renameTodo=false) {
  if (field && field.__typename!=='ProjectV2SingleSelectField') throw Error('Conflicting field type');
  const existing = (field?.options??[]).map(o=>({
    id:o.id,name:(renameTodo && o.name==='Todo')?'Backlog':o.name,
    color:o.color,description:o.description??''
  }));
  const found = new Set(existing.map(x=>x.name));
  const additions = desired.filter(x=>!found.has(x)).map(makeNew);
  const pool = [...existing,...additions];\n  const output = [...desired.map(name=>pool.find(x=>x.name===name)).filter(Boolean),\n    ...pool.filter(x=>!desired.includes(x.name))];
  if (new Set(output.map(x=>x.name)).size !== output.length) throw Error('Duplicate option after rename');
  return output;
}
export function createPlan(state) {
  const status=fieldByName(state,'Status');
  if (!status || status.__typename!=='ProjectV2SingleSelectField') throw Error('Missing Status select field');
  if (status.options.some(o=>o.name==='Todo') && status.options.some(o=>o.name==='Backlog'))
    throw Error('Ambiguous Todo and Backlog options');
  const ops=[];
  for (const spec of [{name:'Status',values:STATUS,renameTodo:true},...CONFIG]) {
    const field=fieldByName(state,spec.name);
    const after=mergeOptions(field,spec.values,!!spec.renameTodo);
    if (!field) {
      ops.push({method:'create',name:spec.name,options:after});
    } else {
      const before=(field.options??[]).map(o=>({id:o.id,name:o.name,color:o.color,description:o.description??''}));
      if (JSON.stringify(before)!==JSON.stringify(after))
        ops.push({method:'update',name:spec.name,fieldId:field.id,before,options:after});
    }
  }
  return {owner:OWNER,project_number:PROJECT,expected_fingerprint:fingerprint(state),
    operations:ops,workflows:state.workflows.map(x=>({name:x.name,enabled:x.enabled})),
    items_count:state.items.length,
    warning:'Built-in GitHub workflows are read-only; no workflow toggle, issue close, or Done mutation will occur.'};
}
export function publicSnapshot(state) {
  const status=fieldByName(state,'Status');
  return {owner:OWNER,project_number:PROJECT,title:state.title,public:state.public,
    fingerprint:fingerprint(state),
    fields:state.fields.map(f=>({name:f.name,type:f.__typename,
      options:f.options?.map(o=>({name:o.name,id:o.id}))})),
    workflows:state.workflows.map(x=>({name:x.name,enabled:x.enabled})),
    items:state.items.map(x=>({number:x.content?.number,
      repo:x.content?.repository?.nameWithOwner,
      status:(x.fieldValues?.nodes??[]).find(f=>f.field?.name==='Status')?.name??null})),
    warning:'Workflow settings are audited, not changed.'};
}
export const TOOL_DEFS = [
 {name:'inspect_project_config',description:'Read the private carlers/1 project fields, items and workflow enablement. Never changes settings.',
  inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'plan_project_config',description:'Preview an allowlisted field and Status-options configuration diff. Does not write.',
  inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'apply_project_fields',description:'Apply only the pre-reviewed field configuration, preserving option IDs and items. Never edits GitHub workflows or issues.',
  inputSchema:{type:'object',properties:{expected_fingerprint:{type:'string',pattern:'^[a-f0-9]{64}$'},confirm:{type:'boolean'}},
    required:['expected_fingerprint','confirm'],additionalProperties:false}},
 {name:'verify_project_config',description:'Read back field and item state after configuration; no writes.',
  inputSchema:{type:'object',properties:{},additionalProperties:false}}
];
export const requiredScope=name=>name==='apply_project_fields'?WRITE_SCOPE:READ_SCOPE;
export async function runTool(name,args,token,deps={snapshot,graphql}) {
  if (!TOOL_DEFS.some(t=>t.name===name)) throw Error('Tool unavailable');
  const current=await deps.snapshot(token);
  if (name==='inspect_project_config' || name==='verify_project_config')
    return publicSnapshot(current);
  const plan=createPlan(current);
  if (name==='plan_project_config') return plan;
  if (args?.confirm!==true || !/^[a-f0-9]{64}$/.test(args?.expected_fingerprint??'') ||
      args.expected_fingerprint!==plan.expected_fingerprint)
    throw Error('Plan fingerprint changed or explicit confirmation missing');
  const originalItems=current.items.map(x=>({id:x.id,number:x.content?.number,repo:x.content?.repository?.nameWithOwner,
    statusOptionId:(x.fieldValues?.nodes??[]).find(v=>v.field?.name==='Status')?.optionId})).sort((a,b)=>a.id.localeCompare(b.id));
  const operations=[];
  for (const operation of plan.operations) {
    const fresh=await deps.snapshot(token);
    const target=fieldByName(fresh,operation.name);
    if (operation.method==='create') {
      if (target) throw Error('Concurrent field creation; stopped');
      await deps.graphql(token,CREATE_FIELD,{input:{
        projectId:fresh.id,name:operation.name,dataType:'SINGLE_SELECT',
        singleSelectOptions:operation.options.map(x=>({name:x.name,color:x.color,description:x.description}))
      }});
    } else {
      if (!target || target.id!==operation.fieldId ||
          JSON.stringify(target.options?.map(o=>({id:o.id,name:o.name,color:o.color,description:o.description??''})))!==
          JSON.stringify(operation.before)) throw Error('Concurrent option change; stopped');
      await deps.graphql(token,UPDATE_FIELD,{input:{
        fieldId:operation.fieldId,
        singleSelectOptions:operation.options.map(x=>({...(x.id?{id:x.id}:{}),name:x.name,
          color:x.color,description:x.description}))
      }});
    }
    operations.push({method:operation.method,field:operation.name});
  }
  const after=await deps.snapshot(token);
  const finalItems=after.items.map(x=>({id:x.id,number:x.content?.number,repo:x.content?.repository?.nameWithOwner,
    statusOptionId:(x.fieldValues?.nodes??[]).find(v=>v.field?.name==='Status')?.optionId})).sort((a,b)=>a.id.localeCompare(b.id));
  if (JSON.stringify(finalItems)!==JSON.stringify(originalItems))
    throw Error('Post-write project items or Status option identities changed: review required');
  if (createPlan(after).operations.length) throw Error('Post-write fields differ from requested configuration');
  return {applied:operations,verified_items:after.items.length,verified_fingerprint:fingerprint(after),
    workflows:after.workflows.map(x=>({name:x.name,enabled:x.enabled})),
    warning:'Workflow toggles are unavailable; check separately before changing Done or source issue state.'};
}
