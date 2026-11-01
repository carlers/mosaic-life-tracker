import {useCallback,useEffect,useRef,useState} from 'react';
import {deleteLocalModelCache} from '../lib/localModelCache';
type Stage='idle'|'loading'|'ready'|'working'|'error';
type Reply={type:'ready'|'progress'|'suggestion'|'error';text?:string};
export function useLocalIntent(){
 const [stage,setStage]=useState<Stage>('idle');
 const [message,setMessage]=useState('');
 const [suggestion,setSuggestion]=useState('');
 const [deleting,setDeleting]=useState(false);
 const workerRef=useRef<Worker|null>(null);
 const stop=useCallback(()=>{workerRef.current?.terminate();workerRef.current=null;
   setStage('idle');setSuggestion('');},[]);
 useEffect(()=>()=>{workerRef.current?.terminate();workerRef.current=null;},[]);
 const prepare=useCallback(()=>{
   if(workerRef.current)return;
   if(typeof Worker==='undefined'||typeof navigator==='undefined'||!('gpu' in navigator)){
     setStage('error');setMessage('WebGPU unavailable. Typed commands still work.');return;}
   try{
     const worker=new Worker(new URL('../workers/localIntentWorker.ts',import.meta.url),
       {type:'module'});
     workerRef.current=worker;setStage('loading');
     setMessage('Downloading optional AI…');
     worker.onmessage=(event:MessageEvent<Reply>)=>{
       if(workerRef.current!==worker)return;
       const msg=event.data;
       if(msg.type==='ready'){setStage('ready');setMessage(msg.text??'Local AI ready');}
       else if(msg.type==='progress')setMessage(msg.text??'Working locally…');
       else if(msg.type==='suggestion'){setStage('ready');setSuggestion(msg.text??'');
         setMessage(msg.text?'Review the suggested text before using it.':
           'Could not interpret safely. Use typed input.');}
       else if(msg.type==='error'){worker.terminate();workerRef.current=null;
         setStage('error');setMessage(msg.text??'Local AI failed');}
     };
     worker.onerror=()=>{if(workerRef.current!==worker)return;
       worker.terminate();workerRef.current=null;setStage('error');
       setMessage('Local AI failed. Typed commands still work.');};
     worker.postMessage({type:'prepare'});
   }catch{setStage('error');setMessage('Local AI could not start.');}
 },[]);
 const suggest=useCallback((input:string)=>{if(stage!=='ready'||!workerRef.current||
   !input.trim())return;setStage('working');setSuggestion('');
   workerRef.current.postMessage({type:'suggest',text:input.slice(0,1024)});},[stage]);
 const deleteDownloadedModel=useCallback(async()=>{stop();setDeleting(true);
   try{const removed=await deleteLocalModelCache('intent');
     setMessage(removed?'Downloaded AI model deleted.':'No downloaded AI model found.');}
   catch{setMessage('AI model cache deletion failed.');}finally{setDeleting(false);}
 },[stop]);
 return {stage,message,suggestion,deleting,prepare,suggest,stop,deleteDownloadedModel};
}
