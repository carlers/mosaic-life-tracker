/**
 * Capture a short microphone clip and decode to 16 kHz mono PCM for Whisper.
 * No network calls or persistent audio storage.
 */
export async function decodeLocalSpeech(blob: Blob): Promise<Float32Array> {
  if (blob.size === 0 || blob.size > 8 * 1024 * 1024) throw new Error('Audio clip is empty or too large.');
  const audioContext = new AudioContext();
  try {
    const audio = await audioContext.decodeAudioData(await blob.arrayBuffer());
    if (audio.duration > 16 || audio.duration < 0.1) throw new Error('Record a clip between 0.1 and 15 seconds.');
    const count = Math.ceil(audio.duration * 16000);
    const offline = new OfflineAudioContext(1, count, 16000);
    const source = offline.createBufferSource();
    source.buffer = audio;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } finally {
    await audioContext.close();
  }
}
export function stopMicrophone(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}
