"use client";

import React, { useState } from "react";
import { auth } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously
} from "firebase/auth";
import { Sparkles, Mail, Lock, LogIn, UserPlus } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(credential.user);
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        onAuthSuccess(credential.user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const credential = await signInAnonymously(auth);
      onAuthSuccess(credential.user);
    } catch (err: any) {
      console.warn("Anonymous auth failed, trying sandbox fallback...", err);
      if (err.code === "auth/admin-restricted-operation" || err.message?.includes("admin-restricted-operation")) {
        const fallbackEmail = "sandbox-voice@aether.core";
        const fallbackPassword = "AetherCoreVoiceSandbox123!";
        try {
          // Attempt sign-in with default sandbox account
          const credential = await signInWithEmailAndPassword(auth, fallbackEmail, fallbackPassword);
          onAuthSuccess(credential.user);
        } catch (signInErr: any) {
          // If the account does not exist or has invalid credentials (e.g. password changed locally), try creating it
          if (
            signInErr.code === "auth/user-not-found" || 
            signInErr.code === "auth/invalid-credential" || 
            signInErr.message?.includes("user-not-found") ||
            signInErr.message?.includes("invalid-credential")
          ) {
            try {
              const credential = await createUserWithEmailAndPassword(auth, fallbackEmail, fallbackPassword);
              onAuthSuccess(credential.user);
            } catch (createErr: any) {
              console.error("Sandbox account provisioning failed:", createErr);
              setError("Anonymous auth is disabled in your Firebase console. Please sign up for a custom account using the 'Sign Up' link below.");
            }
          } else {
            setError("Anonymous auth is disabled. Please create a custom account using the 'Sign Up' link below.");
          }
        }
      } else {
        setError(err.message || "Failed to start a guest session.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030305] relative px-4 overflow-hidden">
      {/* Cinematic background glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/10 blur-[150px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-cyan-900/10 blur-[150px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md glass-panel p-8 rounded-2xl border border-white/10 relative z-10"
        id="auth-container"
      >
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-4 animate-float">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">
            AETHER <span className="font-semibold text-violet-400">CORE</span>
          </h1>
          <p className="text-sm text-gray-400">
            Real-Time AI Voice Companion
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                id="auth-email-input"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                id="auth-password-input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 text-white font-medium rounded-xl py-3 flex items-center justify-center gap-2 transition-colors mt-6 shadow-lg shadow-violet-500/20"
            id="auth-submit-btn"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Create Account
              </>
            )}
          </button>
        </form>

        <div className="relative my-8 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative bg-[#0b0b10] px-4 text-xs font-semibold text-gray-500 tracking-wider uppercase">
            Or Explore Instantly
          </span>
        </div>

        <button
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 active:bg-white/15 text-white font-medium rounded-xl py-3 flex items-center justify-center gap-2 transition-colors shadow-sm"
          id="auth-guest-btn"
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-400" /> Start Guest Voice Session
            </>
          )}
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
            id="auth-toggle-mode-btn"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
