import { pipeline, env } from '@huggingface/transformers';
import { LOCAL_MODEL_CACHE_KEYS } from '../lib/localModelCache';

// Model revision is fixed so the browser does not silently pick up changed weights.
// Model files are downloaded on opt-in, cached locally by Transformers.js and
// inference runs in this worker. No microphone audio is sent to the model host.
const ENGLISH = { id: 'onnx-community/whisper-tiny.en',
  revision: '2575352d61be1bf7225cf8f8b268a4678025fc58', cache: LOCAL_MODEL_CACHE_KEYS.whisper };
const MULTILINGUAL = { id: 'onnx-community/whisper-tiny',
  revision: 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7',
  cache: LOCAL_MODEL_CACHE_KEYS.whisperMultilingual };
let selectedModel = ENGLISH;
env.allowRemoteModels = true;
env.useBrowserCache = true;
// Isolate opt-in weights and WASM from the PWA and future local AI models.
env.cacheKey = LOCAL_MODEL_CACHE_KEYS.whisper;
type Outgoing =
  | { type: 'progress'; label: string; percent?: number }
  | { type: 'ready' }
  | { type: 'result'; text: string }
  | { type: 'error'; message: string };
const send = (message: Outgoing) => postMessage(message);
type Transcriber = (samples: Float32Array, options: {max_new_tokens: number}) =>
  Promise<{text: string} | Array<{text: string}>>;
const loadPipeline = pipeline as unknown as (task: string, model: string,
  options: object) => Promise<Transcriber>;
let instance: Transcriber | null = null;
let initializing: Promise<void> | null = null;

async function loadModel() {
  if (instance) return;
  if (!initializing) {
    initializing = (async () => {
      send({ type: 'progress', label: 'Downloading and initializing the local speech model' });
      instance = await loadPipeline('automatic-speech-recognition', selectedModel.id, {
        device: 'wasm',
        dtype: 'q8',
        revision: selectedModel.revision,
        progress_callback: (item: {status?: string; progress?: number; name?: string}) => {
          if (item.status === 'progress') {
            send({ type: 'progress', label: 'Downloading speech model',
              percent: typeof item.progress === 'number' ? Math.round(item.progress) : undefined });
          }
        },
      });
      send({ type: 'ready' });
    })().catch(error => {
      initializing = null;
      throw error;
    });
  }
  await initializing;
}

self.addEventListener('message', async (event: MessageEvent<{type: 'prepare' | 'transcribe'; model?: 'en' | 'multi'; samples?: Float32Array}>) => {
  try {
    if (event.data.type === 'prepare') {
      selectedModel = event.data.model === 'multi' ? MULTILINGUAL : ENGLISH;
      env.cacheKey = selectedModel.cache;
      await loadModel();
    } else if (event.data.type === 'transcribe') {
      if (!(event.data.samples instanceof Float32Array) || event.data.samples.length < 1600 ||
          event.data.samples.length > 16000 * 16) throw new Error('Invalid audio length');
      await loadModel();
      send({ type: 'progress', label: 'Transcribing on this device' });
      const result = await instance!(event.data.samples, { max_new_tokens: 96 });
      const text = (Array.isArray(result) ? result.map(x => x.text).join(' ') : result.text).trim();
      send({ type: 'result', text });
    }
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message.slice(0, 250) : 'Local transcription failed' });
  }
});
