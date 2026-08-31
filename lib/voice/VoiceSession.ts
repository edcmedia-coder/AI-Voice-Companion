import { AudioEngine } from "./AudioEngine";
import { WebSocketClient } from "./WebSocketClient";

export type VoiceState = 
  | "IDLE" 
  | "CONNECTING" 
  | "WAITING_FOR_GEMINI"
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
  token: string;
}

export class VoiceSession {
  private state: VoiceState = "IDLE";
  private audioEngine: AudioEngine;
  private wsClient: WebSocketClient | null = null;
  private playbackGeneration: number = 0;
  private isStopped: boolean = false;
  
  constructor(private config: VoiceSessionConfig) {
    this.audioEngine = new AudioEngine();
  }

  public getState(): VoiceState {
    return this.state;
  }

  public async start(onMessage: (msg: any) => void) {
    // Prevent duplicate start requests if already running
    if (this.state !== "IDLE" && this.state !== "ERROR") {
      console.warn(`[VOICE] VoiceSession.start called while state is ${this.state}. Stopping previous session.`);
      this.stop();
    }

    this.isStopped = false;
    this.state = "CONNECTING";

    // 1. Obtain microphone permission and set up AudioEngine first
    try {
      await this.audioEngine.startInput((float32Array) => {
        if (this.isStopped) return;
        // Only stream audio frames when Gemini session is connected & ready
        if (
          this.state === "CONNECTED" ||
          this.state === "USER_SPEAKING" ||
          this.state === "LISTENING" ||
          this.state === "AI_SPEAKING"
        ) {
          if (this.state === "CONNECTED" || this.state === "LISTENING") {
            this.state = "USER_SPEAKING";
          }
          this.wsClient?.sendAudio(float32Array);
        }
      });
    } catch (err: any) {
      console.error("[VOICE] Microphone initialization error:", err);
      this.state = "ERROR";
      this.audioEngine.stop();
      onMessage({ type: "error", message: "Microphone permission is required." });
      return;
    }

    if (this.isStopped) return;

    // 2. Open WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/voice?token=${encodeURIComponent(this.config.token)}`;
    
    this.wsClient = new WebSocketClient(wsUrl);
    
    this.wsClient.connect(
      (data) => {
        if (this.isStopped) return;

        if (data.type === "status") {
          if (data.status === "connected") {
            // Authoritative server signal that Gemini Live API is connected!
            this.state = "CONNECTED";
          } else if (data.status === "closed") {
            this.state = "IDLE";
          }
        } else if (data.type === "audio") {
          if (this.state !== "INTERRUPTED") {
            this.state = "AI_SPEAKING";
          }
          this.audioEngine.playChunk(data.data, this.playbackGeneration);
        } else if (data.type === "model-text") {
          if (this.state !== "INTERRUPTED") {
            this.state = "AI_SPEAKING";
          }
        } else if (data.type === "user-text") {
          this.state = "USER_SPEAKING";
        } else if (data.type === "interrupted") {
          this.interrupt();
        } else if (data.type === "turn-complete") {
          this.state = "CONNECTED";
        } else if (data.type === "error") {
          this.state = "ERROR";
          this.audioEngine.clearPlayback();
        }
        onMessage(data);
      },
      () => {
        if (this.isStopped) return;
        // WebSocket connection opened; now waiting for server to establish Gemini Live
        this.state = "WAITING_FOR_GEMINI";
      },
      () => {
        if (this.isStopped) return;
        if (this.state !== "ERROR") {
          this.state = "IDLE";
        }
      },
      (err) => {
        if (this.isStopped) return;
        console.error("[VOICE] VoiceSession WebSocket error:", err);
        this.state = "ERROR";
        onMessage({ type: "error", message: "Unable to connect to Aura." });
      }
    );
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
    this.isStopped = true;
    this.state = "STOPPING";
    this.playbackGeneration++;
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.audioEngine.stop();
    this.state = "IDLE";
  }
}
