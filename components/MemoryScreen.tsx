"use client";

import React, { useState, useEffect } from "react";
import { getMemories, addMemory, deleteMemory, Memory } from "../lib/db";
import { BrainCircuit, Trash2, Plus, Tag, Calendar, FolderHeart, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

interface MemoryScreenProps {
  userId: string;
}

export default function MemoryScreen({ userId }: MemoryScreenProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New memory form state
  const [newContent, setNewContent] = useState("");
  const [category, setCategory] = useState<Memory["category"]>("general");
  const [adding, setAdding] = useState(false);

  const loadMemories = async () => {
    try {
      const data = await getMemories(userId);
      setMemories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchMemories = async () => {
      try {
        const data = await getMemories(userId);
        if (active) {
          setMemories(data);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchMemories();
    return () => {
      active = false;
    };
  }, [userId]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setAdding(true);
    try {
      await addMemory(userId, newContent.trim(), category);
      setNewContent("");
      setCategory("general");
      await loadMemories();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!window.confirm("Are you sure you want to forget this detail? This action cannot be undone.")) return;
    try {
      await deleteMemory(memoryId);
      // Optimistic state update
      setMemories(prev => prev.filter(m => m.id !== memoryId));
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryColor = (cat: Memory["category"]) => {
    switch (cat) {
      case "preference":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "interest":
        return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "project":
        return "text-violet-400 bg-violet-500/10 border-violet-500/20";
      case "personal":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default:
        return "text-white/40 bg-white/5 border-white/10";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-6xl mx-auto space-y-8 h-full"
      id="memory-screen"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase aura-text-glow">
              CORE <span className="text-cyan-500/50">MEMORY</span>
            </h1>
          </div>
          <p className="text-[10px] text-white/40 font-bold tracking-[0.3em] uppercase">
            RECALL_SUBSYSTEM || SEMANTIC_EXTRACTION || PERSISTENT_RECALL_v1.2
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-white/20 tracking-widest uppercase">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" /> ENGINE: ONLINE</span>
          <span>RECALL_NODES: {memories.length.toString().padStart(2, '0')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Memory Catalog */}
        <div className="lg:col-span-8 space-y-4">
          <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em] mb-4">
            <FolderHeart className="w-4 h-4 text-cyan-400" /> [ STORED_RECALL_INDEX ]
          </h2>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
              <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">SCANNING_SYNAPSES...</div>
            </div>
          ) : memories.length === 0 ? (
            <div className="glass-card p-24 text-center border border-white/5 bg-white/[0.02]">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/10 mx-auto mb-6">
                <BrainCircuit className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">NO_MEMORIES_FOUND</div>
                <p className="text-[8px] text-white/10 uppercase tracking-widest font-bold">INITIATE_CONVERSATION_TO_POPULATE_BANKS</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pb-20">
              {memories.map((mem, idx) => (
                <motion.div
                  key={mem.id ? `mem-${mem.id}` : `mem-idx-${idx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-5 group flex justify-between items-start gap-6 hover:border-white/20 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-white/5 group-hover:bg-cyan-500 transition-all" />
                  
                  <div className="space-y-4 flex-1">
                    <p className="text-xs font-bold leading-relaxed text-white/90 uppercase tracking-wide">
                      {mem.content}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-[8px] font-black uppercase tracking-widest">
                      <span className={`px-2 py-1 border rounded-md transition-colors ${getCategoryColor(mem.category)}`}>
                        {mem.category}
                      </span>
                      <span className="flex items-center gap-2 text-white/20">
                        <Calendar className="w-3.5 h-3.5 text-cyan-500/50" />
                        T_STAMP: {new Date(mem.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => mem.id && handleDeleteMemory(mem.id)}
                    className="w-10 h-10 flex items-center justify-center text-white/10 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer shrink-0"
                    title="Forget memory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Manual seed Form */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em] mb-4">
            <Plus className="w-4 h-4 text-cyan-400" /> [ MANUAL_SEED_INPUT ]
          </h2>

          <form onSubmit={handleAddMemory} className="glass-card p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/[0.02] -rotate-45 translate-x-16 -translate-y-16 pointer-events-none" />
            
            <div className="space-y-3">
              <label className="text-[9px] font-black text-white/20 tracking-[0.2em] uppercase block">
                FACTUAL_PAYLOAD
              </label>
              <textarea
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="INPUT_CONSTRUCT_DATA..."
                rows={5}
                className="w-full bg-black/40 border border-white/10 p-4 text-[11px] text-white placeholder-white/10 focus:outline-none focus:border-cyan-500/50 transition-all font-bold uppercase tracking-widest resize-none"
                id="memory-content-input"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-black text-white/20 tracking-[0.2em] uppercase block">
                TAXONOMY_TAG
              </label>
              <div className="relative group">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Memory["category"])}
                  className="w-full bg-black/40 border border-white/10 p-4 text-[11px] text-white appearance-none focus:outline-none focus:border-cyan-500/50 transition-all font-bold uppercase tracking-widest cursor-pointer"
                  id="memory-category-select"
                >
                  <option value="general" className="bg-neutral-900">GENERAL_CONTEXT</option>
                  <option value="preference" className="bg-neutral-900">PREFERENCE</option>
                  <option value="interest" className="bg-neutral-900">INTEREST_NODE</option>
                  <option value="project" className="bg-neutral-900">PROJECT_INTEL</option>
                  <option value="personal" className="bg-neutral-900">PERSONAL_PROFILE</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-white/20 group-hover:text-cyan-400 transition-colors">
                  <Tag className="w-4 h-4" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={adding || !newContent.trim()}
              className="w-full h-12 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 text-white hover:text-cyan-400 font-black text-[10px] flex items-center justify-center gap-3 transition-all cursor-pointer uppercase tracking-[0.3em] group"
              id="memory-submit-btn"
            >
              {adding ? (
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <>
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" /> COMMIT_TO_BANKS
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
