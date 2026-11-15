import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertReviewedScratchDrift } from '../prepare-e2ee-scratch.mjs';

const DR = 'function message-action variable DR_PRIVACY_DELETION_REQUIRED: expected "false", got "true"';
const MEDIA = 'table media_uploads.reference_epoch: unexpected column';
const TASKS = 'table tasks permissions differ';
const CATEGORIES = 'table categories permissions differ';

function requestWith({
  tasks=[],categories=[],column={key:'reference_epoch',type:'integer',required:false,default:0,min:0,status:'available'},
  dr={key:'DR_PRIVACY_DELETION_REQUIRED',value:'true',secret:false},
}={}) {
  return async (method,path)=>{
    assert.equal(method,'GET');
    if(path.endsWith('/media_uploads')) return {columns:[column]};
    if(path.endsWith('/tasks')) return {$permissions:tasks};
    if(path.endsWith('/categories')) return {$permissions:categories};
    if(path.endsWith('/6aa8057f002a4c306fdd')) return {vars:[dr]};
    throw Error('Unexpected admin request '+path);
  };
}

test('allows only read-back-verified, strictly less permissive Scratch drift',async()=>{
  await assertReviewedScratchDrift({
    request:requestWith(),diffs:[DR,MEDIA,TASKS,CATEGORIES],
  });
});

test('retains exact expected pilot missing resources only before migration',async()=>{
  await assertReviewedScratchDrift({
    request:requestWith(),
    diffs:['table private_diary_ciphertexts: missing'],
    allowedMissing:['table private_diary_ciphertexts: missing'],
  });
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith(),
    diffs:['table private_diary_ciphertexts: missing'],
  }),/Unreviewed Scratch drift/);
});

test('rejects all unrelated structural and ACL drift',async()=>{
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith(),
    diffs:['table diary permissions differ'],
  }),/Unreviewed Scratch drift/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({tasks:['read("any")']}),
    diffs:[TASKS],
  }),/only stricter/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({categories:['create("any")']}),
    diffs:[CATEGORIES],
  }),/only stricter/);
});

test('rejects incompatible extra columns and unknown metadata',async()=>{
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:true}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:false,default:1}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'varchar',required:false,default:0}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:false,default:0,min:-1}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
  await assert.rejects(()=>assertReviewedScratchDrift({
    request:requestWith({column:{key:'reference_epoch',type:'integer',required:false,default:0,status:'processing'}}),
    diffs:[MEDIA],
  }),/reference_epoch contract/);
});

test('requires proof that the privacy-deletion fence remains enabled',async()=>{
  for(const dr of [
    {key:'DR_PRIVACY_DELETION_REQUIRED',value:'false',secret:false},
    {key:'DR_PRIVACY_DELETION_REQUIRED',value:'true',secret:true},
    {key:'OTHER',value:'true',secret:false},
  ]){
    await assert.rejects(()=>assertReviewedScratchDrift({
      request:requestWith({dr}),diffs:[DR],
    }),/privacy deletion flag/);
  }
});
