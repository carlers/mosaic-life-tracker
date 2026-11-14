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

/** Brave can expose Web Speech constructors without a usable transcription provider. */
type BraveNavigator = Navigator & { brave?: { isBrave?: () => Promise<boolean> | boolean } };
export async function detectBraveBrowser(nav: BraveNavigator): Promise<boolean> {
  try {
    return typeof nav.brave?.isBrave === 'function' && await nav.brave.isBrave() === true;
  } catch {
    // Browser identification is advisory and must not prevent typed commands.
    return false;
  }
}

export const BRAVE_SPEECH_GUIDANCE =
  'Brave may not have an available speech-to-text service, even with a working microphone and internet. Try Chrome for voice input, or use device dictation or typing in the command field.';

/** Separate microphone denial from a blocked/unavailable speech service. */
export function speechRecognitionErrorMessage(code: string | undefined, isBrave = false): string {
  switch (code) {
    case 'not-allowed':
      return 'Microphone access is blocked. Allow Microphone for this Preview site in browser settings, then try again.';
    case 'service-not-allowed':
      if (isBrave) return BRAVE_SPEECH_GUIDANCE;
      return 'The browser did not allow its speech-recognition service. Microphone permission may be fine; try your device keyboard dictation or type the command.';
    case 'audio-capture':
      return 'No usable microphone was found. Check microphone hardware or another app using the microphone.';
    case 'network':
      if (isBrave) return BRAVE_SPEECH_GUIDANCE;
      return 'Your browser could not reach its speech-to-text provider. This can happen even if internet access is working. Try Chrome, use device dictation, or type your command.';
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
  const [isBrave, setIsBrave] = useState(false);
  const isBraveRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    if (typeof navigator !== 'undefined') {
      void detectBraveBrowser(navigator as BraveNavigator).then(result => {
        if (!mounted) return;
        if (result) {
          isBraveRef.current = true;
          setIsBrave(true);
        }
      });
    }
    return () => { mounted = false; };
  }, []);
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
      setError(speechRecognitionErrorMessage(event.error, isBraveRef.current));
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
  return { available: Boolean(recognizer()), isBrave, listening, error, start, stop };
}
