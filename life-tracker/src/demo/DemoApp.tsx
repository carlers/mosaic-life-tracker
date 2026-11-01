import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addMonths, format } from 'date-fns';
import { MonthView } from '../components/home/views/MonthView';
import { TaskItem } from '../components/home/views/TaskItem';
import { getDemoDatabase, newDemoTask, resetDemo, type DemoDatabase } from './data';
import { DEMO_OWNER } from './fixtures';
import type { CategoryDocument, TaskDocument } from '../db/schema';
import './demo.css';

const key=(d:Date)=>format(d,'yyyy-MM-dd');
type Section='calendar'|'backlog'|'categories';

export function DemoApp() {
  const [db,setDb]=useState<DemoDatabase|null>(null);
  const [categories,setCategories]=useState<CategoryDocument[]>([]);
  const [tasks,setTasks]=useState<TaskDocument[]>([]);
  const [date,setDate]=useState(()=>new Date());
  const [section,setSection]=useState<Section>('calendar');
  const [showDay,setShowDay]=useState(false);
  const [error,setError]=useState('');
  const [newTitle,setNewTitle]=useState('');
  const [newCategoryId,setNewCategoryId]=useState('');
  const [newCategoryName,setNewCategoryName]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [editingTitle,setEditingTitle]=useState('');
  const [resetting,setResetting]=useState(false);
  const dragStart=useRef<{x:number,y:number}|null>(null);
  useEffect(()=>{
    let live=true;
    const unsubscribe:Array<()=>void>=[];
    void getDemoDatabase().then(d=>{
      if(!live)return;
      setDb(d);
      const a=d.tasks.find({selector:{userId:DEMO_OWNER,isDeleted:false}}).$.subscribe(rows=>{if(live)setTasks(rows.map(r=>r.toJSON()));});
      const b=d.categories.find({selector:{userId:DEMO_OWNER,isDeleted:false}}).$.subscribe(rows=>{if(live)setCategories(rows.map(r=>r.toJSON()));});
      unsubscribe.push(()=>a.unsubscribe(),()=>b.unsubscribe());
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Browser-local storage unavailable');});
    return()=>{live=false;unsubscribe.forEach(fn=>fn());};
  },[]);
  const sortedCategories=useMemo(()=>[...categories].sort((a,b)=>a.order-b.order),[categories]);
  const categoryMap=useMemo(()=>Object.fromEntries(sortedCategories.map(c=>[c.id,{name:c.name,color:c.color}])),[sortedCategories]);
  const byDate=useMemo(()=>{
    const map=new Map<string,TaskDocument[]>();
    for(const t of tasks){const items=map.get(t.date)||[];items.push(t);map.set(t.date,items);}
    return map;
  },[tasks]);
  const displayed=useMemo(()=>tasks.filter(t=>t.date===(section==='backlog'?'':key(date))).sort((a,b)=>Number(a.completed)-Number(b.completed)||a.order-b.order),[tasks,date,section]);
  const update=useCallback(async (fn:(d:DemoDatabase)=>Promise<unknown>)=>{
    if(!db)return;
    try{setError('');await fn(db);}catch(e){setError(e instanceof Error?e.message:'Demo update failed');}
  },[db]);
  const changeTask=useCallback((id:string,change:Partial<TaskDocument>)=>{
    void update(async d=>{
      const doc=await d.tasks.findOne(id).exec();
      if(doc && doc.userId===DEMO_OWNER)await doc.patch({...change,updatedAt:new Date().toISOString()});
    });
  },[update]);
  const startEdit=(t:TaskDocument)=>{setEditing(t.id);setEditingTitle(t.title);};
  const saveEdit=()=>{if(editing && editingTitle.trim())changeTask(editing,{title:editingTitle.trim()});setEditing(null);};
  const addTask=()=>{
    const title=newTitle.trim(),categoryId=newCategoryId||sortedCategories[0]?.id;
    if(!title||!categoryId)return;
    void update(async d=>{await d.tasks.insert(newDemoTask(title,section==='backlog'?'':key(date),categoryId,tasks.length));setNewTitle('');});
  };
  const addCategory=()=>{
    if(!newCategoryName.trim())return;
    void update(async d=>{
      await d.categories.insert({
        id:'demo_category_'+crypto.randomUUID().replaceAll('-',''),
        userId:DEMO_OWNER,isDeleted:false,visibility:'private',retiredOn:'',
        name:newCategoryName.trim().slice(0,100),color:'#10b981',order:categories.length,updatedAt:new Date().toISOString(),
      });
      setNewCategoryName('');
    });
  };
  const moveCategory=(item:CategoryDocument,direction:number)=>{
    const i=sortedCategories.findIndex(c=>c.id===item.id),other=sortedCategories[i+direction];
    if(!other)return;
    void update(async d=>{
      const a=await d.categories.findOne(item.id).exec();
      const b=await d.categories.findOne(other.id).exec();
      if(!a||!b)return;
      await a.patch({order:999999});
      await b.patch({order:item.order});
      await a.patch({order:other.order});
    });
  };
  const reset=async()=>{
    if(!db||!window.confirm('Reset this demo? Only your fictional demo changes will be discarded.'))return;
    setResetting(true);
    try {await resetDemo(db);setDate(new Date());setSection('calendar');setShowDay(false);setError('');}
    catch(e){setError(e instanceof Error?e.message:'Reset failed');}
    finally{setResetting(false);}
  };
  const dayNav=(n:number)=>setDate(d=>addDays(d,n));
  const taskList=(rows:TaskDocument[])=>rows.map(t=>(
    <div key={t.id} className="demo-task-entry">
      <TaskItem task={t} categoryColor={categoryMap[t.categoryId]?.color||'#777'} currentUserId={DEMO_OWNER}
        onToggle={()=>changeTask(t.id,{completed:!t.completed,completedAt:!t.completed?new Date().toISOString():''})}
        onOpenActions={()=>startEdit(t)} onOpenMemo={()=>startEdit(t)}
        onEditStart={()=>startEdit(t)} isEditing={editing===t.id}
        editValue={editingTitle} onEditChange={setEditingTitle} onEditSave={saveEdit}
        onEditCancel={()=>setEditing(null)} />
      <div className="demo-task-actions">
        <button onClick={()=>startEdit(t)}>Edit</button>
        <select value={t.categoryId} aria-label={'Move category for '+t.title} onChange={e=>changeTask(t.id,{categoryId:e.target.value})}>
          {sortedCategories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
        <input type="date" aria-label={'Move date for '+t.title} value={t.date}
          onChange={e=>changeTask(t.id,{date:e.target.value})}/>
        <button aria-label={'Delete '+t.title} onClick={()=>changeTask(t.id,{isDeleted:true})}>Delete</button>
      </div>
    </div>
  ));
  return (
    <div className="mosaic-demo">
      <div className="demo-banner" role="note">
        <span><strong>Mosaic · Live demo</strong> — fictional sample data, stored only in this browser, not synced.</span>
        <div><button disabled={!db||resetting} onClick={()=>void reset()}>Reset demo</button><a href="https://mosaic-life-tracker.vercel.app/" target="_blank" rel="noopener noreferrer">Open real Mosaic</a></div>
      </div>
      {error&&<p className="demo-error" role="alert">{error}</p>}
      <div className="demo-app-frame">
        <header className="demo-header"><strong><img src="/apple-touch-icon.png" alt="" width="28" height="28"/> Mosaic</strong><span>Demo account</span></header>
        {!db&&!error&&<p role="status" className="demo-status">Loading browser-local sample data…</p>}
        <main className="demo-content">
          {section==='calendar'&&!showDay&&<>
            <div className="demo-calendar-toolbar">
              <button onClick={()=>setDate(d=>addMonths(d,-1))} aria-label="Previous month">‹</button>
              <button className="demo-month-label" onClick={()=>setDate(new Date())} aria-label="Go to current month">{format(date,'MMMM yyyy')}</button>
              <button onClick={()=>setDate(d=>addMonths(d,1))} aria-label="Next month">›</button>
            </div>
            <div className="demo-month">
              <MonthView focusDate={date} tasksByDate={byDate} categoriesMap={categoryMap}
                onDayClick={d=>{setDate(d);setShowDay(true);}} keyboardActive/>
            </div>
            <p className="demo-hint">Select any date to open its Day View and edit the tasks.</p>
          </>}
          {section==='calendar'&&showDay&&<>
            <div className="demo-day-header">
              <button onClick={()=>setShowDay(false)} aria-label="Back to calendar">‹ Calendar</button>
              <span><button onClick={()=>dayNav(-1)} aria-label="Previous day">‹</button>
                <button onClick={()=>setDate(new Date())} aria-label="Go to today">{format(date,'EEE, MMM d')}</button>
                <button onClick={()=>dayNav(1)} aria-label="Next day">›</button></span>
            </div>
            <div className="demo-day-area" onTouchStart={e=>{dragStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
              onTouchEnd={e=>{const v=dragStart.current;dragStart.current=null;if(!v)return;const dx=e.changedTouches[0].clientX-v.x,dy=e.changedTouches[0].clientY-v.y;if(Math.abs(dx)>70&&Math.abs(dx)>1.5*Math.abs(dy))dayNav(dx<0?1:-1);}}>
              <h2>Day View <small>{displayed.filter(t=>t.completed).length}/{displayed.length} complete</small></h2>
              {sortedCategories.map(c=><section className="demo-category" key={c.id}>
                <h3><span style={{background:c.color}}/>{c.name}</h3>
                {taskList(displayed.filter(t=>t.categoryId===c.id))}
              </section>)}
              <div className="demo-create">
                <input value={newTitle} aria-label="New task" placeholder="Add a demo task…" onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addTask();}}/>
                <select value={newCategoryId||sortedCategories[0]?.id||''} aria-label="New task category" onChange={e=>setNewCategoryId(e.target.value)}>
                  {sortedCategories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
                </select>
                <button disabled={!db||!newTitle.trim()} onClick={addTask}>Add</button>
              </div>
            </div>
          </>}
          {section==='backlog'&&<div className="demo-page">
            <h2>Backlog</h2><p>Tasks without a scheduled date</p>
            {taskList(displayed)}
            <div className="demo-create">
              <input aria-label="New backlog task" value={newTitle} placeholder="Add an undated task…" onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addTask();}}/>
              <select aria-label="Backlog category" value={newCategoryId||sortedCategories[0]?.id||''} onChange={e=>setNewCategoryId(e.target.value)}>
                {sortedCategories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
              </select>
              <button disabled={!newTitle.trim()||!db} onClick={addTask}>Add</button>
            </div>
          </div>}
          {section==='categories'&&<div className="demo-page">
            <h2>Manage categories</h2><p>Edit sample categories. Changes stay on this device.</p>
            {sortedCategories.map((c,i)=><div key={c.id} className="demo-category-row">
              <input type="color" value={c.color} aria-label={'Color for '+c.name} onChange={e=>void update(async d=>{await (await d.categories.findOne(c.id).exec())?.patch({color:e.target.value});})}/>
              <input value={c.name} aria-label={'Name of '+c.name} onChange={e=>void update(async d=>{await (await d.categories.findOne(c.id).exec())?.patch({name:e.target.value.slice(0,100)});})}/>
              <button disabled={i===0} onClick={()=>moveCategory(c,-1)} aria-label={'Move '+c.name+' up'}>↑</button>
              <button disabled={i===sortedCategories.length-1} onClick={()=>moveCategory(c,1)} aria-label={'Move '+c.name+' down'}>↓</button>
            </div>)}
            <div className="demo-create">
              <input value={newCategoryName} aria-label="New category name" placeholder="New category…" onChange={e=>setNewCategoryName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addCategory();}}/>
              <button disabled={!db||!newCategoryName.trim()} onClick={addCategory}>Add category</button>
            </div>
          </div>}
        </main>
        <nav className="demo-nav" aria-label="Demo navigation">
          <button className={section==='calendar'?'active':''} onClick={()=>{setSection('calendar');setShowDay(false);}}>Calendar</button>
          <button className={section==='backlog'?'active':''} onClick={()=>setSection('backlog')}>Backlog</button>
          <button className={section==='categories'?'active':''} onClick={()=>setSection('categories')}>Categories</button>
        </nav>
      </div>
    </div>
  );
}
