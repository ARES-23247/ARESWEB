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
    <div className="w-full min-h-[600px] bg-obsidian border border-white/10 ares-cut-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Sparkles className="text-ares-gold" size={28} />
              Social Media Manager
            </h1>
            <p className="text-marble/60 text-sm mt-1">
              Schedule, analyze, and manage posts across all platforms
            </p>
          </div>
          {activeTab !== "compose" && (
            <button
              onClick={() => {
                setEditingPost(null);
                setActiveTab("compose");
              }}
              className="px-4 py-2 bg-gradient-to-r from-ares-gold to-yellow-600 text-black font-bold ares-cut hover:shadow-[0_0_30px_rgba(255,191,0,0.3)] transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              New Post
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? "bg-ares-cyan/20 text-ares-cyan border-t-2 border-ares-cyan"
                  : "text-marble/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
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
