"use client";

import React, { useState } from "react";
import { useVoiceSession } from "./VoiceContext";
import { 
  Mic, Video, PhoneOff, AlertCircle, Settings, Activity, ChevronUp, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AuraVoiceCore } from "./AuraVoiceCore";
import { VoiceWaveform } from "./VoiceWaveform";

interface LiveScreenProps {
  userId: string;
}

export default function LiveScreen({ userId }: LiveScreenProps) {
  const {
    sessionState,
    isCameraActive,
    errorMsg,
    setErrorMsg,
    liveTranscript,
    modelVolume,
    userVolume,
    startSession,
    stopSession,
    startCamera,
    stopCamera,
    setActiveTab
  } = useVoiceSession();

  const [isChatExpanded, setIsChatExpanded] = useState(false);

  return (
    <div className="h-screen w-full bg-[#050a15] text-white overflow-hidden flex flex-col relative" id="aura-live-root">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-900/20 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="z-20 p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tighter aura-text-glow flex items-center gap-2">
            AURA <span className="text-blue-400 font-light">LIVE</span>
          </h1>
          <p className="text-[8px] text-white/50 tracking-[0.3em] uppercase font-bold mt-1">LISTEN • THINK • RESPOND</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-[8px] font-bold border ${sessionState !== "IDLE" ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-white/40"}`}>
          {sessionState === "IDLE" ? "OFFLINE" : "LIVE · CONNECTED"}
        </div>
      </header>

      {/* Hero Core */}
      <main className="flex-1 z-10 flex flex-col items-center justify-center p-4 overflow-hidden">
        <AuraVoiceCore sessionState={sessionState} modelVolume={modelVolume} userVolume={userVolume} />
        <div className="mt-4 w-full max-w-xs h-12 flex items-center justify-center">
           <VoiceWaveform volume={Math.max(userVolume, modelVolume)} type={sessionState === "IDLE" ? "user" : "model"} />
        </div>
      </main>

      {/* Chat Overlay */}
      <motion.div 
        className={`z-30 mx-4 mb-4 bg-[#081023]/60 backdrop-blur-2xl border border-white/5 rounded-3xl p-4 flex flex-col shrink-0 ${isChatExpanded ? "h-64" : "h-16"}`}
        layout
      >
        <button onClick={() => setIsChatExpanded(!isChatExpanded)} className="flex items-center justify-between w-full mb-1">
          <span className="text-[9px] font-bold uppercase text-white/40 tracking-widest">Live Transcript</span>
          {isChatExpanded ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronUp className="w-3 h-3 text-white/40" />}
        </button>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          {liveTranscript.slice(-3).map((msg, i) => (
            <p key={i} className="text-[10px] text-white/80"><span className="text-white/40">{msg.role === 'user' ? 'You: ' : 'Aura: '}</span>{msg.text}</p>
          ))}
        </div>
      </motion.div>

      {/* Control Dock */}
      <footer className="z-30 p-2 pb-6 flex items-center justify-center shrink-0">
         <div className="bg-[#081023]/60 backdrop-blur-2xl rounded-full p-1 flex items-center gap-2 px-4 border border-white/10 shadow-2xl">
            <button onClick={() => setActiveTab("SETTINGS")} className="p-2 text-white/50 hover:text-white"><Settings className="w-5 h-5" /></button>
            <button onClick={isCameraActive ? stopCamera : () => startCamera("user")} className={`p-2 ${isCameraActive ? "text-cyan-400" : "text-white/50"}`}><Video className="w-5 h-5" /></button>
            
            {/* Hero Mic Button */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={sessionState === "IDLE" ? startSession : stopSession}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(34,211,238,0.3)] ${
                sessionState === "IDLE" ? "bg-white/10 border border-white/20" : "bg-cyan-500/20 border border-cyan-400"
              }`}
            >
              <Mic className="w-6 h-6" />
            </motion.button>
            
            <button onClick={stopSession} className="p-2 text-red-400" disabled={sessionState === "IDLE"}><PhoneOff className="w-5 h-5" /></button>
            <button className="p-2 text-white/50 hover:text-white"><Activity className="w-5 h-5" /></button>
         </div>
      </footer>
    </div>
  );
}
