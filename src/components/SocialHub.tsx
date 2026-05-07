import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Calendar, BarChart3, Plus } from "lucide-react";
import { SocialComposer, SocialCalendar, SocialAnalytics } from "./social";
import type { SocialQueuePost } from "@shared/routes/socialQueue";

type Tab = "compose" | "calendar" | "analytics";

export default function SocialHub() {
  const [activeTab, setActiveTab] = useState<Tab>("compose");
  const [editingPost, setEditingPost] = useState<SocialQueuePost | null>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "compose", label: "Compose", icon: <Sparkles size={18} /> },
    { id: "calendar", label: "Calendar", icon: <Calendar size={18} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
  ];

  const handleEditPost = (post: SocialQueuePost) => {
    setEditingPost(post);
    setActiveTab("compose");
  };

  return (
    <div className="flex-1 w-full flex flex-col min-h-0">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-ares-red/20 to-red-900/20 ares-cut-sm border border-ares-red/20">
              <Sparkles className="text-ares-red" size={28} />
            </div>
            Social Media Manager
          </h2>
          <p className="text-marble/60 text-sm mt-2">
            Schedule, analyze, and manage posts across all platforms
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab !== "compose" && (
            <button
              onClick={() => {
                setEditingPost(null);
                setActiveTab("compose");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 ares-cut-sm text-xs font-bold uppercase tracking-widest text-marble hover:bg-white/10 transition-all"
            >
              <Plus size={16} /> New Post
            </button>
          )}
        </div>
      </div>

      <div className="flex bg-obsidian/50 p-1 ares-cut-sm border border-white/10 self-start w-full md:w-auto overflow-x-auto custom-scrollbar shadow-inner gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white/10 text-ares-cyan border border-white/20 shadow-sm"
                : "text-marble/50 hover:text-marble border border-transparent"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === "compose" && (
            <motion.div
              key="compose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SocialComposer
                onClose={() => {
                  setEditingPost(null);
                }}
                defaultContent={editingPost?.content}
                defaultLinkedType={editingPost?.linked_type ?? undefined}
                defaultLinkedId={editingPost?.linked_id ?? undefined}
              />
            </motion.div>
          )}

          {activeTab === "calendar" && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SocialCalendar onEditPost={handleEditPost} />
            </motion.div>
          )}

          {activeTab === "analytics" && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SocialAnalytics />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
