"use client";
import React, { useState, useEffect } from "react";
import { Search, Sparkles, BookOpen, Upload, FileText, Globe, Trash2, ArrowRight, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { addSourceDoc, getSourceDocs, deleteSourceDoc, SourceDoc } from "@/lib/db";
import { auth } from "@/lib/firebase";

export default function KnowledgeScreen({ userId }: { userId?: string }) {
  const currentUserId = userId || auth.currentUser?.uid || "local-user";
  const [searchQuery, setSearchQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<{ title: string; uri: string }[]>([]);
  const [loading, setSearchLoading] = useState(false);

  // File Ingestion State
  const [documents, setDocuments] = useState<SourceDoc[]>([]);
  const [manualTextName, setManualTextName] = useState("");
  const [manualText, setManualText] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const loadDocs = async () => {
      const docs = await getSourceDocs(currentUserId);
      setDocuments(docs);
    };
    loadDocs();
  }, [currentUserId]);

  const handleGroundingQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setAnswer("");
    setSources([]);

    try {
      let finalPrompt = searchQuery.trim();
      if (documents.length > 0) {
        const docContext = documents
          .map((doc) => `[Source Document: ${doc.name}]\n${doc.content}`)
          .join("\n\n");
        finalPrompt = `You have access to the following local user documents. Use them to answer the question first, then expand if needed.\n\n${docContext}\n\nQuestion: ${searchQuery.trim()}`;
      }

      const res = await fetch("/api/gemini/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalPrompt })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAnswer(data.answer || "");
      setSources(data.sources || []);

    } catch (err: any) {
      console.error(err);
      setAnswer(`Error: ${err.message || "Failed to search grounding sources."}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTextName.trim() || !manualText.trim()) return;

    setIngesting(true);
    try {
      const docData = {
        name: manualTextName.trim(),
        type: "plain/text",
        size: manualText.length,
        content: manualText.trim(),
        uploadedAt: new Date().toISOString()
      };
      const docId = await addSourceDoc(currentUserId, docData);
      setDocuments(prev => [{ id: docId, userId: currentUserId, ...docData }, ...prev]);
      setManualTextName("");
      setManualText("");
    } catch (err) {
      console.error(err);
    } finally {
      setIngesting(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await processUploadedFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processUploadedFile(file);
    }
  };

  const processUploadedFile = async (file: File) => {
    const allowedExtensions = ["txt", "md", "json", "html"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    
    if (!ext || !allowedExtensions.includes(ext)) {
      alert("Unsupported file type! Please upload standard text documents (.txt, .md, .json).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB Limit
      alert("File is too large! Maximum allowed size is 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const textContent = e.target?.result as string;
      const docData = {
        name: file.name,
        type: file.type || "text/plain",
        size: file.size,
        content: textContent,
        uploadedAt: new Date().toISOString()
      };
      
      try {
        const docId = await addSourceDoc(currentUserId, docData);
        setDocuments(prev => [{ id: docId, userId: currentUserId, ...docData }, ...prev]);
      } catch (err) {
        console.error("File ingest error:", err);
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteDoc = async (docId?: string) => {
    if (!docId) return;
    try {
      await deleteSourceDoc(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error("Delete doc error:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-6xl mx-auto space-y-8 h-full"
      id="knowledge-screen"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase aura-text-glow">
              KNOWLEDGE <span className="text-cyan-500/50">HUB</span>
            </h1>
          </div>
          <p className="text-[10px] text-white/40 font-bold tracking-[0.3em] uppercase">
            GROUNDING_ENGINE || INTEL_INGESTION || PERSISTENT_STORAGE_v2.0
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-white/20 tracking-widest uppercase">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" /> INDEX_ACTIVE</span>
          <span>SENSORS: NOMINAL</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Document Ingestion Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em]">
              <Upload className="w-3.5 h-3.5" /> [ DATA_INGEST_UPLINK ]
            </h2>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleFileDrop}
              className={`glass-card p-8 text-center cursor-pointer transition-all relative overflow-hidden group ${
                dragActive
                  ? "border-cyan-500/50 bg-cyan-500/5 scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                  : "hover:border-white/20"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <input
                type="file"
                accept=".txt,.md,.json,.html"
                onChange={handleFileChange}
                className="hidden"
                id="knowledge-file-upload"
              />
              <label htmlFor="knowledge-file-upload" className="cursor-pointer space-y-4 block relative z-10">
                <div className="w-12 h-12 bg-white/5 border border-white/10 text-white/60 mx-auto flex items-center justify-center transition-all group-hover:border-cyan-500/40 group-hover:text-cyan-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] text-white font-black uppercase tracking-widest mb-1">
                    UPLOAD <span className="text-cyan-400">INTEL_SOURCE</span>
                  </div>
                  <div className="text-[9px] text-white/20 uppercase font-bold tracking-wider">
                    TXT, MD, JSON (MAX 2MB)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Manual Copy-Paste Form */}
          <div className="glass-card p-5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-cyan-500/40 to-transparent" />
            <h3 className="text-[10px] font-black text-white/40 flex items-center gap-2 uppercase tracking-[0.2em]">
              <FileText className="w-3.5 h-3.5" /> [ MANUAL_OVERRIDE ]
            </h3>
            <form onSubmit={handleManualIngest} className="space-y-3">
              <input
                type="text"
                required
                value={manualTextName}
                onChange={(e) => setManualTextName(e.target.value)}
                placeholder="INTEL_IDENTIFIER..."
                className="w-full bg-black/40 border border-white/10 py-2.5 px-3 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 font-bold uppercase tracking-widest transition-all"
                id="knowledge-title-input"
              />
              <textarea
                required
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="CONSTRUCT_DATA_PAYLOAD..."
                rows={4}
                className="w-full bg-black/40 border border-white/10 py-2.5 px-3 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 font-bold uppercase tracking-widest resize-none transition-all"
                id="knowledge-content-input"
              />
              <button
                type="submit"
                disabled={ingesting || !manualTextName.trim() || !manualText.trim()}
                className="w-full h-10 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 text-white/60 hover:text-cyan-400 font-black text-[10px] flex items-center justify-center gap-2 transition-all cursor-pointer uppercase tracking-[0.2em] group"
                id="knowledge-manual-ingest-btn"
              >
                {ingesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />}
                EXECUTE_INGEST
              </button>
            </form>
          </div>

          {/* Active Documents List */}
          {documents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[9px] font-black text-white/20 tracking-[0.3em] uppercase flex items-center justify-between">
                <span>INTEL_MANIFEST</span>
                <span className="text-cyan-500/40 font-mono">{documents.length.toString().padStart(2, '0')}</span>
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {documents.map((doc, idx) => (
                  <div
                    key={doc.id ? `doc-${doc.id}` : `doc-idx-${idx}`}
                    className="p-3 bg-white/5 border border-white/10 hover:border-white/20 transition-all flex justify-between items-center gap-3 group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-white font-black truncate uppercase tracking-widest">{doc.name}</div>
                        <div className="text-[8px] text-white/20 font-bold uppercase tracking-tighter">
                          {(doc.size / 1024).toFixed(1)} KB // DATA_TYPE: {doc.type.split('/')[1] || 'RAW'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer rounded-md"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Real-time Google Search Grounding Hub */}
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-card p-8 relative overflow-hidden space-y-6 min-h-[500px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none" />
            
            <div className="flex items-center gap-4">
              <div className="w-1 h-10 bg-cyan-500/40" />
              <div>
                <h2 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" /> [ LIVE_GROUNDING_HUB ]
                </h2>
                <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-1">
                  CROSS_REFERENCE_GLOBAL_NETWORKS_IN_REAL_TIME
                </p>
              </div>
            </div>

            <form onSubmit={handleGroundingQuery} className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">
                  <Search className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    documents.length > 0
                      ? `QUERY_SENSORS + CROSS_REF_${documents.length}_LOCAL_DOCS...`
                      : "INITIATE_GLOBAL_QUERY..."
                  }
                  className="w-full bg-black/60 border border-white/10 py-4 pl-14 pr-4 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 transition-all font-black uppercase tracking-widest"
                  id="knowledge-search-input"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="px-8 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 hover:border-cyan-400 text-white font-black transition-all cursor-pointer aura-glow-cyan text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 group"
                id="knowledge-query-btn"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    EXECUTE <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="flex-1 min-h-[300px]">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-40">
                  <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                  <div className="text-[9px] font-black text-white uppercase tracking-[0.4em]">PROCESSING_GLOBAL_SIGNAL...</div>
                </div>
              ) : answer ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="glass-card bg-white/5 p-6 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-shadow" />
                    <div className="flex items-center gap-2 text-[9px] text-cyan-400 font-black mb-4 uppercase tracking-[0.3em]">
                      <Sparkles className="w-4 h-4" /> [ GROUNDED_RESPONSE_v4.1 ]
                    </div>
                    <div className="text-[12px] font-bold leading-relaxed text-white/90 whitespace-pre-line uppercase tracking-wide">
                      {answer}
                    </div>
                  </div>

                  {sources.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
                        REFERENTIAL_INTELLIGENCE_NODES
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sources.map((src, index) => (
                          <a
                            key={`source-${index}-${src.uri || index}`}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="glass-card bg-white/5 p-4 hover:border-cyan-500/40 flex items-center gap-4 transition-all group overflow-hidden"
                          >
                            <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-white/20 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all">
                              <Globe className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-black truncate text-white uppercase tracking-widest">{src.title}</div>
                              <div className="text-[8px] text-white/20 truncate mt-1 tracking-tighter uppercase font-bold">{src.uri}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-6 border border-white/5 border-dashed rounded-2xl bg-white/[0.02]">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/10">
                    <Globe className="w-8 h-8" />
                  </div>
                  <div className="text-center space-y-2">
                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">SYSTEM_READY_FOR_QUERY</div>
                    <div className="text-[8px] text-white/10 uppercase tracking-widest font-bold">AWAITING_INPUT_SIGNAL...</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
