"use client";

import React, { useState } from "react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { Mic, History, BrainCircuit, BookOpen, Sliders, LogOut, User, Sparkles } from "lucide-react";
import LiveScreen from "./LiveScreen";
import HistoryScreen from "./HistoryScreen";
import MemoryScreen from "./MemoryScreen";
import KnowledgeScreen from "./KnowledgeScreen";
import SettingsScreen from "./SettingsScreen";
import { VoiceProvider } from "./VoiceContext";
import FloatingVoiceHUD from "./FloatingVoiceHUD";

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

export type TabId = "LIVE" | "HISTORY" | "MEMORY" | "KNOWLEDGE" | "SETTINGS";

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("LIVE");

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const navItems = [
    { id: "LIVE", label: "Live Voice", icon: Mic },
    { id: "HISTORY", label: "History", icon: History },
    { id: "MEMORY", label: "Memory", icon: BrainCircuit },
    { id: "KNOWLEDGE", label: "Knowledge", icon: BookOpen },
    { id: "SETTINGS", label: "Settings", icon: Sliders }
  ] as const;

  return (
    <VoiceProvider userId={user.uid} activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="h-screen w-full bg-[#020202] text-white flex flex-col relative overflow-hidden" id="dashboard-container">
        
        {/* Top navigation header - Hidden on LIVE to match immersive image UI */}
        {activeTab !== "LIVE" && (
          <header className="flex-none border-b border-white/10 bg-black/90 backdrop-blur-md z-40 w-full" id="header-bar">
            <div className="w-full px-6 h-16 flex items-center justify-between">
              
              {/* Logo brand */}
              <button 
                onClick={() => setActiveTab("LIVE")}
                className="flex items-center gap-2 text-left cursor-pointer group"
              >
                <span className="p-1.5 bg-blue-500/20 border border-blue-500/40 text-blue-400 group-hover:border-blue-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-black tracking-widest uppercase text-white aura-text-glow">
                    AURA <span className="text-xs text-blue-500 font-normal">[ CORE ]</span>
                  </span>
                  <span className="text-[9px] text-white/40 tracking-wider font-bold uppercase">SECURE_LINK_v3.5</span>
                </div>
              </button>

              {/* Status indicators */}
              <div className="hidden lg:flex items-center gap-4 text-[10px] text-white/20 font-bold uppercase tracking-widest">
                <span className="text-green-500/80 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> SYSTEM_ONLINE</span>
                <span className="opacity-50">|</span>
                <span>KERNEL_v0.9.2</span>
              </div>

              {/* Profile & Logout */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 text-[10px] text-white/60 font-bold uppercase tracking-wider rounded-full">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span className="max-w-[120px] truncate">
                    {user.isAnonymous ? "GUEST_USER" : user.email}
                  </span>
                </div>

                <button
                  onClick={handleSignOut}
                  className="p-2 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Sign Out"
                  id="header-logout-btn"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Workspace Area: Sidebar + Main Viewport */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden" id="workspace-area">
          {/* Desktop Sidebar Navigation - Hidden on LIVE */}
          {activeTab !== "LIVE" && (
            <aside className="hidden md:flex flex-col w-[240px] flex-none border-r border-white/10 bg-black/40 backdrop-blur-sm p-6 z-30" id="desktop-sidebar">
              <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                <div className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em] mb-6 px-2">Operational_Modules</div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-4 cursor-pointer rounded-xl border ${
                        isActive
                          ? "bg-blue-600/20 text-white border-blue-500/30 aura-glow-cyan"
                          : "bg-transparent text-white/40 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-white/20"}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* System Info Footnote */}
              <div className="pt-6 mt-auto border-t border-white/5 text-[9px] text-white/20 space-y-1 font-bold uppercase tracking-wider">
                <div className="flex justify-between"><span>LINK_ID:</span> <span className="text-white/40">X77-90</span></div>
                <div className="flex justify-between"><span>ENCRYPTION:</span> <span className="text-white/40">AES-256</span></div>
              </div>
            </aside>
          )}

          {/* Main Content Viewport */}
          <main className="flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden" id="main-viewport">
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${activeTab === "LIVE" ? "" : "pb-24 md:pb-0"}`}>
              <div className="w-full h-full">
                <div className={activeTab === "LIVE" ? "h-full" : "hidden"}>
                  <LiveScreen userId={user.uid} />
                </div>
                {activeTab === "HISTORY" && <HistoryScreen userId={user.uid} />}
                {activeTab === "MEMORY" && <MemoryScreen userId={user.uid} />}
                {activeTab === "KNOWLEDGE" && <KnowledgeScreen userId={user.uid} />}
                {activeTab === "SETTINGS" && <SettingsScreen userId={user.uid} />}
              </div>
            </div>
          </main>
        </div>

        {/* Persistent Floating Mini HUD - Hidden on LIVE */}
        {activeTab !== "LIVE" && <FloatingVoiceHUD />}

        {/* Mobile Sticky Bottom Tab Bar */}
        <div className={`fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/95 backdrop-blur-lg z-40 px-2 py-1.5 transition-transform duration-300 ${
          activeTab === "LIVE" ? "translate-y-full md:translate-y-0 md:hidden" : "md:hidden"
        }`} id="mobile-tab-bar">
          <div className="flex justify-around items-center h-12">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                    isActive ? "text-cyan-300" : "text-cyan-800 hover:text-cyan-600"
                  }`}
                  id={`mobile-nav-link-${item.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">{item.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </VoiceProvider>
  );
}
