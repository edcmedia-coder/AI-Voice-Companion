"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Video, VideoOff, RefreshCw, Sparkles, Volume2, ShieldCheck, Zap, Radio, Play, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getUserSettings, getMemories, createConversation, addMessageToConversation } from "../lib/db";

interface VoiceManagerProps {
  userId: string;
  onTranscriptUpdate?: (role: "user" | "model", text: string) => void;
}

export default function VoiceManager({ userId, onTranscriptUpdate }: VoiceManagerProps) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [statusText, setStatusText] = useState("Ready to start voice & vision session");
  
  // VAD & Volume visualization
  const [userVolume, setUserVolume] = useState(0);
  const [modelVolume, setModelVolume] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // Transcripts
  const [transcript, setTranscript] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [currentModelText, setCurrentModelText] = useState("");

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Microphone stream hook logic
  const startMicrophoneStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted || !isSessionActive) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // VAD calculation (RMS)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setUserVolume(Math.min(100, Math.round(rms * 300)));
        if (rms > 0.02) {
          setIsUserSpeaking(true);
        } else {
          setIsUserSpeaking(false);
        }

        // Convert Float32 to PCM 16kHz base64
        const pcm16 = float32ToPCM16Base64(inputData);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ audio: pcm16 }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error("Microphone stream error:", err);
      setStatusText("Microphone permission denied or unavailable.");
    }
  };

  const float32ToPCM16Base64 = (float32Array: Float32Array): string => {
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

  // Camera stream handling
  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: 640, height: 480 },
        audio: false
      });
      cameraStreamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera.");
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (isCameraActive) {
      await startCamera(nextMode);
    }
  };

  // Start Live Duplex Session
  const startSession = async () => {
    setStatusText("Connecting to Aether Live Core...");
    try {
      const settings = await getUserSettings(userId);
      const memories = await getMemories(userId);
      const name = settings?.preferredName || "friend";
      const voice = settings?.voiceId || "Zephyr";
      const personality = settings?.personality || "default";
      const memoriesStr = memories.map((m) => m.content).join(". ");

      const convId = await createConversation(userId, `Live Voice Session - ${new Date().toLocaleTimeString()}`);
      conversationIdRef.current = convId;

      await startMicrophoneStream();
      await startCamera(facingMode);

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws/voice?voice=${voice}&personality=${personality}&name=${encodeURIComponent(name)}&memories=${encodeURIComponent(memoriesStr)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsSessionActive(true);
        setStatusText("Live duplex voice session active. Speak freely.");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "audio") {
          setIsAiSpeaking(true);
          setModelVolume(75);
          playAudioChunk(msg.data);
        } else if (msg.type === "model-text") {
          setCurrentModelText((prev) => prev + msg.text);
        } else if (msg.type === "interrupted") {
          console.log("Barge-in / Interruption detected!");
          setIsAiSpeaking(false);
          setModelVolume(0);
          setStatusText("Interrupted — listening to you...");
        } else if (msg.type === "turn-complete") {
          setIsAiSpeaking(false);
          setModelVolume(0);
          if (currentModelText) {
            setTranscript((prev) => [...prev, { role: "model", text: currentModelText }]);
            if (conversationIdRef.current) {
              addMessageToConversation(conversationIdRef.current, "model", currentModelText);
            }
            setCurrentModelText("");
          }
          setStatusText("Live duplex voice session active.");
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setStatusText("Connection error occurred.");
      };

      ws.onclose = () => {
        stopSession();
        setStatusText("Session ended.");
      };
    } catch (err: any) {
      console.error("Failed to start session:", err);
      setStatusText(`Error: ${err.message || "Failed to connect"}`);
    }
  };

  const stopSession = () => {
    setIsSessionActive(false);
    setIsAiSpeaking(false);
    setIsUserSpeaking(false);
    setUserVolume(0);
    setModelVolume(0);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    stopCamera();
    setStatusText("Session terminated.");
  };

  const playAudioChunk = (base64PCM: string) => {
    try {
      const binary = atob(base64PCM);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = outCtx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = outCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(outCtx.destination);
      source.onended = () => {
        setIsAiSpeaking(false);
        setModelVolume(0);
      };
      source.start();
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };

  const askAIWhatsThis = () => {
    const video = videoRef.current;
    if (!video || !isCameraActive) {
      alert("Please activate the camera first.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        video: base64,
        text: "What is this? Describe what you see right in front of the camera in detail with natural human prosody, breath pauses, and warmth."
      }));
      setStatusText("AI is inspecting your camera view...");
    } else {
      alert("Voice session is not active. Click 'Start Live Voice' first.");
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6" id="voice-manager-main">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-light text-white tracking-tight">VoiceManager Core</h2>
            <p className="text-xs text-gray-400">Duplex VAD, barge-in, web search & camera vision integration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-light tracking-wide uppercase flex items-center gap-2 ${
            isSessionActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 border border-white/10"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isSessionActive ? "bg-emerald-400 animate-ping" : "bg-gray-400"}`} />
            {isSessionActive ? "Connected (Duplex)" : "Idle"}
          </span>

          {isSessionActive ? (
            <button
              onClick={stopSession}
              className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-medium transition-all cursor-pointer flex items-center gap-2"
            >
              <Square className="w-3.5 h-3.5" /> End Session
            </button>
          ) : (
            <button
              onClick={startSession}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-all shadow-lg shadow-violet-600/20 cursor-pointer flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" /> Start Live Voice
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Camera View + VAD Levels + Live Transcripts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Camera Feed & Vision Tools */}
        <div className="space-y-4">
          <div className="relative w-full h-72 bg-black/70 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center shadow-inner">
            {isCameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center text-gray-500 space-y-2">
                <VideoOff className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-xs">Camera Feed Inactive</p>
              </div>
            )}

            {isCameraActive && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  onClick={toggleCameraFacing}
                  className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs border border-white/20 hover:bg-black/80 flex items-center gap-1.5 cursor-pointer"
                  title="Switch camera"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {facingMode === "user" ? "Front" : "Back"}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => {
                if (isCameraActive) stopCamera();
                else startCamera(facingMode);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 cursor-pointer border ${
                isCameraActive
                  ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                  : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
              }`}
            >
              {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              {isCameraActive ? "Camera On" : "Enable Camera"}
            </button>

            <button
              onClick={askAIWhatsThis}
              disabled={!isCameraActive || !isSessionActive}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-lg shadow-violet-600/15 disabled:opacity-30 cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Ask AI: &quot;What&apos;s this?&quot;
            </button>
          </div>
        </div>

        {/* Right: VAD Meters & Real-time Status */}
        <div className="space-y-4 flex flex-col justify-between bg-white/[0.02] p-5 rounded-xl border border-white/5">
          <div className="space-y-4">
            <h3 className="text-sm font-light text-white tracking-wide uppercase">Duplex VAD & Audio Metrics</h3>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Microphone Input (User VAD)</span>
                <span className={isUserSpeaking ? "text-emerald-400 font-medium" : "text-gray-500"}>
                  {isUserSpeaking ? "Speaking" : "Silence"} ({userVolume}%)
                </span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${userVolume}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>AI Output Voice (Model)</span>
                <span className={isAiSpeaking ? "text-violet-400 font-medium" : "text-gray-500"}>
                  {isAiSpeaking ? "Speaking" : "Idle"} ({modelVolume}%)
                </span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-75"
                  style={{ width: `${modelVolume}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 space-y-1">
              <div className="text-xs font-medium text-violet-300">Human Prosody & Vocal Tuning</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Fine-tuned with organic breath pauses, variable intonation, dynamic cadence, and zero-latency barge-in support.
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-400 font-light border-t border-white/5 pt-3">
            Status: <span className="text-white font-medium">{statusText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
