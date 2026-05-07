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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tighter flex items-center gap-2">
             <Sparkles className="text-ares-gold" size={24} />
             Social Media Manager
          </h2>
          <p className="text-marble/60 text-sm mt-1">
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
              className="flex items-center gap-2 px-4 py-2 bg-ares-red text-white font-bold ares-cut-sm hover:bg-ares-danger transition-colors shadow-lg shadow-ares-red/20"
            >
              <Plus size={18} />
              New Post
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 ares-cut-sm text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-ares-gold text-black"
                : "bg-white/5 text-marble/90 border border-white/5 hover:bg-white/10"
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
