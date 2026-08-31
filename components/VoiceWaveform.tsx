import React from 'react';
import { motion } from 'motion/react';

interface VoiceWaveformProps {
  volume: number;
  type: 'user' | 'model';
}

export function VoiceWaveform({ volume, type }: VoiceWaveformProps) {
  const bars = 24;
  return (
    <div className="flex gap-1 h-8 items-center justify-center">
      {[...Array(bars)].map((_, i) => {
        const height = Math.max(4, volume * 32 * (Math.sin(i * 0.5) + 1));
        return (
          <motion.div 
            key={i}
            animate={{ height: height }}
            transition={{ duration: 0.1 }}
            className={`w-1 rounded-full ${type === 'model' ? 'bg-purple-400' : 'bg-cyan-400'}`} 
          />
        );
      })}
    </div>
  );
}
