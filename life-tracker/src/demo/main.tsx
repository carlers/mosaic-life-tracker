import React from 'react';
import ReactDOM from 'react-dom/client';

import { DemoAuthProvider } from './DemoAuthProvider';
import { DemoOverlay } from './DemoOverlay';
import { installDemoStorageBoundary } from './storageBoundary';

import { initializeAppearance } from '../lib/appearance';
import { initializeAccentColor } from '../lib/accentColor';
import { initializeUiColors } from '../lib/uiColors';
import { initializeScreenLayout } from '../lib/screenLayout';
import '../index.css';
import './demoOnly.css';
installDemoStorageBoundary();
initializeAppearance();
initializeAccentColor();
initializeUiColors();
initializeScreenLayout();
function blockedNetwork(){throw new Error('The Mosaic public demo is local-only');}
Object.defineProperty(window,'fetch',{configurable:false,writable:false,value:blockedNetwork});
Object.defineProperty(window,'XMLHttpRequest',{configurable:false,writable:false,value:class {constructor(){blockedNetwork();}}});
Object.defineProperty(window,'WebSocket',{configurable:false,writable:false,value:class {constructor(){blockedNetwork();}}});
Object.defineProperty(window,'EventSource',{configurable:false,writable:false,value:class {constructor(){blockedNetwork();}}});
if("sendBeacon" in navigator) Object.defineProperty(navigator,'sendBeacon',{configurable:false,writable:false,value:()=>false});
const [{ default: App },{ startDatabaseBootstrap }]=await Promise.all([
 import('../App'),import('../lib/databaseBootstrap')
]);
void startDatabaseBootstrap();
const node=document.getElementById('root');
if(!node)throw Error('Mosaic demo root missing');
ReactDOM.createRoot(node).render(
 <React.StrictMode><DemoAuthProvider><App/><DemoOverlay/></DemoAuthProvider></React.StrictMode>
);
