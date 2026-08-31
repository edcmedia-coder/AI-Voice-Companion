import React from 'react';
import { motion } from 'motion/react';

interface AuraVoiceCoreProps {
  sessionState: string;
  modelVolume: number;
  userVolume: number;
}

export function AuraVoiceCore({ sessionState, modelVolume, userVolume }: AuraVoiceCoreProps) {
  const isActive = sessionState !== "IDLE";
  const isListening = sessionState === "LISTENING";
  const isSpeaking = sessionState === "SPEAKING";

  const coreScale = isActive ? 1 + (modelVolume * 0.5) + (userVolume * 0.2) : 1;
  const opacity = isActive ? 1 : 0.6;

  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Ring */}
        <motion.circle
          cx="200" cy="200" r="180"
          stroke="url(#coreGlow)"
          strokeWidth="2"
          fill="none"
          animate={{ rotate: isActive ? 360 : 0, scale: isActive ? 1 : 0.8, opacity: opacity }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner Ring */}
        <motion.circle
          cx="200" cy="200" r="140"
          stroke="#818cf8"
          strokeWidth="1"
          fill="none"
          animate={{ rotate: isActive ? -360 : 0, scale: isActive ? 1 : 0.9 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
      </svg>

      {/* Central Core */}
      <motion.div 
        animate={{ scale: coreScale, opacity: opacity }}
        className="w-40 h-40 bg-black rounded-full flex items-center justify-center relative shadow-[0_0_40px_rgba(34,211,238,0.4)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.3),transparent)] rounded-full" />
        <div className="text-[12px] font-black uppercase tracking-widest text-white/90">
            {isSpeaking ? "Speaking" : isListening ? "Listening" : "Aura"}
        </div>
      </motion.div>
    </div>
  );
}
