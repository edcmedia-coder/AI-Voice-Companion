import { AudioEngine } from "./AudioEngine";
import { WebSocketClient } from "./WebSocketClient";

export type VoiceState = 
  | "IDLE" 
  | "CONNECTING" 
  | "CONNECTED" 
  | "LISTENING" 
  | "USER_SPEAKING" 
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
  token: string; // Add token
}

export class VoiceSession {
  private state: VoiceState = "IDLE";
  private audioEngine: AudioEngine;
  private wsClient: WebSocketClient | null = null;
  
  constructor(private config: VoiceSessionConfig) {
    this.audioEngine = new AudioEngine();
  }

  public async start(onTranscript: (msg: any) => void) {
    this.state = "CONNECTING";
    
    // Auth token is passed in URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/voice?token=${this.config.token}`;
    
    this.wsClient = new WebSocketClient(wsUrl, this.config.token);
    this.wsClient.connect(onTranscript);
    
    await this.audioEngine.startInput((data) => {
      // Send audio
      this.wsClient?.send({ audio: data });
    });
    
    this.state = "CONNECTED";
  }

  public stop() {
    this.state = "STOPPING";
    this.wsClient?.close();
    this.audioEngine.stop();
    this.state = "IDLE";
  }
}
