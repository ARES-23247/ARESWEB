import BlogEditor from "@/components/BlogEditor";
import EventEditor from "@/components/EventEditor";
import ContentManager from "@/components/ContentManager";
import AssetManager from "@/components/AssetManager";
import DocsEditor from "@/components/DocsEditor";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, Calendar, Book, Image, LayoutGrid, PlusCircle, Edit3 } from "lucide-react";

type TabState = "blog" | "event" | "docs" | "manage_blog" | "manage_event" | "manage_docs" | "assets";

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDoc = searchParams.get("editDoc");

  const [activeTab, setActiveTab] = useState<TabState>(initialDoc ? "docs" : "blog");
  const [editPostSlug, setEditPostSlug] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editDocSlug, setEditDocSlug] = useState<string | null>(initialDoc);

  useEffect(() => {
    if (initialDoc) {
      const timer = setTimeout(() => {
        setSearchParams(new URLSearchParams());
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialDoc, setSearchParams]);

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 py-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-ares-red/10 blur-[120px] rounded-full pointer-events-none opacity-50" />
      <div className="absolute top-40 -left-64 w-96 h-96 bg-ares-gold/10 blur-[120px] rounded-full pointer-events-none opacity-40" />

      <div className="w-full max-w-5xl mx-auto px-6 py-12 md:py-24 relative z-10">
        <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2 flex items-center gap-2">
              <LayoutGrid size={16} className="text-ares-gold" />
              Internal Systems
            </h3>
            <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500 tracking-tighter mb-4 pb-1">
              ARES <span className="text-transparent bg-clip-text bg-gradient-to-br from-ares-red to-red-900">Dashboard</span>
            </h1>
            <p className="text-zinc-400 max-w-2xl text-balance leading-relaxed">
              Manage D1 Database content natively at the Cloudflare Edge. Draft engineering blogs, schedule events, and maintain team documentation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {/* Create New Panel */}
          <div className="bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/20 blur-3xl rounded-full" />
            <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 z-10">
              <PlusCircle size={14} /> Create Content
            </h4>
            <div className="flex flex-wrap gap-3 z-10">
              <button
                onClick={() => setActiveTab("blog")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold ${activeTab === "blog" ? "bg-gradient-to-b from-ares-gold/20 to-ares-gold/5 border border-ares-gold/50 text-ares-gold shadow-[0_0_20px_rgba(255,191,0,0.15)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <PenTool size={16} />
                {editPostSlug ? "Edit Blog" : "Blog Post"}
              </button>
              <button
                onClick={() => setActiveTab("event")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red ${activeTab === "event" ? "bg-gradient-to-b from-ares-red/20 to-ares-red/5 border border-ares-red/50 text-ares-red shadow-[0_0_20px_rgba(192,0,0,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Calendar size={16} />
                {editEventId ? "Edit Event" : "Event"}
              </button>
              <button
                onClick={() => setActiveTab("docs")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "docs" ? "bg-gradient-to-b from-ares-cyan/20 to-ares-cyan/5 border border-ares-cyan/50 text-ares-cyan shadow-[0_0_20px_rgba(0,183,235,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Book size={16} />
                {editDocSlug ? "Edit Doc" : "Document"}
              </button>
            </div>
          </div>

          {/* Manage Current Panel */}
          <div className="bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-bronze/20 blur-3xl rounded-full" />
            <h4 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 z-10">
              <Edit3 size={14} /> Manage Assets
            </h4>
            <div className="flex flex-wrap gap-3 z-10">
              <button
                onClick={() => setActiveTab("manage_blog")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${activeTab === "manage_blog" ? "bg-white/10 border border-white/20 text-white shadow-lg" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <PenTool size={16} />
                Blogs
              </button>
              <button
                onClick={() => setActiveTab("manage_event")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${activeTab === "manage_event" ? "bg-white/10 border border-white/20 text-white shadow-lg" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Calendar size={16} />
                Events
              </button>
              <button
                onClick={() => setActiveTab("manage_docs")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${activeTab === "manage_docs" ? "bg-white/10 border border-white/20 text-white shadow-lg" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Book size={16} />
                <span className="flex items-center"><span className="text-ares-red normal-case">ARES</span><span className="text-white normal-case">Lib</span></span>
              </button>
              <button
                onClick={() => setActiveTab("assets")}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-bronze ${activeTab === "assets" ? "bg-gradient-to-b from-ares-bronze/20 to-ares-bronze/5 border border-ares-bronze/50 text-ares-bronze shadow-[0_0_20px_rgba(205,127,50,0.2)]" : "bg-white/5 border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"}`}
              >
                <Image size={16} />
                Gallery
              </button>
            </div>
          </div>
        </div>

        <div className="w-full">
          <AnimatePresence mode="wait">
            {activeTab === "blog" && (
              <motion.div 
                key="blog"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-zinc-800 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <BlogEditor editSlug={editPostSlug} onClearEdit={() => setEditPostSlug(null)} />
              </motion.div>
            )}

            {activeTab === "event" && (
              <motion.div 
                key="event"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-red/30 flex flex-col bg-zinc-900 relative shadow-2xl"
              >
                <div className="absolute inset-0 bg-ares-red/5 rounded-3xl pointer-events-none mix-blend-screen" />
                <div className="relative z-10 w-full h-full">
                  <EventEditor editId={editEventId} onClearEdit={() => setEditEventId(null)} />
                </div>
              </motion.div>
            )}

            {activeTab === "docs" && (
              <motion.div 
                key="docs"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-cyan/30 flex flex-col bg-zinc-900 shadow-2xl relative"
              >
                <div className="absolute inset-0 bg-ares-cyan/5 rounded-3xl pointer-events-none mix-blend-screen" />
                <div className="relative z-10 w-full h-full">
                  <DocsEditor editSlug={editDocSlug} onClearEdit={() => setEditDocSlug(null)} />
                </div>
              </motion.div>
            )}

            {(activeTab === "manage_blog" || activeTab === "manage_event" || activeTab === "manage_docs") && (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className={`w-full glass-card rounded-3xl p-6 md:p-10 border flex flex-col bg-zinc-900 shadow-2xl ${
                  activeTab === "manage_blog" ? "border-ares-gold/30" : 
                  activeTab === "manage_event" ? "border-ares-red/30" : 
                  "border-ares-cyan/30"
                }`}
              >
                <ContentManager 
                  mode={activeTab === "manage_blog" ? "blog" : activeTab === "manage_event" ? "event" : "docs"}
                  onEditPost={(slug) => { setEditPostSlug(slug); setActiveTab("blog"); }}
                  onEditEvent={(id) => { setEditEventId(id); setActiveTab("event"); }}
                  onEditDoc={(slug) => { setEditDocSlug(slug); setActiveTab("docs"); }}
                />
              </motion.div>
            )}

            {activeTab === "assets" && (
              <motion.div 
                key="assets"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-bronze/30 flex flex-col bg-zinc-900 shadow-2xl"
              >
                <AssetManager />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
