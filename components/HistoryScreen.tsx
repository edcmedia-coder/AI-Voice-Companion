"use client";

import React, { useState, useEffect } from "react";
import { getConversations, getConversationMessages, deleteConversation, Conversation, Message } from "../lib/db";
import { Search, History, Trash2, Calendar, Clock, Sparkles, MessageSquare, ArrowLeft, Brain, User, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

interface HistoryScreenProps {
  userId: string;
}

export default function HistoryScreen({ userId }: HistoryScreenProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Selected conversation detail
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchConversations = async () => {
      try {
        const data = await getConversations(userId);
        if (active) {
          setConversations(data);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchConversations();
    return () => {
      active = false;
    };
  }, [userId]);

  const handleSelectConversation = async (conv: Conversation) => {
    if (!conv.id) return;
    setSelectedConv(conv);
    setLoadingMessages(true);
    try {
      const msgs = await getConversationMessages(conv.id);
      setSelectedMessages(msgs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this conversation log? This is irreversible.")) return;

    try {
      await deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
        setSelectedMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const term = searchTerm.toLowerCase();
    return (
      conv.title.toLowerCase().includes(term) ||
      (conv.summary && conv.summary.toLowerCase().includes(term))
    );
  });

  const formatDuration = (secs?: number) => {
    if (!secs) return "0s";
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  if (selectedConv) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-6 max-w-5xl mx-auto space-y-6 h-full"
        id="history-detail-screen"
      >
        <button
          onClick={() => {
            setSelectedConv(null);
            setSelectedMessages([]);
          }}
          className="flex items-center gap-3 text-[10px] font-black text-white/40 hover:text-cyan-400 transition-all cursor-pointer uppercase tracking-[0.2em] group"
          id="history-back-btn"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> [ BACK_TO_LEDGER ]
        </button>

        <div className="glass-card p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/5 pb-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter aura-text-glow">{selectedConv.title}</h1>
              <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em]">SESSION_ID: {selectedConv.id?.slice(-8).toUpperCase()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-white/40 uppercase tracking-widest">
              <span className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-cyan-500/50" />
                {new Date(selectedConv.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-cyan-500/50" />
                {formatDuration(selectedConv.durationSeconds)}
              </span>
            </div>
          </div>

          {selectedConv.summary && (
            <div className="glass-card bg-cyan-500/[0.03] p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-shadow" />
              <div className="flex items-center gap-2 text-[9px] text-cyan-400 font-black mb-4 uppercase tracking-[0.3em]">
                <Sparkles className="w-4 h-4 animate-pulse" /> [ CORE_INTELLIGENCE_SUMMARY ]
              </div>
              <div className="text-xs font-bold leading-relaxed text-white/80 uppercase tracking-wider">
                {selectedConv.summary}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.3em]">
              <MessageSquare className="w-4 h-4 text-cyan-400" /> [ FULL_TRANSMISSION_LOG ]
            </h2>
            <div className="text-[9px] text-white/10 font-bold uppercase tracking-widest">ENCRYPTION: AES-256</div>
          </div>

          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
              <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">DECRYPTING_LOGS...</div>
            </div>
          ) : selectedMessages.length === 0 ? (
            <div className="glass-card p-20 text-center text-white/20 uppercase text-[10px] font-black tracking-[0.3em]">
              NO_MESSAGE_PAYLOAD_DETECTED
            </div>
          ) : (
            <div className="space-y-6">
              {selectedMessages.map((msg, idx) => (
                <div
                  key={msg.id ? `msg-${msg.id}` : `msg-idx-${idx}`}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-6 glass-card relative group transition-all ${
                      msg.role === "user"
                        ? "bg-cyan-500/5 border-cyan-500/20 text-white rounded-tr-none hover:border-cyan-500/40"
                        : "bg-white/5 border-white/10 text-white rounded-tl-none hover:border-white/20"
                    }`}
                  >
                    <div className="absolute top-0 bottom-0 w-[2px] transition-all bg-current opacity-20 group-hover:opacity-60" style={{ left: msg.role === "user" ? "auto" : 0, right: msg.role === "user" ? 0 : "auto" }} />
                    
                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${msg.role === "user" ? "text-cyan-400 justify-end" : "text-white/40"}`}>
                      {msg.role === "user" ? <User className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
                      {msg.role === "user" ? "OPERATOR" : "AURA_CORE"}
                    </div>
                    
                    <p className="text-xs font-bold leading-relaxed uppercase tracking-wider whitespace-pre-line">{msg.text}</p>
                    
                    <div className={`text-[8px] font-bold text-white/20 mt-4 uppercase tracking-tighter ${msg.role === "user" ? "text-right" : ""}`}>
                      T_STAMP: {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-6xl mx-auto space-y-8 h-full"
      id="history-screen"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <History className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase aura-text-glow">
              SESSION <span className="text-cyan-500/50">LEDGER</span>
            </h1>
          </div>
          <p className="text-[10px] text-white/40 font-bold tracking-[0.3em] uppercase">
            ARCHIVE_RETRIEVAL || CORE_MEMORY_LOGS || TRANSMISSION_HISTORY
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-white/20 tracking-widest uppercase">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" /> STORAGE_SYNC: OK</span>
          <span>QUOTA: 98% FREE</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400 transition-colors">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="SEARCH_LOGS_BY_TOPIC_OR_TIMESTAMP..."
          className="w-full bg-black/40 border border-white/10 rounded-none py-5 pl-14 pr-4 text-[11px] text-white placeholder-white/10 focus:outline-none focus:border-cyan-500/50 transition-all font-black uppercase tracking-widest"
          id="history-search-input"
        />
        <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-cyan-500 transition-all group-focus-within:w-full" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">ACCESSING_DATABANKS...</div>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="glass-card p-24 text-center border border-white/5 bg-white/[0.02]">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/10 mx-auto mb-6">
            <History className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">NO_LOGS_FOUND</div>
            <p className="text-[8px] text-white/10 uppercase tracking-widest font-bold">INITIATE_LIVE_SESSION_TO_BEGIN_DATA_COLLECTION</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {filteredConversations.map((conv, idx) => (
            <motion.div
              key={conv.id ? `conv-${conv.id}` : `conv-idx-${idx}`}
              onClick={() => handleSelectConversation(conv)}
              whileHover={{ y: -4 }}
              className="glass-card p-6 flex flex-col justify-between h-56 group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/[0.02] -rotate-45 translate-x-16 -translate-y-16 group-hover:bg-cyan-500/5 transition-all" />
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/5 group-hover:bg-cyan-500/40 transition-all" />
              
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-sm font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tighter leading-tight line-clamp-2">
                    {conv.title}
                  </h3>
                  <button
                    onClick={(e) => conv.id && handleDeleteConversation(e, conv.id)}
                    className="w-8 h-8 flex items-center justify-center text-white/10 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer shrink-0"
                    title="Delete log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {conv.summary ? (
                  <p className="text-[10px] text-white/40 font-bold leading-relaxed line-clamp-3 uppercase tracking-wider">
                    {conv.summary}
                  </p>
                ) : (
                  <div className="text-[9px] text-white/10 font-bold italic uppercase tracking-widest flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" /> PENDING_SUMMARY_GEN
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[8px] font-black text-white/20 border-t border-white/5 pt-4 mt-4 relative z-10 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500/50" />
                  {new Date(conv.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "2-digit"
                  })}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-cyan-500/50" />
                  {formatDuration(conv.durationSeconds)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
