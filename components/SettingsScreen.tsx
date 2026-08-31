"use client";

import React, { useState, useEffect } from "react";
import { saveUserSettings, getUserSettings, UserSettings } from "../lib/db";
import { Sliders, Volume2, Shield, Heart, Smile, Sparkles, Save, HelpCircle, RefreshCw, Tag, User } from "lucide-react";
import { motion } from "motion/react";

interface SettingsScreenProps {
  userId: string;
}

export default function SettingsScreen({ userId }: SettingsScreenProps) {
  const [preferredName, setPreferredName] = useState("");
  const [voiceId, setVoiceId] = useState<UserSettings["voiceId"]>("Zephyr");
  const [personality, setPersonality] = useState<UserSettings["personality"]>("default");
  const [humor, setHumor] = useState<UserSettings["humor"]>("moderate");
  const [interruptionSensitivity, setInterruptionSensitivity] = useState(0.5);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const data = await getUserSettings(userId);
      if (data) {
        setPreferredName(data.preferredName || "");
        setVoiceId(data.voiceId || "Zephyr");
        setPersonality(data.personality || "default");
        setHumor(data.humor || "moderate");
        setInterruptionSensitivity(data.interruptionSensitivity !== undefined ? data.interruptionSensitivity : 0.5);
        setMemoryEnabled(data.memoryEnabled !== undefined ? data.memoryEnabled : true);
      }
    }
    loadSettings();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await saveUserSettings(userId, {
        preferredName,
        voiceId,
        personality,
        humor,
        interruptionSensitivity,
        memoryEnabled
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const voices: { id: UserSettings["voiceId"]; name: string; description: string }[] = [
    { id: "Zephyr", name: "Zephyr", description: "Deep, warm, and highly expressive masculine tone" },
    { id: "Puck", name: "Puck", description: "Bright, energetic, and engaging masculine voice" },
    { id: "Kore", name: "Kore", description: "Calm, professional, and soothing feminine voice" },
    { id: "Charon", name: "Charon", description: "Gravelly, wise, and grounded masculine tone" },
    { id: "Fenrir", name: "Fenrir", description: "Crisp, clear, and direct modern voice" }
  ];

  const personalities: { id: UserSettings["personality"]; label: string; desc: string; icon: any }[] = [
    { id: "default", label: "Standard Companion", desc: "Balanced, friendly, and emotionally intuitive", icon: Sparkles },
    { id: "empathetic", label: "Empathetic Guide", desc: "Warm, supportive, focus on active listening", icon: Heart },
    { id: "witty", label: "Witty Partner", desc: "Playful, funny, and loves clever banter", icon: Smile },
    { id: "supportive", label: "Positive Champion", desc: "High motivation, encouraging and warm", icon: Smile },
    { id: "direct", label: "Strategic Mentor", desc: "Direct, precise, efficient, zero-fluff", icon: Sliders }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-6xl mx-auto space-y-8 h-full"
      id="settings-screen"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sliders className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase aura-text-glow">
              SYSTEM <span className="text-cyan-500/50">CONFIG</span>
            </h1>
          </div>
          <p className="text-[10px] text-white/40 font-bold tracking-[0.3em] uppercase">
            CALIBRATION_MODULE || PERSONA_SYNTHESIS || INTERACTIVE_THRESHOLD_v2.0
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-white/20 tracking-widest uppercase">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" /> SYNC_ACTIVE</span>
          <span>LATENCY: 42MS</span>
        </div>
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] text-center"
        >
          [ CONFIGURATION_PAYLOAD_SYNC_SUCCESSFUL ]
        </motion.div>
      )}

      <form onSubmit={handleSave} className="space-y-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            {/* Basic Personal Details */}
            <div className="glass-card p-6 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/40" />
              <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em]">
                <Volume2 className="w-4 h-4 text-cyan-400" /> [ OPERATOR_IDENT ]
              </h2>
              <div className="space-y-3">
                <label className="text-[9px] font-black text-white/20 tracking-[0.2em] uppercase block">
                  IDENTIFIER_NAME
                </label>
                <input
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="INPUT_ID..."
                  className="w-full bg-black/40 border border-white/10 py-4 px-4 text-[11px] text-white placeholder-white/10 focus:outline-none focus:border-cyan-500/50 transition-all font-bold uppercase tracking-widest"
                  id="settings-name-input"
                />
              </div>
            </div>

            {/* Advanced settings */}
            <div className="glass-card p-6 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/40" />
              <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em]">
                <Shield className="w-4 h-4 text-amber-400" /> [ INTERACTIVE_THRESHOLDS ]
              </h2>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">BARGE_IN_SENSITIVITY</span>
                    <span className="text-cyan-400 font-mono text-[10px] font-black">{(interruptionSensitivity * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={interruptionSensitivity}
                    onChange={(e) => setInterruptionSensitivity(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 bg-white/5 h-1.5 rounded-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-white/20 uppercase tracking-tighter">
                    <span>DELAYED</span>
                    <span>NOMINAL</span>
                    <span>INSTANT</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6 pt-6 border-t border-white/5">
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] font-black text-white/80 uppercase tracking-widest block">SEMANTIC_MEMORY</span>
                    <span className="text-[8px] text-white/20 font-bold uppercase tracking-tight block leading-relaxed">ENABLE_LONG_TERM_FACT_EXTRACTION</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMemoryEnabled(!memoryEnabled)}
                    className={`w-12 h-6 flex items-center rounded-none border border-white/10 p-1 cursor-pointer transition-all ${
                      memoryEnabled ? "bg-cyan-500/20 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]" : "bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-none transition-all ${
                        memoryEnabled ? "translate-x-6 bg-cyan-400" : "translate-x-0 bg-white/20"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            {/* Prebuilt voice selection */}
            <div className="glass-card p-6 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/[0.02] blur-[100px] pointer-events-none" />
              <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em]">
                <Volume2 className="w-4 h-4 text-cyan-400" /> [ VOCAL_SYNTH_ARCHETYPES ]
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {voices.map((voice) => (
                  <label
                    key={voice.id}
                    className={`p-5 glass-card flex flex-col justify-between cursor-pointer transition-all group relative overflow-hidden ${
                      voiceId === voice.id
                        ? "bg-cyan-500/10 border-cyan-500/40"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    {voiceId === voice.id && <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-black uppercase tracking-widest transition-colors ${voiceId === voice.id ? "text-cyan-400" : "text-white/60"}`}>{voice.name}</span>
                      <input
                        type="radio"
                        name="voice-profile"
                        checked={voiceId === voice.id}
                        onChange={() => setVoiceId(voice.id)}
                        className="sr-only"
                      />
                      {voiceId === voice.id && (
                        <div className="w-2 h-2 bg-cyan-400 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[9px] text-white/20 font-bold uppercase leading-relaxed tracking-wider">{voice.description}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Personality archetypes */}
            <div className="glass-card p-6 space-y-6 relative overflow-hidden">
              <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em]">
                <Heart className="w-4 h-4 text-rose-400" /> [ PERSONA_LOGIC_SYNTHESIS ]
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {personalities.map((item) => {
                  const Icon = item.icon;
                  return (
                    <label
                      key={item.id}
                      className={`p-5 glass-card flex flex-col justify-between cursor-pointer transition-all group relative overflow-hidden ${
                        personality === item.id
                          ? "bg-rose-500/10 border-rose-500/40"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      {personality === item.id && <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />}
                      <div className="flex items-center gap-3 mb-4">
                        <Icon className={`w-4 h-4 transition-colors ${personality === item.id ? "text-rose-400" : "text-white/20"}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${personality === item.id ? "text-rose-400" : "text-white/60"}`}>{item.label}</span>
                      </div>
                      <input
                        type="radio"
                        name="personality-profile"
                        checked={personality === item.id}
                        onChange={() => setPersonality(item.id)}
                        className="sr-only"
                      />
                      <span className="text-[9px] text-white/20 font-bold uppercase leading-relaxed tracking-wider">{item.desc}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-8">
          <button
            type="submit"
            disabled={saving}
            className="h-14 px-10 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500 text-white font-black transition-all cursor-pointer aura-glow-cyan text-xs uppercase tracking-[0.3em] flex items-center gap-4 group"
            id="settings-save-btn"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            ) : (
              <>
                <Save className="w-4 h-4 transition-transform group-hover:scale-110" /> EXECUTE_SYNC
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
