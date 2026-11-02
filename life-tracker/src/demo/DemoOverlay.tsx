import React, { useState } from 'react';
import { recordTourOutcome, tourKey } from '../lib/tourProgress';
import type { TourStep } from '../components/onboarding/TourPlayer';
const TourPlayer = React.lazy(() => import('../components/onboarding/TourPlayer').then(m => ({ default: m.TourPlayer })));
const demoSteps: TourStep[] = [
 { title: 'Explore the calendar', detail: 'These are fictional tasks. Change months or select a date to explore how Mosaic works.', target: 'calendar' },
 { title: 'Open a day', detail: 'Tap a date to open Day View, then inspect the sample tasks for that day.', target: 'calendar' },
 { title: 'Try a sample task', detail: 'Complete, edit or add fictional tasks. Changes are stored only in this browser and can be reset.', target: 'dayview' },
 { title: 'Explore Backlogs', detail: 'Open the menu to find tasks that are not yet scheduled.', target: 'menu' },
 { title: 'Start fresh whenever you like', detail: 'Use Reset to restore the sample data. To use Mosaic for real, return to the landing page and create your own account.', target: 'calendar' },
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
