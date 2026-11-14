import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeLocalSpeech, stopMicrophone } from '../lib/localSpeechCapture';
import { deleteLocalModelCache } from '../lib/localModelCache';

type Stage = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'error';
type Reply = {type: 'ready' | 'error' | 'progress' | 'result'; text?: string; message?: string;
  label?: string; percent?: number};
export function useLocalWhisperInput(onTranscript: (text: string) => void) {
  const [stage, setStage] = useState<Stage>('idle');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onTranscript);
  useEffect(() => { callbackRef.current = onTranscript; }, [onTranscript]);

  const releaseMicrophone = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    stopMicrophone(streamRef.current);
    streamRef.current = null;
  }, []);
  const cancel = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    releaseMicrophone();
    workerRef.current?.terminate();
    workerRef.current = null;
    setStage('idle');
    setNotice('');
  }, [releaseMicrophone]);
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const recorder = recorderRef.current;
    recorderRef.current = null; // Ignore delayed stop/decode on unmount.
    workerRef.current?.terminate();
    workerRef.current = null;
    if (recorder?.state === 'recording') recorder.stop();
    stopMicrophone(streamRef.current);
    streamRef.current = null;
  }, []);

  const deleteDownloadedModel = useCallback(async () => {
    cancel(); // End active inference, pending model downloads, and mic capture.
    setDeleting(true);
    try {
      const removedEnglish = await deleteLocalModelCache('whisper');
      const removedMultilingual = await deleteLocalModelCache('whisperMultilingual');
      const removed = removedEnglish || removedMultilingual;
      setNotice(removed ? 'Downloaded Whisper model deleted from browser model storage.' :
        'No downloaded Whisper model files found in browser model storage.');
    } catch {
      setNotice('Could not delete the downloaded Whisper model. Check browser storage permissions.');
    } finally {
      setDeleting(false);
    }
  }, [cancel]);

  const prepare = useCallback((model: 'en' | 'multi' = 'en') => {
    if (workerRef.current || typeof Worker === 'undefined') return;
    try {
      const worker = new Worker(new URL('../workers/localWhisperWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      setStage('loading');
      setNotice('Downloading the model once; audio is processed locally.');
      worker.onmessage = (event: MessageEvent<Reply>) => {
        if (workerRef.current !== worker) return;
        const data = event.data;
        if (data.type === 'ready') { setStage('ready'); setNotice('Local model ready.'); }
        else if (data.type === 'error') {
          worker.terminate();
          workerRef.current = null;
          setStage('error'); setNotice(data.message || 'Local transcription failed.');
        } else if (data.type === 'progress') {
          setNotice(data.label + (typeof data.percent === 'number' ? ' (' + data.percent + '%)' : ''));
        } else if (data.type === 'result') {
          setStage('ready');
          setNotice(data.text ? 'Transcript ready. Check the command before creating a task.' :
            'No words detected. Try again or type.');
          if (data.text) callbackRef.current(data.text.slice(0, 1024));
        }
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        worker.terminate();
        workerRef.current = null;
        setStage('error');
        setNotice('Local speech engine failed. Try reloading or use typed input.');
      };
      worker.postMessage(model === 'multi' ? { type: 'prepare', model: 'multi' } : { type: 'prepare' });
    } catch {
      setStage('error');
      setNotice('This browser could not start the local speech engine.');
    }
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    setStage('transcribing');
    setNotice('Processing audio locally…');
    recorder.stop();
  }, []);

  const record = useCallback(async () => {
    if (stage !== 'ready' || recorderRef.current || !workerRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('Microphone recording is not available in this browser.');
      return;
    }
    try {
      const worker = workerRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({audio: {
        echoCancellation: true, noiseSuppression: true, channelCount: 1,
      }});
      if (!worker || workerRef.current !== worker) {
        stopMicrophone(stream);
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { releaseMicrophone(); setStage('error'); setNotice('Audio capture failed.'); };
      recorder.onstop = async () => {
        releaseMicrophone();
        if (recorderRef.current !== recorder) return;
        setStage('transcribing');
        setNotice('Processing audio locally…');
        recorderRef.current = null;
        try {
          const samples = await decodeLocalSpeech(new Blob(chunks, {type: recorder.mimeType}));
          if (!workerRef.current) return;
          workerRef.current.postMessage({type: 'transcribe', samples}, [samples.buffer]);
        } catch(error) {
          setStage('error');
          setNotice(error instanceof Error ? error.message : 'Could not decode microphone audio.');
        }
      };
      recorder.start();
      setStage('recording');
      setNotice('Recording locally (maximum 15 seconds)…');
      timeoutRef.current = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 15000);
    } catch {
      recorderRef.current = null;
      releaseMicrophone();
      setStage('error');
      setNotice('Microphone access failed. Check permissions or use typed input.');
    }
  }, [stage, releaseMicrophone]);
  return {stage, notice, deleting, prepare, record, stop, cancel, deleteDownloadedModel};
}
