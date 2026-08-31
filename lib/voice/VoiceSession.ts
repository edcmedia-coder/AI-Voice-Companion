import { AudioEngine } from "./AudioEngine";
import { WebSocketClient } from "./WebSocketClient";

export type VoiceState = 
  | "IDLE" 
  | "CONNECTING" 
  | "CONNECTED" 
  | "LISTENING" 
  | "USER_SPEAKING" 
  | "PROCESSING"
  | "AI_THINKING" 
  | "AI_SPEAKING" 
  | "INTERRUPTED" 
  | "STOPPING" 
  | "ERROR";

export interface VoiceSessionConfig {
  voice: string;
  personality: string;
  name: string;
  memoryEnabled: boolean;
  token: string;
}

export class VoiceSession {
  private state: VoiceState = "IDLE";
  private audioEngine: AudioEngine;
  private wsClient: WebSocketClient | null = null;
  private playbackGeneration: number = 0;
  
  constructor(private config: VoiceSessionConfig) {
    this.audioEngine = new AudioEngine();
  }

  public getState(): VoiceState {
    return this.state;
  }

  public async start(onMessage: (msg: any) => void) {
    this.state = "CONNECTING";
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/voice?token=${encodeURIComponent(this.config.token)}`;
    
    this.wsClient = new WebSocketClient(wsUrl);
    
    this.wsClient.connect(
      (data) => {
        if (data.type === "audio") {
          this.state = "AI_SPEAKING";
          this.audioEngine.playChunk(data.data, this.playbackGeneration);
        } else if (data.type === "model-text") {
          this.state = "AI_SPEAKING";
        } else if (data.type === "user-text") {
          this.state = "USER_SPEAKING";
        } else if (data.type === "interrupted") {
          this.interrupt();
        } else if (data.type === "turn-complete") {
          this.state = "CONNECTED";
        } else if (data.type === "status") {
          if (data.status === "connected") {
            this.state = "CONNECTED";
          }
        }
        onMessage(data);
      },
      () => {
        this.state = "CONNECTED";
      },
      () => {
        this.state = "IDLE";
      },
      (err) => {
        this.state = "ERROR";
        console.error("VoiceSession WebSocket error:", err);
      }
    );
    
    await this.audioEngine.startInput((float32Array) => {
      if (this.state === "CONNECTED" || this.state === "AI_SPEAKING") {
        this.state = "USER_SPEAKING";
      }
      this.wsClient?.sendAudio(float32Array);
    });
    
    this.state = "CONNECTED";
  }

  public interrupt() {
    this.playbackGeneration++;
    this.audioEngine.clearPlayback();
    this.state = "INTERRUPTED";
    setTimeout(() => {
      if (this.state === "INTERRUPTED") {
        this.state = "CONNECTED";
      }
    }, 300);
  }

  public sendText(text: string) {
    this.wsClient?.send({ text });
  }

  public sendVideo(base64Jpeg: string) {
    this.wsClient?.send({ video: base64Jpeg });
  }

  public stop() {
    this.state = "STOPPING";
    this.playbackGeneration++;
    this.wsClient?.close();
    this.audioEngine.stop();
    this.state = "IDLE";
  }
}
