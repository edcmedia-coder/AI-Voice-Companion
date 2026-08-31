
export class AudioEngine {
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  
  constructor() {}

  async startInput(onAudio: (data: Float32Array) => void) {
    this.inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream = stream;
    
    const source = this.inputCtx.createMediaStreamSource(stream);
    const processor = this.inputCtx.createScriptProcessor(2048, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      onAudio(inputData);
    };

    source.connect(processor);
    processor.connect(this.inputCtx.destination);
  }

  stop() {
    this.micStream?.getTracks().forEach(t => t.stop());
    this.inputCtx?.close();
    this.outputCtx?.close();
  }
}
