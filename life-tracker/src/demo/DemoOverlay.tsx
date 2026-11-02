import { useState } from 'react';
import { resetDemoDatabase } from './runtimeDatabase';
export function DemoOverlay(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const reset=async()=>{
  if(!window.confirm('Reset only the fictional data in this Mosaic demo?'))return;
  setBusy(true);setError('');
  try{await resetDemoDatabase();window.location.assign('/demo/home');}
  catch(e){setError(e instanceof Error?e.message:'Local reset failed');setBusy(false);}
 };
 return <div data-mosaic-demo="true" className="mosaic-public-demo-label" role="note">
 <span>DEMO · Fictional browser-only data</span>
 <button type="button" disabled={busy} onClick={()=>void reset()}>Reset</button>
 {error&&<span role="alert">{error}</span>}</div>;
}
