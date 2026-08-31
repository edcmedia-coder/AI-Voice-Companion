"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getUserSettings, getMemories, createConversation, addMessageToConversation, updateConversation, addMemory } from "../lib/db";
import { VoiceSession, VoiceState } from "../lib/voice/VoiceSession";

export type SessionState = VoiceState;

// Keep TranscriptItem as is
export interface TranscriptItem {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

interface VoiceContextType {
  sessionState: SessionState;
  isWsConnected: boolean;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMute: () => void;
  isCameraActive: boolean;
  facingMode: "user" | "environment";
  errorMsg: string;
  setErrorMsg: React.Dispatch<React.SetStateAction<string>>;
  liveTranscript: TranscriptItem[];
  currentUserText: string;
  currentModelText: string;
  sessionDuration: number;
  userVolume: number;
  modelVolume: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  startCamera: (mode?: "user" | "environment") => Promise<void>;
  stopCamera: () => void;
  toggleCameraFacing: () => Promise<void>;
  sendMessage: (text: string) => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

export function useVoiceSession() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error("useVoiceSession must be used within a VoiceProvider");
  }
  return context;
}

interface VoiceProviderProps {
  userId: string;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  children: React.ReactNode;
}

export function VoiceProvider({ userId, activeTab, setActiveTab, children }: VoiceProviderProps) {
  const [sessionState, setSessionState] = useState<SessionState>("IDLE");
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [errorMsg, setErrorMsg] = useState("");

  const [liveTranscript, setLiveTranscript] = useState<TranscriptItem[]>([]);
  const [currentUserText, setCurrentUserText] = useState("");
  const [currentModelText, setCurrentModelText] = useState("");

  const currentUserTextRef = useRef("");
  const currentModelTextRef = useRef("");

  const [sessionDuration, setSessionDuration] = useState(0);
  const durationTimerRef = useRef<any>(null);

  const [userVolume, setUserVolume] = useState(0);
  const [modelVolume, setModelVolume] = useState(0);

  // New Voice Engine
  const voiceSessionRef = useRef<VoiceSession | null>(null);

  // Video / Camera refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraIntervalRef = useRef<any>(null);

  // WebSocket & Speech Recognition refs
  const wsRef = useRef<WebSocket | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // DB Session tracking refs
  const conversationIdRef = useRef<string | null>(null);
  const messagesAccumulatorRef = useRef<{ role: "user" | "model"; text: string }[]>([]);

  // Keep isMutedRef synced
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Keep text refs synced with state
  useEffect(() => {
    currentUserTextRef.current = currentUserText;
  }, [currentUserText]);

  useEffect(() => {
    currentModelTextRef.current = currentModelText;
  }, [currentModelText]);

  // Session duration timer
  useEffect(() => {
    if (sessionState !== "IDLE" && sessionState !== "ERROR") {
      durationTimerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [sessionState]);

  // Handle page visibility changes to prevent audio context from freezing in background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (outputAudioCtxRef.current && outputAudioCtxRef.current.state === "suspended") {
          outputAudioCtxRef.current.resume().catch((e) => console.warn("Audio resume error:", e));
        }
        if (inputAudioCtxRef.current && inputAudioCtxRef.current.state === "suspended") {
          inputAudioCtxRef.current.resume().catch((e) => console.warn("Input audio resume error:", e));
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Float32 to PCM 16kHz Base64 encoder
  const pcmToBase64 = (float32Array: Float32Array): string => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Base64 PCM 24kHz to Float32 decoder with micro-envelope smoothing to eliminate clicks & pops
  const base64ToFloat32PCM = (base64: string): Float32Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    // Micro-envelope smoothing on chunk boundaries (raised-cosine window on edge samples to prevent digital pops)
    const fadeSamples = Math.min(64, Math.floor(float32Array.length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const factor = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
      float32Array[i] *= factor;
      float32Array[float32Array.length - 1 - i] *= factor;
    }

    return float32Array;
  };

  const stopCamera = useCallback(() => {
    setIsCameraActive(false);
    if (cameraIntervalRef.current) {
      clearInterval(cameraIntervalRef.current);
      cameraIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Smooth anti-pop audio stop (fade out over 20ms instead of abrupt cutoff)
  const stopAudioPlayback = useCallback(() => {
    const outputCtx = outputAudioCtxRef.current;
    if (outputCtx && masterGainNodeRef.current) {
      try {
        const now = outputCtx.currentTime;
        masterGainNodeRef.current.gain.cancelScheduledValues(now);
        masterGainNodeRef.current.gain.setValueAtTime(masterGainNodeRef.current.gain.value, now);
        masterGainNodeRef.current.gain.linearRampToValueAtTime(0.0001, now + 0.02);
      } catch (e) {}
    }

    const currentSources = [...activeSourcesRef.current];
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setModelVolume(0);

    setTimeout(() => {
      currentSources.forEach((source) => {
        try {
          source.stop();
          source.disconnect();
        } catch (err) {}
      });
      if (outputAudioCtxRef.current && masterGainNodeRef.current) {
        try {
          const resumeTime = outputAudioCtxRef.current.currentTime;
          masterGainNodeRef.current.gain.cancelScheduledValues(resumeTime);
          masterGainNodeRef.current.gain.setValueAtTime(1.0, resumeTime);
        } catch (e) {}
      }
    }, 25);
  }, []);

  const cleanupSession = useCallback(() => {
    stopAudioPlayback();

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch (e) {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch (e) {}
      outputAudioCtxRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    stopCamera();
    setUserVolume(0);
    setModelVolume(0);
  }, [stopAudioPlayback, stopCamera]);

  // Flush accumulator text to DB and transcript state using refs (no stale closures)
  const flushCurrentTranscriptsToDB = useCallback(() => {
    const convId = conversationIdRef.current;
    const userText = currentUserTextRef.current.trim();
    const modelText = currentModelTextRef.current.trim();

    if (userText) {
      if (convId) {
        addMessageToConversation(convId, "user", userText);
      }
      messagesAccumulatorRef.current.push({ role: "user", text: userText });
      setLiveTranscript((prev) => [...prev, { role: "user", text: userText, timestamp: Date.now() }]);
      setCurrentUserText("");
      currentUserTextRef.current = "";
    }

    if (modelText) {
      if (convId) {
        addMessageToConversation(convId, "model", modelText);
      }
      messagesAccumulatorRef.current.push({ role: "model", text: modelText });
      setLiveTranscript((prev) => [...prev, { role: "model", text: modelText, timestamp: Date.now() }]);
      setCurrentModelText("");
      currentModelTextRef.current = "";
    }
  }, []);

  const playAudioChunk = (base64Data: string) => {
    const outputCtx = outputAudioCtxRef.current;
    if (!outputCtx) return;

    if (outputCtx.state === "suspended") {
      outputCtx.resume().catch((e) => console.warn(e));
    }

    const float32Data = base64ToFloat32PCM(base64Data);
    const buffer = outputCtx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);

    const source = outputCtx.createBufferSource();
    source.buffer = buffer;

    // Route audio through the master low-pass filter and compressor chain
    const targetNode = masterFilterRef.current || outputCtx.destination;
    source.connect(targetNode);

    const currentTime = outputCtx.currentTime;
    // Jitter buffer lead-time: ensure at least 100ms buffer to absorb network packet jitter without pops
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.10;
    }

    source.start(nextStartTimeRef.current);
    const bufferDuration = buffer.duration;
    const chunkStartTime = nextStartTimeRef.current;
    nextStartTimeRef.current += bufferDuration;

    activeSourcesRef.current.push(source);

    const checkVolume = () => {
      if (!outputAudioCtxRef.current || !analyserNodeRef.current) return;
      const now = outputAudioCtxRef.current.currentTime;
      if (now >= chunkStartTime && now < chunkStartTime + bufferDuration) {
        const array = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
        analyserNodeRef.current.getByteFrequencyData(array);
        let ampSum = 0;
        for (let i = 0; i < array.length; i++) {
          ampSum += array[i];
        }
        setModelVolume(ampSum / array.length / 255.0);
        requestAnimationFrame(checkVolume);
      } else {
        setModelVolume(0);
      }
    };
    requestAnimationFrame(checkVolume);

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  // Start background client STT helper (Web Speech API) for instantaneous live feedback
  const startClientSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const displayText = (interimTranscript || finalTranscript).trim();
        if (displayText && !isMutedRef.current) {
          setCurrentUserText(displayText);
          currentUserTextRef.current = displayText;
          setSessionState((prev) => (prev === "CONNECTED" || prev === "IDLE" ? "USER_SPEAKING" : prev));
        }
      };

      recognition.onerror = (event: any) => {
        console.log("Client SpeechRecognition event:", event?.error);
      };

      recognition.onend = () => {
        // Auto-restart if session is still active
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn("Client speech recognition init error:", e);
    }
  };

  const initAudioEngine = (stream: MediaStream) => {
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    inputAudioCtxRef.current = inputCtx;

    const source = inputCtx.createMediaStreamSource(stream);
    const processor = inputCtx.createScriptProcessor(2048, 1, 1);
    audioProcessorRef.current = processor;

    source.connect(processor);
    processor.connect(inputCtx.destination);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      setUserVolume(rms);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isMutedRef.current) {
        const base64Audio = pcmToBase64(inputData);
        wsRef.current.send(JSON.stringify({ audio: base64Audio }));
      }
    };

    // Initialize 24kHz studio output audio graph with Dynamics Compressor and Gentle Low-Pass Filter
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    outputAudioCtxRef.current = outputCtx;
    nextStartTimeRef.current = 0;

    // 1. Analyser Node for reactive visualization
    const analyser = outputCtx.createAnalyser();
    analyser.fftSize = 128;
    analyserNodeRef.current = analyser;

    // 2. Dynamics Compressor for warm, balanced studio voice leveling
    const compressor = outputCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-20, outputCtx.currentTime);
    compressor.knee.setValueAtTime(25, outputCtx.currentTime);
    compressor.ratio.setValueAtTime(3.0, outputCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, outputCtx.currentTime);
    compressor.release.setValueAtTime(0.25, outputCtx.currentTime);

    // 3. Gentle Low-pass filter at 11kHz to eliminate high-frequency digital edges / clicks
    const filter = outputCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(11000, outputCtx.currentTime);
    filter.Q.setValueAtTime(0.707, outputCtx.currentTime);
    masterFilterRef.current = filter;

    // 4. Master Gain Node with smooth ramp capabilities
    const masterGain = outputCtx.createGain();
    masterGain.gain.setValueAtTime(1.0, outputCtx.currentTime);
    masterGainNodeRef.current = masterGain;

    // Connect audio processing chain: filter -> compressor -> masterGain -> analyser -> destination
    filter.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(outputCtx.destination);

    startClientSpeechRecognition();
  };

  // Start live voice session
  const startSession = async () => {
    setErrorMsg("");
    setSessionDuration(0);
    setSessionState("CONNECTING");
    setLiveTranscript([]);
    setCurrentUserText("");
    setCurrentModelText("");
    currentUserTextRef.current = "";
    currentModelTextRef.current = "";
    messagesAccumulatorRef.current = [];

    try {
      const settings = await getUserSettings(userId);
      const memories = await getMemories(userId);

      const name = settings?.preferredName || "friend";
      const voice = settings?.voiceId || "Zephyr";
      const personality = settings?.personality || "default";
      const token = await (await fetch("/api/auth/token")).text(); // Need an auth token provider

      const convId = await createConversation(userId, `Aura Session with ${name}`);
      conversationIdRef.current = convId;

      voiceSessionRef.current = new VoiceSession({
        voice,
        personality,
        name,
        memoryEnabled: settings?.memoryEnabled !== false,
        token
      });

      await voiceSessionRef.current.start((msg) => {
        // Handle messages from VoiceSession
        if (msg.type === "audio") {
          // Play audio
          // Need to implement volume/state updates based on msg
        }
        // ... handle other msg types
      });
      setSessionState("CONNECTED");
    } catch (err: any) {
      console.error("Failed to start session:", err);
      setErrorMsg(err.message || "Microphone permission is required to start a voice session.");
      setSessionState("ERROR");
    }
  };

  const stopSession = async () => {
    voiceSessionRef.current?.stop();
    voiceSessionRef.current = null;
    setSessionState("IDLE");
    // ... summarize/db stuff
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: 640, height: 480 },
      });
      cameraStreamRef.current = stream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((e) => console.log(e));
      }

      if (cameraIntervalRef.current) clearInterval(cameraIntervalRef.current);
      cameraIntervalRef.current = setInterval(() => {
        captureCameraSnapshotAndSend();
      }, 1000);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Camera permissions required.");
    }
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (isCameraActive) await startCamera(nextMode);
  };

  const captureCameraSnapshotAndSend = () => {
    const video = videoRef.current;
    if (!video || !cameraStreamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    const base64Data = dataUrl.split(",")[1];
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ video: base64Data }));
    }
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const cleanText = text.trim();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: cleanText }));
      setLiveTranscript((prev) => [...prev, { role: "user", text: cleanText, timestamp: Date.now() }]);
      const convId = conversationIdRef.current;
      if (convId) {
        addMessageToConversation(convId, "user", cleanText);
        messagesAccumulatorRef.current.push({ role: "user", text: cleanText });
      }
    } else {
      alert("Please start the live voice session first.");
    }
  };

  return (
    <VoiceContext.Provider
      value={{
        sessionState,
        isWsConnected,
        isMuted,
        setIsMuted,
        toggleMute,
        isCameraActive,
        facingMode,
        errorMsg,
        setErrorMsg,
        liveTranscript,
        currentUserText,
        currentModelText,
        sessionDuration,
        userVolume,
        modelVolume,
        videoRef,
        startSession,
        stopSession,
        startCamera,
        stopCamera,
        toggleCameraFacing,
        sendMessage,
        activeTab,
        setActiveTab,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
