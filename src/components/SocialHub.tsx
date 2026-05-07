import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Calendar, BarChart3, Plus } from "lucide-react";
import { SocialComposer, SocialCalendar, SocialAnalytics } from "./social";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
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
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-ares-red text-white"
                : "text-marble/60 hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <DashboardPageHeader
        title="Social Media Manager"
        subtitle="Schedule, analyze, and manage posts across all platforms"
        icon={<Sparkles className="text-ares-gold" />}
        action={
          activeTab !== "compose" && (
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
          )
        }
      />

      {/* Content */}
      <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "compose" && (
            <motion.div
              key="compose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
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
              className="p-6"
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
              className="p-6"
            >
              <SocialAnalytics />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
