"use client";

import React, { useState } from "react";
import Dashboard from "../components/Dashboard";
import { Sparkles } from "lucide-react";

export default function Page() {
  const [user, setUser] = useState<any>(() => {
    // Stably initialize with a guest user to prevent SSR mismatch and avoid sync useEffect updates
    return {
      uid: "local-user",
      email: "guest@aether.local",
      displayName: "Guest User",
      isAnonymous: true,
    };
  });
  const [loading] = useState(false);

  const handleStartGuestSession = () => {
    setUser({
      uid: "local-user",
      email: "guest@aether.local",
      displayName: "Guest User",
      isAnonymous: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] flex flex-col items-center justify-center relative overflow-hidden" id="page-root-loading">
        <div className="absolute w-[40%] h-[40%] rounded-full bg-violet-900/10 blur-[120px] animate-pulse" />
        <div className="relative z-10 text-center space-y-4">
          <div className="p-4 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 inline-block">
            <Sparkles className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-light text-white tracking-widest uppercase">
            AETHER <span className="font-semibold text-violet-400">Core</span>
          </h2>
          <div className="flex justify-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping [animation-delay:0.4s]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030305] flex flex-col items-center justify-center p-6 text-center" id="page-root-no-user">
        <div className="max-w-md p-8 rounded-2xl border border-white/10 bg-[#050508]/80 backdrop-blur-md space-y-6">
          <div className="p-4 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 inline-block">
            <Sparkles className="w-8 h-8 text-violet-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-light text-white tracking-tight">Session Ended</h2>
            <p className="text-sm text-gray-400 max-w-sm">
              Your previous guest session was closed. Start a new session to continue conversing with Aether Core.
            </p>
          </div>
          <button
            onClick={handleStartGuestSession}
            className="w-full px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-violet-600/15 cursor-pointer"
          >
            Start New Guest Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="page-root">
      <Dashboard user={user} onLogout={() => setUser(null)} />
    </div>
  );
}
