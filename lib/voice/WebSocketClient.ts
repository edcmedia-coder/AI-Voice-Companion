
export class WebSocketClient {
  private ws: WebSocket | null = null;
  
  constructor(private url: string, private token: string) {}

  connect(onMessage: (data: any) => void) {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      // Send token in an initial message or just rely on connection? 
      // The server is checking Authorization header.
      // Wait, WebSockets in browser don't support custom headers easily. 
      // Maybe I should use the token in the URL and the server validates it? 
      // Wait, instructions say: "The server must derive the user identity from the verified authentication token."
      // Let's use the query param for the token, and the server will verify it.
    };
    this.ws.onmessage = (event) => {
      onMessage(JSON.parse(event.data));
    };
  }

  send(data: any) {
    this.ws?.send(JSON.stringify(data));
  }

  close() {
    this.ws?.close();
  }
}
