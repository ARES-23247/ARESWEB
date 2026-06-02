"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Pencil, Shield, Activity, Video, ExternalLink, Play, Filter, ArrowUpDown, X } from "lucide-react";

interface TeamVideo {
  id: string;
  title: string;
  description?: string;
  platform: string;
  videoId: string;
  thumbnailUrl?: string;
  embedUrl: string;
  type: "video" | "short";
  createdAt: string;
}

const MOCK_VIDEOS: TeamVideo[] = [
  {
    id: "video_1",
    title: "ARES #23247 World Championship Finals Run",
    description: "Full match footage capturing our mechanical sliders, multi-sample autonomous routines, and hang kinematics.",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1516116211223-5c359a36298a?w=500&auto=format&fit=crop&q=60",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    type: "video",
    createdAt: "2026-05-22"
  },
  {
    id: "video_2",
    title: "Pinpoint IMU Drift Calibrations in 60s",
    description: "Fast-paced YouTube Short tutorial illustrating drift reduction routines for regional teams.",
    platform: "youtube",
    videoId: "dQw4w9WgXcQ",
    thumbnailUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=60",
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    type: "short",
    createdAt: "2026-05-27"
  }
];

export default function VideosManagementPage() {
  const { user, authorizedUser } = useAuth();
  const [videos, setVideos] = useState<TeamVideo[]>(MOCK_VIDEOS);
  const [isLive, setIsLive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "short">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formVideoId, setFormVideoId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"video" | "short">("video");
  const [formThumbnail, setFormThumbnail] = useState("");

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for real-time video updates
  useEffect(() => {
    try {
      const videosRef = collection(db, "videos");
      const unsubscribe = onSnapshot(
        videosRef,
        (snapshot) => {
          if (snapshot.empty) {
            setVideos(MOCK_VIDEOS);
            setIsLive(false);
            return;
          }
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "Untitled Video",
              description: data.description || "",
              platform: data.platform || "youtube",
              videoId: data.videoId || "",
              thumbnailUrl: data.thumbnailUrl || "",
              embedUrl: data.embedUrl || "",
              type: data.type || "video",
              createdAt: data.createdAt || new Date().toISOString().split("T")[0]
            } as TeamVideo;
          });
          
          setVideos(list);
          setIsLive(true);
        },
        (err) => {
          console.warn("Firestore not connected, using fallback mock video library.", err.message);
          setVideos(MOCK_VIDEOS);
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local sandbox mode, using static mock video hub.", e);
      setVideos(MOCK_VIDEOS);
      setIsLive(false);
    }
  }, []);

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditId(null);
    setFormTitle("");
    setFormVideoId("");
    setFormDescription("");
    setFormType("video");
    setFormThumbnail("https://images.unsplash.com/photo-1516116211223-5c359a36298a?w=500&auto=format&fit=crop&q=60");
    setIsEditorOpen(true);
  };

  // Open editor for editing
  const handleOpenEdit = (vid: TeamVideo) => {
    setEditId(vid.id);
    setFormTitle(vid.title);
    setFormVideoId(vid.videoId);
    setFormDescription(vid.description || "");
    setFormType(vid.type);
    setFormThumbnail(vid.thumbnailUrl || "");
    setIsEditorOpen(true);
  };

  // 2. Action: Save Video
  const handleSaveVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formVideoId.trim()) return;
    if (!canEdit) return;

    const targetId = editId || `video_${Date.now()}`;
    const cleanVideoId = formVideoId.trim();
    const newVideo: TeamVideo = {
      id: targetId,
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      platform: "youtube",
      videoId: cleanVideoId,
      thumbnailUrl: formThumbnail.trim() || `https://img.youtube.com/vi/${cleanVideoId}/0.jpg`,
      embedUrl: `https://www.youtube.com/embed/${cleanVideoId}`,
      type: formType,
      createdAt: new Date().toISOString().split("T")[0]
    };

    try {
      await setDoc(doc(db, "videos", targetId), newVideo);
      setIsEditorOpen(false);
    } catch (err) {
      console.warn("Unable to save video online, updating local array.", err);
      if (editId) {
        setVideos(videos.map(v => v.id === editId ? newVideo : v));
      } else {
        setVideos([newVideo, ...videos]);
      }
      setIsEditorOpen(false);
    }
  };

  // 3. Action: Delete Video
  const handleDeleteVideo = async (id: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to remove this video from the team hub?")) return;

    try {
      await deleteDoc(doc(db, "videos", id));
    } catch (err) {
      console.warn("Firestore offline, deleting video locally.", err);
      setVideos(videos.filter(v => v.id !== id));
    }
  };

  // Filter and sort videos
  const filteredAndSortedVideos = React.useMemo(() => {
    let result = [...videos];

    if (typeFilter !== "all") {
      result = result.filter(v => v.type === typeFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [videos, typeFilter, sortOrder]);

  return (
    <div className="space-y-10 w-full">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Multimedia Indexing
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Manage Videos
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Sandbox
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Link dynamic robot kinematics video guides, world championships recaps, and regional FLL outreach highlights.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl"
          >
            <Plus size={16} /> Add Video Link
          </button>
        )}
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 rounded-xl text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to add or remove videos.</span>
        </div>
      )}

      {/* Controls & Filter Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-black/40 border border-white/10 p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-white/40" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-black border border-white/10 text-white text-xs px-2.5 py-1.5 uppercase font-bold tracking-wider outline-none focus:border-ares-red transition-colors cursor-pointer appearance-none rounded"
            >
              <option value="all">All Media</option>
              <option value="video">Videos</option>
              <option value="short">Shorts</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-white/40" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-black border border-white/10 text-white text-xs px-2.5 py-1.5 uppercase font-bold tracking-wider outline-none focus:border-ares-red transition-colors cursor-pointer appearance-none rounded"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-marble/60 font-mono">
          {filteredAndSortedVideos.length} Result{filteredAndSortedVideos.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Videos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAndSortedVideos.map((video) => (
          <div
            key={video.id}
            className="glass-card flex flex-col justify-between overflow-hidden border border-white/10 group hover:border-ares-red/30 transition-colors"
          >
            {video.thumbnailUrl && (
              <a
                href={video.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-48 bg-black/20 relative group/thumb overflow-hidden border-b border-white/5 cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-102"
                  loading="lazy"
                />
                
                {/* Visual playback hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                  <div className="w-12 h-12 bg-ares-red rounded-full flex items-center justify-center shadow-lg">
                    <Play size={20} className="text-white ml-0.5" fill="white" />
                  </div>
                </div>

                <span className="absolute top-3 right-3 text-[8px] font-black uppercase px-2 py-1 bg-black/80 border border-white/15 text-ares-cyan tracking-wider">
                  {video.type}
                </span>
              </a>
            )}

            <div className="p-5 flex-grow flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-marble/50 font-bold uppercase tracking-wider block mb-1">
                  YouTube Resource • {video.createdAt}
                </span>
                <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-ares-gold transition-colors font-heading uppercase tracking-tight">
                  {video.title}
                </h3>
                {video.description && (
                  <p className="text-xs text-marble/70 leading-relaxed line-clamp-2 mb-4">{video.description}</p>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between">
                <a
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-ares-cyan hover:text-white uppercase font-bold tracking-widest inline-flex items-center gap-1"
                >
                  Watch Live <ExternalLink size={10} />
                </a>

                <div className="flex gap-1.5">
                  {canEdit ? (
                    <>
                      <button
                        onClick={() => handleOpenEdit(video)}
                        className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer text-xs"
                        title="Edit Details"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteVideo(video.id)}
                        className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-danger-soft border border-white/10 rounded transition-all cursor-pointer text-xs"
                        title="Delete Video"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <span className="text-[9px] text-marble/40 uppercase font-black tracking-widest">🔒 Locked</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slide-out / Modal Video Editor Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsEditorOpen(false)}
          />

          {/* Editor Drawer */}
          <div className="relative z-10 w-full max-w-lg h-full bg-obsidian border-l border-white/10 flex flex-col justify-between animate-slide-in shadow-2xl">
            <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div>
                <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
                  {editId ? "Edit Video Metadata" : "Link YouTube Resource"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Supports video grids and slideshow sync
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                <X size={16} />
              </button>
            </header>

            {/* Form Canvas */}
            <form onSubmit={handleSaveVideo} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Video Title</label>
                <input
                  type="text"
                  placeholder="e.g. World Championship Alliance Selection & Finals Runs"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">YouTube Video ID</label>
                  <input
                    type="text"
                    placeholder="e.g. dQw4w9WgXcQ"
                    value={formVideoId}
                    onChange={(e) => setFormVideoId(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Media Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none"
                  >
                    <option value="video">Standard Video</option>
                    <option value="short">YouTube Short</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Thumbnail Image URL</label>
                <input
                  type="url"
                  placeholder="Leave empty to load YouTube default poster..."
                  value={formThumbnail}
                  onChange={(e) => setFormThumbnail(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Brief Summary</label>
                <textarea
                  placeholder="Describe the match sequence, driver strategy calibrations, or outreach campaign reflections..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red h-28 transition-colors resize-none leading-relaxed"
                />
              </div>
            </form>

            <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVideo}
                className="clipped-button-sm bg-ares-cyan text-black font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg"
              >
                {editId ? "Update Video" : "Link Video"}
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
