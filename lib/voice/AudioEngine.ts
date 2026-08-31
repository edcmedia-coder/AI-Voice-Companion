export class AudioEngine {
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextStartTime: number = 0;
  private masterGain: GainNode | null = null;

  constructor() {}

  async startInput(onAudio: (data: Float32Array) => void) {
    this.inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    
    // Persistent output context for playback
    this.outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.masterGain = this.outputCtx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.outputCtx.currentTime);
    this.masterGain.connect(this.outputCtx.destination);

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000,
      }
    });

    const source = this.inputCtx.createMediaStreamSource(this.micStream);
    this.scriptProcessor = this.inputCtx.createScriptProcessor(2048, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      onAudio(new Float32Array(inputData));
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputCtx.destination);
  }

  public playChunk(base64Pcm: string, generation: number) {
    if (!this.outputCtx || this.outputCtx.state === "closed") return;
    
    try {
      const binaryString = atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = this.outputCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.outputCtx.createBufferSource();
      source.buffer = audioBuffer;
      if (this.masterGain) {
        source.connect(this.masterGain);
      }

      const currentTime = this.outputCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(source);
      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) this.activeSources.splice(index, 1);
      };
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }

  public clearPlayback() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    }
    this.activeSources = [];
    if (this.outputCtx) {
      this.nextStartTime = this.outputCtx.currentTime;
    }
  }

  stop() {
    this.clearPlayback();
    this.micStream?.getTracks().forEach(t => t.stop());
    this.scriptProcessor?.disconnect();
    this.inputCtx?.close();
    this.outputCtx?.close();
    this.inputCtx = null;
    this.outputCtx = null;
    this.micStream = null;
  }
}
