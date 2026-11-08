import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlan,fingerprint,publicSnapshot,runTool,requiredScope} from '../server/tools.js';
const defaultState=()=>({
 id:'PVT_pilot',title:'Mosaic — Integrations & Plugins',public:false,
 fields:[{__typename:'ProjectV2SingleSelectField',id:'field-status',name:'Status',
   options:[{id:'todo-id',name:'Todo',color:'GREEN',description:'New'},
     {id:'progress-id',name:'In Progress',color:'YELLOW',description:''},
     {id:'done-id',name:'Done',color:'PURPLE',description:''}]}],
 items:[{id:'item-1',content:{number:1651,repository:{nameWithOwner:'carlers/mosaic-life-tracker'}},
   fieldValues:{nodes:[{__typename:'ProjectV2ItemFieldSingleSelectValue',field:{name:'Status'},optionId:'todo-id',name:'Todo'}]}}],
 workflows:[{id:'wf1',name:'Auto-close issue',enabled:true}]
});
test('dry-run preserves existing option IDs and never performs writes',()=>{
 const state=defaultState();const before=JSON.stringify(state);
 const plan=createPlan(state);
 assert.equal(plan.operations.length,4);
 const status=plan.operations.find(o=>o.name==='Status');
 assert.equal(status.method,'update');
 assert.equal(status.options.find(x=>x.name==='Backlog').id,'todo-id');
 assert.equal(status.options.find(x=>x.name==='Done').id,'done-id');
 assert.equal(plan.workflows[0].enabled,true);
 assert.equal(JSON.stringify(state),before);
 assert.equal(publicSnapshot(state).items[0].status,'Todo');
});
test('invalid state with duplicate Todo and Backlog refuses mutation',()=>{
 const state=defaultState();
 state.fields[0].options.push({id:'backlog-id',name:'Backlog',color:'GRAY',description:''});
 assert.throws(()=>createPlan(state));
});
test('apply requires exact fingerprint and confirmation',async()=>{
 const state=defaultState();let count=0;
 const deps={snapshot:async()=>state,graphql:async()=>{count++;}};
 await assert.rejects(runTool('apply_project_fields',{confirm:true,expected_fingerprint:'0'.repeat(64)},'mock',deps));
 await assert.rejects(runTool('apply_project_fields',{confirm:false,expected_fingerprint:fingerprint(state)},'mock',deps));
 assert.equal(count,0);
});
test('apply refuses concurrent field modifications',async()=>{
 const state=defaultState();const initial=fingerprint(state);let calls=0;
 const deps={snapshot:async()=>state,graphql:async()=>{calls++;}};
 // concurrent rename after the initial snapshot, before the revalidation read
 let reads=0;
 deps.snapshot=async()=>{reads++;if(reads===2)state.fields[0].options[0].name='Changed';return state;};
 await assert.rejects(runTool('apply_project_fields',{confirm:true,expected_fingerprint:initial},'mock',deps));
 assert.equal(calls,0);
});
test('no project mutation tool can change workflow enablement or source issue',()=>{
 const plan=createPlan(defaultState());
 assert.deepEqual(plan.operations.map(x=>x.name),['Status','Work type','Delivery stage','Blocked']);
 assert.equal(requiredScope('apply_project_fields'),'projects.write');
 assert.equal(requiredScope('inspect_project_config'),'projects.read');
});
