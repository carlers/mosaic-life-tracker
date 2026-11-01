import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocalWhisperInput } from '../../src/hooks/useLocalWhisperInput';

vi.mock('../../src/lib/localSpeechCapture', () => ({
  decodeLocalSpeech: vi.fn(async () => new Float32Array(16000)),
  stopMicrophone: vi.fn((stream: MediaStream | null) =>
    stream?.getTracks().forEach(track => track.stop())),
}));

class FakeWorker {
  static instances: FakeWorker[] = [];
  messages: Array<{type: string; samples?: Float32Array}> = [];
  terminated = false;
  onmessage: ((event: {data: {type: string; text?: string; label?: string}}) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeWorker.instances.push(this); }
  postMessage(value: {type: string; samples?: Float32Array}) { this.messages.push(value); }
  terminate() { this.terminated = true; }
  emit(data: {type: string; text?: string; label?: string}) { this.onmessage?.({data}); }
}

class FakeRecorder {
  static last: FakeRecorder | null = null;
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: {data: Blob}) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeRecorder.last = this; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['voice'], {type:'audio/webm'}) });
    this.onstop?.();
  }
}
function Probe() {
  const [transcript,setTranscript]=useState('');
  const v=useLocalWhisperInput(setTranscript);
  return <div>
    <span data-testid="stage">{v.stage}</span>
    <span data-testid="notice">{v.notice}</span>
    <span data-testid="transcript">{transcript}</span>
    <button onClick={v.prepare}>Prepare</button>
    <button onClick={() => void v.record()}>Record</button>
    <button onClick={() => void v.stop()}>Stop</button>
    <button onClick={v.cancel}>Cancel</button>
  </div>;
}
describe('opt-in local speech engine', () => {
  it('does not create a worker or request the microphone before user action', async () => {
    const prevWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    vi.stubGlobal('Worker', FakeWorker);
    FakeWorker.instances = [];
    const getUserMedia=vi.fn(async () => ({getTracks:()=>[{stop:vi.fn()}]}));
    Object.defineProperty(navigator, 'mediaDevices', {configurable:true,value:{getUserMedia}});
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    try {
      const ui=render(<Probe/>);
      expect(FakeWorker.instances).toHaveLength(0);
      expect(getUserMedia).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Prepare'));
      expect(FakeWorker.instances).toHaveLength(1);
      const w=FakeWorker.instances[0];
      expect(w.messages).toEqual([{type:'prepare'}]);
      expect(getUserMedia).not.toHaveBeenCalled();
      act(()=>w.emit({type:'ready'}));
      expect(screen.getByTestId('stage').textContent).toBe('ready');
      fireEvent.click(screen.getByText('Record'));
      await waitFor(()=>expect(getUserMedia).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('stage').textContent).toBe('recording');
      fireEvent.click(screen.getByText('Stop'));
      await waitFor(()=>expect(w.messages.some(m=>m.type==='transcribe')).toBe(true));
      const sample = w.messages.find(m=>m.type==='transcribe')?.samples;
      expect(sample?.length).toBe(16000); // fake Worker records the original transfer payload
      act(()=>w.emit({type:'result',text:'add do physics to School tomorrow'}));
      expect(screen.getByTestId('transcript').textContent).toBe('add do physics to School tomorrow');
      fireEvent.click(screen.getByText('Cancel'));
      expect(w.terminated).toBe(true);
      expect(screen.getByTestId('stage').textContent).toBe('idle');
      ui.unmount();
    } finally {
      vi.unstubAllGlobals();
      if(prevWorker)Object.defineProperty(globalThis,'Worker',prevWorker);
      delete (navigator as Navigator & {mediaDevices?: unknown}).mediaDevices;
    }
  });
});
