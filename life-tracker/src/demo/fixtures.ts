import { addDays, format, startOfDay } from 'date-fns';
import type { TaskDocument, CategoryDocument } from '../db/schema';

export const DEMO_OWNER = 'mosaic_demo_local';
export const DEMO_DB_NAME = 'mosaic_public_demo_v1';
export const CATEGORY_SAMPLES = [
  {id:'demo_school',name:'School',color:'#8b5cf6'},
  {id:'demo_projects',name:'Projects',color:'#10b981'},
  {id:'demo_personal',name:'Personal',color:'#f59e0b'},
  {id:'demo_fitness',name:'Fitness',color:'#3b82f6'},
] as const;
const TITLES: readonly [number,number,string,boolean][] = [
  [-10,0,'Complete the physics exercises',true],
  [-8,1,'Draft a project roadmap',true],
  [-7,3,'Morning workout',true],
  [-6,2,'Tidy up the workspace',true],
  [-5,0,'Review lecture notes',true],
  [-4,1,'Review the app interface',true],
  [-3,3,'Track a weekend run',true],
  [-2,0,'Revise digital circuits',false],
  [-2,2,'Plan meals for the week',true],
  [-1,1,'Fix a small layout issue',true],
  [0,0,'Study for the upcoming quiz',false],
  [0,0,'Review the lecture outline',true],
  [0,1,'Build a landing page demo',false],
  [0,1,'Check project milestones',false],
  [0,2,'Buy groceries',false],
  [0,3,'Evening walk',false],
  [1,0,'Finish laboratory exercises',false],
  [1,1,'Write UI tests',false],
  [1,2,'Call a friend',false],
  [2,3,'Try a new exercise',false],
  [3,0,'Prepare a group presentation',false],
  [3,1,'Review design ideas',false],
  [4,2,'Organize study notes',false],
  [5,3,'Long walk outside',false],
  [6,0,'Start the next module',false],
  [7,1,'Explore a new project',false],
  [9,2,'Read a chapter',false],
  [10,3,'Plan next week’s activity',false],
  [11,1,'Plan the next sprint',false],
  [0,2,'Record a future idea',false],
];
export function makeDemoFixtures(anchor:Date) {
  const date=startOfDay(anchor);
  const now=date.toISOString();
  const categories:CategoryDocument[]=CATEGORY_SAMPLES.map((item,order)=>({
    ...item,order,userId:DEMO_OWNER,isDeleted:false,visibility:'private',retiredOn:'',updatedAt:now,
  }));
  const tasks:TaskDocument[]=TITLES.map(([offset,group,title,completed],index)=>({
    id:'demo_seed_task_'+index,userId:DEMO_OWNER,title,completed,
    categoryId:CATEGORY_SAMPLES[group].id,
    date:index===TITLES.length-1?'':format(addDays(date,offset),'yyyy-MM-dd'),
    order:index,visibility:'private',isDeleted:false,createdAt:now,updatedAt:now,completedAt:completed?now:'',
  }));
  return {tasks,categories};
}
