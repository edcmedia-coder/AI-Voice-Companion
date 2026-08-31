import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { adminAuth, adminDb } from "./lib/firebase-admin";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "localhost", port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  // Handle upgraded websocket connection for live voice stream
  server.on("upgrade", async (req, socket, head) => {
    const parsedUrl = parse(req.url || "", true);
    const { pathname } = parsedUrl;
    console.log(`[VOICE] Upgrade request for ${pathname}`);

    if (pathname === "/api/ws/voice") {
      if (!process.env.GEMINI_API_KEY) {
        console.error("[VOICE] GEMINI_API_KEY is not defined in environment.");
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }

      socket.on("error", (err) => {
        console.warn("[WebSocket Upgrade Socket Error]", err?.message || err);
      });

      const token = (req.headers["authorization"]?.replace("Bearer ", "") || parsedUrl.query.token) as string;
      console.log(`[VOICE] Auth token present: ${!!token}`);

      if (!token) {
        console.error("[VOICE] Firebase auth verified: false (No token provided)");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log(`[VOICE] Firebase auth verified: true`);
        console.log(`[VOICE] UID: ${userId}`);
        (req as any).userId = userId;

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      } catch (err: any) {
        console.error(`[VOICE] Firebase auth verified: false (${err?.message || err})`);
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    } else {
      try {
        const upgradeHandler = app.getUpgradeHandler();
        if (upgradeHandler) {
          upgradeHandler(req, socket, head);
        } else {
          socket.destroy();
        }
      } catch (err: any) {
        console.warn("[Upgrade Handler Error]", err?.message || err);
        socket.destroy();
      }
    }
  });

  wss.on("error", (err) => {
    console.error("[WebSocketServer Error]", err?.message || err);
  });

  wss.on("connection", async (ws, req) => {
    const userId = (req as any).userId;
    if (!userId) {
      console.error("[VOICE] WebSocket rejected: No verified user ID attached.");
      ws.close();
      return;
    }

    console.log("[VOICE] WebSocket accepted");

    // Handle client ws socket errors to prevent unhandled EventEmitter senderOnError crashes
    ws.on("error", (err) => {
      console.warn("[Client WS Socket Error]", err?.message || err);
    });

    const safeSend = (payload: any) => {
      if (ws.readyState === ws.OPEN) {
        try {
          const data = typeof payload === "string" ? payload : JSON.stringify(payload);
          ws.send(data, (err) => {
            if (err) {
              console.warn("[safeSend WS Error]", err?.message || err);
            }
          });
        } catch (err: any) {
          console.warn("[safeSend Exception]", err?.message || err);
        }
      }
    };

    console.log("[VOICE] Loading settings");
    let userSettings: any = {};
    try {
      const settingsDoc = await adminDb.collection("settings").doc(userId).get();
      if (settingsDoc.exists) {
        userSettings = settingsDoc.data() || {};
      }
    } catch (err: any) {
      console.error("[VOICE] Error loading user settings:", err?.message || err);
    }

    const voice = userSettings.voiceId || "Zephyr";
    const personality = userSettings.personality || "default";
    const name = userSettings.preferredName || "friend";
    const memoryEnabled = userSettings.memoryEnabled !== false;

    console.log("[VOICE] Loading memories");
    let memories: string[] = [];
    if (memoryEnabled) {
      try {
        const memoriesSnap = await adminDb.collection("memories").where("userId", "==", userId).get();
        memories = memoriesSnap.docs.map((doc) => doc.data()?.content).filter(Boolean);
      } catch (err: any) {
        console.error("[VOICE] Error loading memories:", err?.message || err);
      }
    }
    
    // Construct humanized system instructions with extreme naturalness, prosody, and organic conversational cadence
    let personalityInstruction = `You are Aura, an exceptionally natural, articulate, warm, and emotionally intelligent real-time conversational partner.
Speak with the effortless cadence, natural phrasing, subtle breathing pauses, and dynamic melodic pitch of a live human. Your voice should feel grounded and "close," with a high degree of breathiness and human-like texture. Never sound robotic, monotone, or like a text-to-speech engine.

PRACTICAL CONVERSATIONAL STYLE:
- Use natural punctuation like ellipses (...), commas, and em-dashes to create organic micro-pauses and lifelike breath timing.
- Incorporate subtle, human-like verbal nuances: "Hmm...", "Oh, wow", "Actually...", "You know...", "Ah, I see".
- Vary your tone and pitch dynamically based on emotional context. If the topic is serious, speak with a softer, more breathy tone. If it's exciting, be more rhythmic and bright.
- Keep responses concise (1-3 sentences) to maintain a lively, balanced back-and-forth flow. Avoid long, uninterrupted monologues.

STRICT SPOKEN FORMATTING:
- NEVER output markdown (like * *, #, \`, etc.) or emoji. 
- Output pure, clean spoken English optimized for high-quality audio synthesis.`;

    if (personality === "empathetic") {
      personalityInstruction += " Tone: Deeply empathetic, warm, gentle, patient, and validation-focused. Listen attentively and offer soothing, genuine emotional presence.";
    } else if (personality === "witty") {
      personalityInstruction += " Tone: Playful, quick-witted, clever, and charming. Use natural banter and lighthearted humor to make the user smile.";
    } else if (personality === "supportive") {
      personalityInstruction += " Tone: Encouraging, uplifting, motivational, and championing. Energize the user and boost their confidence with warmth.";
    } else if (personality === "direct") {
      personalityInstruction += " Tone: Clear, concise, direct, and pragmatic. Deliver insightful points efficiently without unnecessary filler.";
    }

    let systemInstruction = `${personalityInstruction} You are conversing directly with "${name}".`;
    if (memoryEnabled && memories.length > 0) {
      systemInstruction += ` You personally remember these background details about them: ${memories.join(", ")}. Weave these insights into the conversation naturally when contextually relevant.`;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[VOICE] GEMINI_API_KEY is not defined in the environment.");
      safeSend({ type: "error", message: "AI API key is missing on the server. Please check Settings > Secrets." });
      if (ws.readyState === ws.OPEN) {
        try { ws.close(); } catch (e) {}
      }
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    let session: any = null;
    let isSessionClosed = false;
    let hasLoggedAudioInput = false;
    let hasLoggedAudioOutput = false;

    try {
      console.log("[VOICE] Connecting Gemini Live");
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: voice,
              },
            },
          },
          realtimeInputConfig: {
            automaticActivityDetection: {
              prefixPaddingMs: 400,
            }
          },
          tools: [
            { googleSearch: {} }
          ],
          systemInstruction: systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (message: any) => {
            if (isSessionClosed) return;

            // 1. Forward model turn parts (Audio chunks and inline text)
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  if (!hasLoggedAudioOutput) {
                    console.log("[VOICE] Gemini audio received");
                    hasLoggedAudioOutput = true;
                  }
                  safeSend({ type: "audio", data: part.inlineData.data });
                }
                if (part.text) {
                  safeSend({ type: "model-text", text: part.text });
                }
              }
            }

            // 2. Forward output audio transcription if available
            const outputTranscription =
              message.serverContent?.outputAudioTranscription?.text ||
              message.serverContent?.outputTranscription?.text ||
              message.outputAudioTranscription?.text ||
              message.outputTranscription?.text;
            if (outputTranscription) {
              safeSend({ type: "model-text", text: outputTranscription });
            }

            // 3. Forward user turn parts if available
            const userParts = message.serverContent?.userTurn?.parts;
            if (userParts) {
              for (const part of userParts) {
                if (part.text) {
                  safeSend({ type: "user-text", text: part.text });
                }
              }
            }

            // 4. Forward input audio transcription (User Speech STT)
            const inputTranscription =
              message.serverContent?.inputAudioTranscription?.text ||
              message.serverContent?.inputTranscription?.text ||
              message.inputAudioTranscription?.text ||
              message.inputTranscription?.text;
            if (inputTranscription) {
              safeSend({ type: "user-text", text: inputTranscription });
            }

            // 5. Interrupted event (Barge-in!)
            if (message.serverContent?.interrupted) {
              hasLoggedAudioOutput = false;
              safeSend({ type: "interrupted" });
            }

            // 6. Turn complete event
            if (message.serverContent?.turnComplete) {
              hasLoggedAudioOutput = false;
              hasLoggedAudioInput = false;
              safeSend({ type: "turn-complete" });
            }
          },
          onclose: (event: any) => {
            const code = event?.code || 1000;
            const reason = event?.reason ? ` - ${event.reason}` : "";
            console.log(`[VOICE] Gemini Live connection closed (code ${code}${reason})`);
            isSessionClosed = true;
            if (code === 1011 || reason.toLowerCase().includes("quota")) {
              safeSend({ type: "error", message: "API Quota Exceeded (1011). Please check your Google AI Studio plan and billing details." });
            } else {
              safeSend({ type: "status", status: "closed" });
            }
            if (ws.readyState === ws.OPEN) {
              try { ws.close(); } catch (e) {}
            }
          },
          onerror: (err: any) => {
            const errMsg = err?.message || "Gemini Live session error.";
            console.warn("[VOICE] Gemini Live API error:", errMsg);
            if (errMsg.toLowerCase().includes("quota") || errMsg.includes("1011")) {
              safeSend({ type: "error", message: "API Quota Exceeded (1011). Please check your Google AI Studio plan and billing details." });
            } else {
              safeSend({ type: "error", message: errMsg });
            }
          }
        },
      });

      console.log("[VOICE] Gemini Live connected");
      console.log("[VOICE] Sending connected status");
      safeSend({ type: "status", status: "connected" });

    } catch (err: any) {
      const errMsg = err?.message || "Failed to connect to Gemini Live API.";
      console.error("[VOICE] Error connecting to Gemini Live API:", errMsg, err?.stack || "");
      if (errMsg.toLowerCase().includes("quota") || errMsg.includes("1011")) {
        safeSend({ type: "error", message: "API Quota Exceeded (1011). Please check your Google AI Studio plan and billing details." });
      } else {
        safeSend({ type: "error", message: errMsg });
      }
      if (ws.readyState === ws.OPEN) {
        try { ws.close(); } catch (e) {}
      }
      return;
    }

    // Forward client messages to Gemini Live API
    ws.on("message", async (data) => {
      if (isSessionClosed || !session) return;
      try {
        const message = JSON.parse(data.toString());
        if (message.audio) {
          if (!hasLoggedAudioInput) {
            console.log("[VOICE] Client audio received");
            hasLoggedAudioInput = true;
          }
          try {
            session.sendRealtimeInput({
              audio: { data: message.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } catch (e: any) {
            console.warn("Error sending audio to Gemini Live:", e?.message);
          }
        } else if (message.video) {
          try {
            session.sendRealtimeInput({
              video: { data: message.video, mimeType: "image/jpeg" },
            });
          } catch (e: any) {
            console.warn("Error sending video to Gemini Live:", e?.message);
          }
        } else if (message.text) {
          try {
            session.sendRealtimeInput({
              text: message.text,
            });
          } catch (e: any) {
            console.warn("Error sending text to Gemini Live:", e?.message);
          }
        }
      } catch (err: any) {
        console.error("Error processing client message:", err?.message || err);
      }
    });

    ws.on("close", () => {
      console.log("[VOICE] WebSocket closed");
      isSessionClosed = true;
      if (session) {
        try {
          session.close();
        } catch (err: any) {
          console.warn("Error closing Gemini session:", err?.message);
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Server listening at http://localhost:${port} in ${dev ? "development" : "production"} mode`);
  });
});
