"use client";

import React from "react";
import { useVoiceSession } from "./VoiceContext";
import { Mic, MicOff, PhoneOff, Maximize2, Sparkles, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function FloatingVoiceHUD() {
  const {
    sessionState,
    isMuted,
    toggleMute,
    stopSession,
    userVolume,
    modelVolume,
    currentUserText,
    currentModelText,
    sessionDuration,
    activeTab,
    setActiveTab,
  } = useVoiceSession();

  // Only show floating HUD when on another screen (not LIVE) and session is running
  if (activeTab === "LIVE" || sessionState === "IDLE") {
    return null;
  }

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = () => {
    if (sessionState === "CONNECTING" || sessionState === "WAITING_FOR_GEMINI") {
      return { text: "CONNECTING", color: "border-amber-500/60 text-amber-300 bg-amber-950/40" };
    }
    if (sessionState === "USER_SPEAKING") {
      return { text: "LISTENING", color: "border-amber-500 text-amber-400 bg-amber-950/40" };
    }
    if (sessionState === "AI_SPEAKING") {
      return { text: "RESPONDING", color: "border-cyan-400 text-cyan-300 bg-cyan-950/40" };
    }
    if (sessionState === "AI_THINKING") {
      return { text: "THINKING", color: "border-cyan-500 text-cyan-400 bg-cyan-950/40" };
    }
    return { text: "CONNECTED", color: "border-cyan-600 text-cyan-400 bg-cyan-950/30" };
  };

  const badge = getStatusBadge();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 max-w-lg w-[calc(100vw-32px)] md:w-auto bg-[#020202]/95 border border-cyan-500/60 hud-glow-cyan p-3.5 backdrop-blur-xl font-mono text-cyan-400 shadow-2xl"
        id="floating-voice-hud"
      >
        {/* Top telemetry bar */}
        <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-cyan-500/20 text-[10px] uppercase font-bold tracking-widest">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            </span>
            <span className="text-cyan-300">[ AURA_BACKGROUND_LINK ]</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 border text-[9px] ${badge.color}`}>
              {badge.text}
            </span>
            <span className="text-cyan-600">[{formatDuration(sessionDuration)}]</span>
          </div>
        </div>

        {/* Live Audio Level Meter Bars */}
        <div className="grid grid-cols-2 gap-2 my-2.5">
          <div className="p-1.5 bg-black/60 border border-cyan-900/40 space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-amber-500 uppercase tracking-wider">
              <span>USR_IN</span>
              <span>{Math.round(userVolume * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-black border border-amber-900/40 flex gap-[1px]">
              {[...Array(12)].map((_, i) => (
                <div
                  key={`hud-usr-meter-${i}`}
                  className={`h-full flex-1 transition-colors duration-75 ${
                    i < userVolume * 24 ? "bg-amber-400" : "bg-transparent"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-1.5 bg-black/60 border border-cyan-900/40 space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-cyan-400 uppercase tracking-wider">
              <span>SYS_OUT</span>
              <span>{Math.round(modelVolume * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-black border border-cyan-900/40 flex gap-[1px]">
              {[...Array(12)].map((_, i) => (
                <div
                  key={`hud-sys-meter-${i}`}
                  className={`h-full flex-1 transition-colors duration-75 ${
                    i < modelVolume * 24 ? "bg-cyan-300" : "bg-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Real-Time Live STT Subtitle pill */}
        <div className="bg-black/80 border border-cyan-900/50 p-2 min-h-[36px] flex items-center justify-center text-center mb-2.5">
          {currentUserText ? (
            <p className="text-[11px] text-amber-300 font-bold uppercase tracking-wide truncate max-w-xs md:max-w-sm">
              &gt; {currentUserText}
            </p>
          ) : currentModelText ? (
            <p className="text-[11px] text-cyan-300 font-bold uppercase tracking-wide truncate max-w-xs md:max-w-sm">
              &gt; {currentModelText}
            </p>
          ) : (
            <p className="text-[9px] text-cyan-800 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
              VOICE LINK ACTIVE • LISTENING IN BACKGROUND
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-cyan-500/20 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className={`px-3 py-1.5 border transition-all flex items-center gap-1.5 cursor-pointer ${
                isMuted
                  ? "bg-rose-950/60 border-rose-500 text-rose-400"
                  : "bg-black hover:bg-cyan-950/40 border-cyan-900 text-cyan-400"
              }`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? "MUTED" : "MUTE"}</span>
            </button>

            <button
              onClick={stopSession}
              className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/80 text-rose-400 flex items-center gap-1.5 transition-all cursor-pointer"
              title="End Voice Call"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>END</span>
            </button>
          </div>

          <button
            onClick={() => setActiveTab("LIVE")}
            className="px-3.5 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400 text-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer hud-glow-cyan"
            title="Expand to Full HUD"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>EXPAND HUD</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
