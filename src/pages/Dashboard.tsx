import BlogEditor from "@/components/BlogEditor";
import EventEditor from "@/components/EventEditor";
import ContentManager from "@/components/ContentManager";
import { useState } from "react";

type TabState = "blog" | "event" | "manager";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabState>("blog");

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 py-8">
      <div className="w-full max-w-5xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-12">
          <h3 className="text-ares-gold font-bold uppercase tracking-widest text-sm mb-2">Internal Systems</h3>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter shadow-sm mb-4">
            Publisher <span className="text-ares-red">Dashboard</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl text-balance">
            Draft and commit new engineering and outreach blog posts directly to the ARES 23247 D1 Database. All content is stored natively at the Edge.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveTab("blog")}
            className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "blog" ? "bg-ares-gold text-obsidian shadow-lg scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
          >
            Publish Blog
          </button>
          <button
            onClick={() => setActiveTab("event")}
            className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "event" ? "bg-ares-red text-white shadow-[0_0_15px_rgba(192,0,0,0.4)] scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
          >
            Publish Event
          </button>
          <button
            onClick={() => setActiveTab("manager")}
            className={`px-6 py-3 font-bold uppercase tracking-widest text-xs md:text-sm rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTab === "manager" ? "bg-white text-obsidian shadow-lg scale-105" : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
          >
            Manage Content
          </button>
        </div>

        <div className="w-full">
          {activeTab === "blog" && (
            <div className="w-full glass-card rounded-3xl p-6 md:p-10 border border-zinc-800 flex flex-col bg-zinc-900 shadow-2xl">
              <BlogEditor />
            </div>
          )}

          {activeTab === "event" && (
            <div className="w-full glass-card rounded-3xl p-6 md:p-10 border border-ares-red/30 flex flex-col bg-zinc-900 relative shadow-2xl">
              <div className="absolute inset-0 bg-ares-red/5 rounded-3xl pointer-events-none mix-blend-screen" />
              <div className="relative z-10 w-full h-full">
                <EventEditor />
              </div>
            </div>
          )}

          {activeTab === "manager" && (
            <div className="w-full glass-card rounded-3xl p-6 md:p-10 border border-zinc-800 flex flex-col bg-zinc-900 shadow-2xl">
              <ContentManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
