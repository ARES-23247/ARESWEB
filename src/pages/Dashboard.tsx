import BlogEditor from "@/components/BlogEditor";
import EventEditor from "@/components/EventEditor";
import ContentManager from "@/components/ContentManager";
import AssetManager from "@/components/AssetManager";
import DocsEditor from "@/components/DocsEditor";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 py-8">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-12">
          <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2">Internal Systems</h3>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter shadow-sm mb-4">
            Publisher <span className="text-ares-red">Dashboard</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl text-balance">
            Draft and commit new engineering and outreach blog posts directly to the ARES 23247 D1 Database. All content is stored natively at the Edge.
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-wrap gap-4 items-center bg-black/20 p-4 rounded-3xl border border-white/5">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest mr-2 ml-2 hidden md:block">Create New:</span>
            <button
              onClick={() => setActiveTab("blog")}
              className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "blog" ? "bg-ares-gold text-obsidian shadow-lg scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >
              {editPostSlug ? "Edit Blog" : "New Blog"}
            </button>
            <button
              onClick={() => setActiveTab("event")}
              className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "event" ? "bg-ares-red text-white shadow-[0_0_15px_rgba(192,0,0,0.4)] scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >
              {editEventId ? "Edit Event" : "New Event"}
            </button>
            <button
              onClick={() => setActiveTab("docs")}
              className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "docs" ? "bg-ares-cyan text-obsidian shadow-lg scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >
              {editDocSlug ? "Edit Doc" : "New Doc"}
            </button>
          </div>

          <div className="flex flex-wrap gap-4 items-center bg-black/20 p-4 rounded-3xl border border-white/5">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest mr-2 ml-2 hidden md:block">Manage Current:</span>
            <button
              onClick={() => setActiveTab("manage_blog")}
              className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "manage_blog" ? "bg-ares-gold text-obsidian shadow-lg scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >
              Blogs
            </button>
            <button
              onClick={() => setActiveTab("manage_event")}
              className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "manage_event" ? "bg-ares-red text-white shadow-[0_0_15px_rgba(192,0,0,0.4)] scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab("manage_docs")}
              className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "manage_docs" ? "bg-ares-cyan text-obsidian shadow-lg scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >
              Docs
            </button>
            <button
              onClick={() => setActiveTab("assets")}
              className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "assets" ? "bg-ares-bronze text-white shadow-lg scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
            >
              Media Assets
            </button>
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
