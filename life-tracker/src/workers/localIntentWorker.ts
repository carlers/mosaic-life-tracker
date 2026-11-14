import {pipeline, env} from '@huggingface/transformers';
import {LOCAL_MODEL_CACHE_KEYS} from '../lib/localModelCache';
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.cacheKey = LOCAL_MODEL_CACHE_KEYS.intent;
type Msg = {role: string; content: string};
type Result = {generated_text?: string | Msg[]};
type Generator = (messages: Msg[], options: object) => Promise<Result[]>;
let generator: Generator | null = null;
let loading: Promise<void> | null = null;
function reply(type: string, text = '') { postMessage({type, text}); }
async function load() {
  if (generator) return;
  if (!loading) loading = (async () => {
    reply('progress', 'Downloading optional local AI…');
    const create = pipeline as unknown as (a: string,b: string,c: object) => Promise<Generator>;
    generator = await create('text-generation','onnx-community/Qwen3-0.6B-ONNX',{
      revision:'58ca03a5e7b354b480b1a82b34bde8dc7b854cc0',device:'webgpu',dtype:'q4f16',
      progress_callback:(event:{status?:string;progress?:number})=>{
        if(event.status==='progress') reply('progress','Downloading AI model'+
          (typeof event.progress==='number'?' ('+Math.round(event.progress)+'%)':''));
      },
    });
    reply('ready','Local AI ready');
  })().catch(e=>{loading=null;throw e;});
  await loading;
}
self.addEventListener('message',async (event: MessageEvent<{type:'prepare'|'suggest';text?:string}>)=>{
  try {
    if(event.data.type==='prepare') {await load();return;}
    const input=(event.data.text??'').trim().slice(0,1024);
    if(!input)throw Error('Enter a command first');
    await load();
    reply('progress','Interpreting on this device…');
    const result=await generator!([
      {role:'system',content:'Rewrite the user request into ONE short Mosaic task command. '+
        'Allowed: Add TITLE to CATEGORY with optional date; Move all tasks from CATEGORY to CATEGORY or Backlogs. '+
        'Never invent categories or dates. For ambiguous or unsupported requests answer UNSUPPORTED. '+
        'Output ONLY the rewritten command with no explanation. /no_think'},
      {role:'user',content:input}
    ],{max_new_tokens:96,do_sample:false});
    const answer=result[0]?.generated_text;
    const raw=typeof answer==='string'?answer:
      Array.isArray(answer)?answer[answer.length-1]?.content??'':'';
    const cleaned=raw.replace(/<think>[\s\S]*?<\/think>/gi,'').trim()
      .split('\n')[0].replace(/^["']|["']$/g,'').trim().slice(0,1024);
    reply('suggestion',/^UNSUPPORTED\b/i.test(cleaned)?'':cleaned);
  }catch(error){reply('error',error instanceof Error?error.message.slice(0,180):
    'Local AI inference failed');}
});
