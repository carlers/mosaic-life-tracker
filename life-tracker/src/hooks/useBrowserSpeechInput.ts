import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechResult = { results?: ArrayLike<ArrayLike<{ transcript?: string }>> };
type RecognitionError = { error?: string };
export interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}
type SpeechConstructor = new () => BrowserRecognition;

function recognizer(): SpeechConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Separate microphone denial from a blocked/unavailable speech service. */
export function speechRecognitionErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
      return 'Microphone access is blocked. Allow Microphone for this Preview site in browser settings, then try again.';
    case 'service-not-allowed':
      return 'The browser did not allow its speech-recognition service. Microphone permission may be fine; try your device keyboard dictation or type the command.';
    case 'audio-capture':
      return 'No usable microphone was found. Check microphone hardware or another app using the microphone.';
    case 'network':
      return 'The browser speech service could not connect. Check internet access or use typed input.';
    case 'language-not-supported':
      return 'The selected speech language is not supported by your browser. Use typed input.';
    case 'no-speech':
      return 'No speech was detected. Try again or type your command.';
    case 'aborted':
      return '';
    default:
      return 'Speech recognition failed (' + (code || 'unknown error') + '). You can still type.';
  }
}

/** Browser-provided recognition may use network services. */
export function useBrowserSpeechInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const live = useRef<BrowserRecognition | null>(null);
  const callback = useRef(onTranscript);
  useEffect(() => { callback.current = onTranscript; }, [onTranscript]);
  const stop = useCallback(() => {
    const active = live.current;
    live.current = null;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.abort();
    }
    setListening(false);
  }, []);
  useEffect(() => () => {
    const active = live.current;
    live.current = null;
    if (active) {
      active.onresult = null;
      active.onerror = null;
      active.onend = null;
      active.abort();
    }
  }, []);
  const start = useCallback(() => {
    const Constructor = recognizer();
    if (!Constructor || live.current) return false;
    setError('');
    const rec = new Constructor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      if (live.current !== rec) return;
      const value = event.results?.[0]?.[0]?.transcript?.trim();
      if (value) callback.current(value.slice(0, 1024));
    };
    rec.onerror = (event) => {
      if (live.current !== rec) return;
      setError(speechRecognitionErrorMessage(event.error));
    };
    rec.onend = () => {
      if (live.current === rec) {
        live.current = null;
        setListening(false);
      }
    };
    live.current = rec;
    try {
      rec.start();
      setListening(true);
      return true;
    } catch {
      live.current = null;
      setListening(false);
      setError('Speech recognition could not start. Type your command instead.');
      return false;
    }
  }, []);
  return { available: Boolean(recognizer()), listening, error, start, stop };
}
