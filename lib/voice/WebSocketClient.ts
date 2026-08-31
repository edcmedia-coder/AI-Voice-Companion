export class WebSocketClient {
  private ws: WebSocket | null = null;
  
  constructor(private url: string) {}

  connect(
    onMessage: (data: any) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (err: any) => void
  ) {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.warn("Failed to parse WebSocket message:", err);
      }
    };

    this.ws.onclose = () => {
      onClose?.();
    };

    this.ws.onerror = (err) => {
      onError?.(err);
    };
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public sendAudio(float32Array: Float32Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Convert Float32Array (-1 to 1) to Int16Array (PCM 16-bit)
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Convert to base64
    const uint8 = new Uint8Array(pcm16.buffer);
    let binary = "";
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64Data = btoa(binary);

    this.send({ audio: base64Data });
  }

  public close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }
}
