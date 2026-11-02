import React, { useState } from 'react';
import { recordTourOutcome, tourKey } from '../lib/tourProgress';
import type { TourStep } from '../components/onboarding/TourPlayer';
const TourPlayer = React.lazy(() => import('../components/onboarding/TourPlayer').then(m => ({ default: m.TourPlayer })));
const demoSteps: TourStep[] = [
 { title: 'Explore the calendar', detail: 'All tasks here are fictional and stored only in this browser.', instruction: 'Try this: tap the highlighted calendar arrow to change months.', target: 'calendar' },
 { title: 'Open a day', detail: 'Each date opens Day View with sample tasks you can explore.', instruction: 'Try this: tap the highlighted day. We’ll continue when Day View opens.', target: 'date' },
 { title: 'Try a sample task', detail: 'Explore or edit any fictional task. Nothing here affects a real Mosaic account.', instruction: 'Try this: inspect the open Day View. You can continue without editing anything.', target: 'dayview' },
 { title: 'Explore Backlogs', detail: 'Backlogs keeps tasks that have not been assigned a date.', instruction: 'Try this: tap the highlighted menu icon and find Backlogs.', target: 'menu' },
 { title: 'Start fresh whenever you like', detail: 'Use Reset to restore the fictional tasks. Your changes stay in this browser.', instruction: 'You can replay this tour using Take tour, or tap Done and explore freely.', target: undefined },
];
import { resetDemoDatabase } from './runtimeDatabase';
export function DemoOverlay(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [showTour,setShowTour]=useState(() => new URLSearchParams(window.location.search).get('tour') === '1');
 const tourStorageKey=tourKey('demo',true);
 const reset=async()=>{
  if(!window.confirm('Reset only the fictional data in this Mosaic demo?'))return;
  setBusy(true);setError('');
  try{await resetDemoDatabase();window.location.assign('/demo/home');}
  catch(e){setError(e instanceof Error?e.message:'Local reset failed');setBusy(false);}
 };
 return <><div data-mosaic-demo="true" className="mosaic-public-demo-label" role="note">
 <span>DEMO · Fictional browser-only data</span>
 <button type="button" onClick={()=>setShowTour(true)}>Take tour</button>
 <button type="button" disabled={busy} onClick={()=>void reset()}>Reset</button>
 {error&&<span role="alert">{error}</span>}</div>
 {showTour&&<React.Suspense fallback={null}><TourPlayer steps={demoSteps} onFinish={outcome => {
   recordTourOutcome(tourStorageKey,outcome);
   setShowTour(false);
 }} /></React.Suspense>}</>;
}
