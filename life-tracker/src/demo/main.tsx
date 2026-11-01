import React from 'react';
import { createRoot } from 'react-dom/client';
import { DemoApp } from './DemoApp';
import '../index.css';
const node=document.getElementById('root');
if(!node)throw new Error('Demo root is absent');
createRoot(node).render(<React.StrictMode><DemoApp/></React.StrictMode>);
