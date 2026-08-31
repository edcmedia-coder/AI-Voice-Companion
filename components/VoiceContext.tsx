"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getUserSettings, getMemories, createConversation, addMessageToConversation, updateConversation, addMemory } from "../lib/db";
import { VoiceSession, VoiceState } from "../lib/voice/VoiceSession";
import { auth } from "../lib/firebase";

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

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // AudioEngine handles context resumption if needed
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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

  // Start live voice session
  const startSession = async () => {
    if (voiceSessionRef.current) {
      const currentState = voiceSessionRef.current.getState();
      if (currentState !== "IDLE" && currentState !== "ERROR") {
        console.warn(`[VOICE] Voice session already active (${currentState}). Ignoring duplicate start.`);
        return;
      }
    }

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
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Authentication required. Please sign in again.");
      }
      const token = await currentUser.getIdToken(true);

      const settings = await getUserSettings(userId);
      const name = settings?.preferredName || "friend";

      const convId = await createConversation(userId, `Aura Session with ${name}`);
      conversationIdRef.current = convId;

      const session = new VoiceSession({ token });
      voiceSessionRef.current = session;

      await session.start((msg) => {
        const state = session.getState();
        setSessionState(state);
        setIsWsConnected(state === "CONNECTED" || state === "WAITING_FOR_GEMINI" || state === "USER_SPEAKING" || state === "AI_SPEAKING" || state === "LISTENING");

        if (msg.type === "model-text") {
          setCurrentModelText((prev) => {
            const updated = prev + msg.text;
            currentModelTextRef.current = updated;
            return updated;
          });
        } else if (msg.type === "user-text") {
          setCurrentUserText((prev) => {
            const updated = prev ? prev + " " + msg.text : msg.text;
            currentUserTextRef.current = updated;
            return updated;
          });
        } else if (msg.type === "turn-complete") {
          const modelText = currentModelTextRef.current;
          if (modelText) {
            setLiveTranscript((prev) => [...prev, { role: "model", text: modelText, timestamp: Date.now() }]);
            const activeConvId = conversationIdRef.current;
            if (activeConvId) {
              addMessageToConversation(activeConvId, "model", modelText);
              messagesAccumulatorRef.current.push({ role: "model", text: modelText });
            }
            setCurrentModelText("");
            currentModelTextRef.current = "";
          }
        } else if (msg.type === "error") {
          setErrorMsg(msg.message || "Voice session error");
          setSessionState("ERROR");
          setIsWsConnected(false);
        }
      });
    } catch (err: any) {
      console.error("[VOICE] Failed to start session:", err);
      setErrorMsg(err.message || "Unable to connect to Aura.");
      setSessionState("ERROR");
      setIsWsConnected(false);
      if (voiceSessionRef.current) {
        voiceSessionRef.current.stop();
        voiceSessionRef.current = null;
      }
    }
  };

  const stopSession = async () => {
    voiceSessionRef.current?.stop();
    voiceSessionRef.current = null;
    setSessionState("IDLE");
    setIsWsConnected(false);

    const convId = conversationIdRef.current;
    const historyMsgs = messagesAccumulatorRef.current;

    if (convId && historyMsgs.length > 0) {
      try {
        const res = await fetch("/api/gemini/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyMsgs }),
        });
        const summaryData = await res.json();

        if (summaryData.title && summaryData.summary) {
          await updateConversation(convId, {
            title: summaryData.title,
            summary: summaryData.summary,
            durationSeconds: sessionDuration,
          });

          if (summaryData.extractedMemories && Array.isArray(summaryData.extractedMemories)) {
            for (const item of summaryData.extractedMemories) {
              await addMemory(userId, item.content, item.category);
            }
          }
        }
      } catch (err) {
        console.error("Failed to generate end-of-session summary:", err);
      }
    }

    conversationIdRef.current = null;
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
    if (!video || !cameraStreamRef.current || !voiceSessionRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    const base64Data = dataUrl.split(",")[1];
    voiceSessionRef.current.sendVideo(base64Data);
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const cleanText = text.trim();

    if (voiceSessionRef.current) {
      voiceSessionRef.current.sendText(cleanText);
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
