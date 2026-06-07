"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { Plus, Trash2, Pencil, Shield, Activity, Search, ExternalLink, X } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface BlogPost {
  slug: string;
  title: string;
  snippet: string;
  content: string;
  author: string;
  date: string;
  thumbnail: string;
  status: "draft" | "published";
  isDeleted: number;
}

const MOCK_POSTS: BlogPost[] = [
  {
    slug: "championship-2026-recap",
    title: "Championship 2026: Team ARES Wins Big!",
    snippet: "A comprehensive recap of our journey, triumphs, and scores at the 2026 FIRST® World Championship.",
    content: "### Our Journey to the Finals\n\nWe are absolutely thrilled to share that Team ARES #23247 has achieved a historic milestone, claiming championship honors at the FIRST World Championship! Under our unified team strategies and robust mechanical designs, we achieved record-setting scoring matches.\n\n#### Telemetry Breakdown\n* Average scoring cycles: 12.4 per autonomous run\n* Max slider lift velocity: 1.8 m/s\n* Slip error margin: less than 0.2%\n\nOur team is grateful to our partners, mentors, and parents for supporting the cargo (the students) throughout this intense season!",
    author: "Coach David",
    date: "2026-05-20",
    thumbnail: "https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=500&auto=format&fit=crop&q=60",
    status: "published",
    isDeleted: 0
  },
  {
    slug: "drivetrain-ekf-calibration",
    title: "ARESLib Drivetrain & EKF Odometry Calibrations",
    snippet: "Deep technical insight into tuning mecanum kS feedforward and GoBilda Pinpoint EKF odometry values.",
    content: "### Tuning Mecanum and EKF parameters\n\nCorrect odometry tracking requires systematic calibration of deadband coefficients and friction variables. In this post, we walk through our custom EKF filtering algorithms and pinpoint corrections.\n\n```kotlin\n// Calibration values inside FtcMecanumRobot.kt\nval ksFeedforward = 0.05\nval imuCorrect = 0.985\n```\n\nBy adjusting our kS friction values dynamically, our autonomous heading calculations achieved absolute drift reductions of over 85%!",
    author: "Lead Student",
    date: "2026-05-15",
    thumbnail: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=60",
    status: "published",
    isDeleted: 0
  }
];

export default function BlogManagementPage() {
  const { user, authorizedUser } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>(MOCK_POSTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [userNickname, setUserNickname] = useState("");
  
  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSnippet, setFormSnippet] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formThumbnail, setFormThumbnail] = useState("");
  const [formStatus, setFormStatus] = useState<"draft" | "published">("draft");
  const editorRef = useFocusTrap(isEditorOpen, () => setIsEditorOpen(false));

  useEffect(() => {
    if (!user) return;
    const fetchNickname = async () => {
      try {
        const userProfileRef = doc(db, "user_profiles", user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        if (userProfileSnap.exists()) {
          const profileData = userProfileSnap.data();
          if (profileData.nickname) {
            setUserNickname(profileData.nickname);
          }
        }
      } catch (err) {
        console.warn("Could not retrieve user profile for nickname:", err);
      }
    };
    fetchNickname();
  }, [user]);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for real-time blog post updates
  useEffect(() => {
    try {
      const postsRef = collection(db, "posts");
      const unsubscribe = onSnapshot(
        postsRef,
        (snapshot) => {
          if (snapshot.empty) {
            setPosts(MOCK_POSTS);
            setIsLive(false);
            return;
          }
          const list = snapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                slug: doc.id,
                title: data.title || "Untitled Post",
                snippet: data.snippet || "",
                content: data.content || "",
                author: data.author || "ARES Member",
                date: data.date || new Date().toISOString().split("T")[0],
                thumbnail: data.thumbnail || "",
                status: data.status || "draft",
                isDeleted: data.isDeleted || 0
              } as BlogPost;
            })
            .filter((p) => p.isDeleted === 0);
          
          setPosts(list.length > 0 ? list : MOCK_POSTS);
          setIsLive(true);
        },
        (err) => {
          console.warn("Firestore not connected, using fallback mock blog data.", err.message);
          setPosts(MOCK_POSTS);
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local sandbox mode, using static mock blog posts.", e);
      setPosts(MOCK_POSTS);
      setIsLive(false);
    }
  }, []);

  // Sync slug helper
  useEffect(() => {
    if (!editSlug) {
      const derived = formTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormSlug(derived);
    }
  }, [formTitle, editSlug]);

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditSlug(null);
    setFormTitle("");
    setFormSlug("");
    setFormSnippet("");
    setFormContent("");
    setFormAuthor(userNickname || user?.displayName || "ARES Member");
    setFormThumbnail("https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=60");
    setFormStatus("draft");
    setIsEditorOpen(true);
  };

  // Open editor for editing
  const handleOpenEdit = (post: BlogPost) => {
    setEditSlug(post.slug);
    setFormTitle(post.title);
    setFormSlug(post.slug);
    setFormSnippet(post.snippet);
    setFormContent(post.content);
    setFormAuthor(post.author);
    setFormThumbnail(post.thumbnail);
    setFormStatus(post.status);
    setIsEditorOpen(true);
  };

  // 2. Action: Save Blog Post
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSlug.trim()) return;
    if (!canEdit) return;

    const targetSlug = formSlug.trim();
    const newPost: BlogPost = {
      slug: targetSlug,
      title: formTitle.trim(),
      snippet: formSnippet.trim(),
      content: formContent,
      author: formAuthor.trim(),
      date: new Date().toISOString().split("T")[0],
      thumbnail: formThumbnail.trim(),
      status: formStatus,
      isDeleted: 0
    };

    try {
      await setDoc(doc(db, "posts", targetSlug), newPost);
      setIsEditorOpen(false);
    } catch (err) {
      console.warn("Unable to save post online, updating local array.", err);
      if (editSlug) {
        setPosts(posts.map(p => p.slug === editSlug ? newPost : p));
      } else {
        setPosts([newPost, ...posts]);
      }
      setIsEditorOpen(false);
    }
  };

  // 3. Action: Delete Blog Post
  const handleDeletePost = async (slug: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this blog post? This will move it to trash/archives.")) return;

    try {
      // Soft delete by updating isDeleted
      await setDoc(doc(db, "posts", slug), { isDeleted: 1 }, { merge: true });
    } catch (err) {
      console.warn("Firestore offline, soft-deleting card locally.", err);
      setPosts(posts.filter(p => p.slug !== slug));
    }
  };

  // Filter posts
  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10 w-full">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Engineering Records
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Manage Blogs
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Sandbox
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Draft, edit, and publish technical deep dives and season recap diaries directly to the public team blog feed.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl"
          >
            <Plus size={16} /> New Blog Post
          </button>
        )}
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 rounded-xl text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to publish blog posts.</span>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-black/40 border border-white/10 p-4 rounded-xl">
        <div className="relative flex-grow">
          <Search size={16} className="absolute left-3.5 top-3.5 text-marble/45" />
          <input
            type="text"
            placeholder="Search posts by title, author, or snippet..."
            aria-label="Search posts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-all"
          />
        </div>
        <div className="text-xs font-mono flex items-center justify-end text-marble/60 px-2 uppercase font-semibold">
          {filteredPosts.length} Post{filteredPosts.length !== 1 ? "s" : ""} indexed
        </div>
      </div>

      {/* Blog Posts Index Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.map((post) => (
          <div
            key={post.slug}
            className="glass-card flex flex-col justify-between overflow-hidden border border-white/10 group hover:border-ares-red/40 transition-colors"
          >
            {post.thumbnail && (
              <div className="relative h-44 w-full overflow-hidden bg-black/40 border-b border-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.thumbnail}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 flex gap-2">
                  <span
                    className={`text-[8px] font-black uppercase px-2 py-1 border rounded shadow ${
                      post.status === "published"
                        ? "bg-ares-success/25 border-ares-success/40 text-ares-success"
                        : "bg-ares-gold/25 border-ares-gold/40 text-ares-gold animate-pulse"
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
              </div>
            )}
            
            <div className="p-5 flex-grow flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-marble/50 font-bold uppercase tracking-wider block mb-1">
                  By {post.author} • {post.date}
                </span>
                <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-ares-gold transition-colors font-heading uppercase tracking-tight">
                  {post.title}
                </h3>
                <p className="text-xs text-marble/70 leading-relaxed line-clamp-3 mb-4">{post.snippet}</p>
              </div>

              <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between">
                <Link
                  to={`/blog/${post.slug}`}
                  target="_blank"
                  className="text-[10px] text-ares-cyan hover:text-white uppercase font-bold tracking-widest inline-flex items-center gap-1"
                >
                  View Live <ExternalLink size={10} />
                </Link>

                <div className="flex gap-1.5">
                  {canEdit ? (
                    <>
                      <button
                        onClick={() => handleOpenEdit(post)}
                        className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer"
                        title="Edit Post"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.slug)}
                        className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-red-light border border-white/10 rounded transition-all cursor-pointer"
                        title="Delete Post"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <span className="text-[9px] text-marble/40 uppercase font-black tracking-widest">🔒 Gated</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slide-out / Modal Content Editor Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsEditorOpen(false)}
          />

          {/* Editor Drawer */}
          <div ref={editorRef} tabIndex={-1} className="relative z-10 w-full max-w-3xl h-full bg-obsidian border-l border-white/10 flex flex-col justify-between animate-slide-in shadow-2xl focus:outline-none">
            <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div>
                <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
                  {editSlug ? `Edit Article: ${editSlug}` : "Create New Blog Entry"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Markdown support enabled
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                aria-label="Close editor"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
              >
                <X size={16} />
              </button>
            </header>

            {/* Form Canvas */}
            <form onSubmit={handleSavePost} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="blog-title" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Article Title</label>
                  <input
                    id="blog-title"
                    type="text"
                    placeholder="e.g. Tuning EKF Headings"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-colors"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="blog-slug" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Custom URL Slug</label>
                  <input
                    id="blog-slug"
                    type="text"
                    placeholder="tuning-ekf-headings"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-colors font-mono disabled:opacity-50"
                    disabled={!!editSlug}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="blog-thumbnail" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Thumbnail Image URL</label>
                  <input
                    id="blog-thumbnail"
                    type="url"
                    value={formThumbnail}
                    onChange={(e) => setFormThumbnail(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="blog-author" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Author Name</label>
                  <input
                    id="blog-author"
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="blog-snippet" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Summary Snippet</label>
                <input
                  id="blog-snippet"
                  type="text"
                  placeholder="Summarize the core technical findings or community outcomes in 2-3 sentences..."
                  value={formSnippet}
                  onChange={(e) => setFormSnippet(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col flex-1 h-[250px]">
                <label htmlFor="blog-content" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Body Content (Markdown)</label>
                <textarea
                  id="blog-content"
                  placeholder="### Heading 3\nWrite blog content using standard markdown syntax. Code syntax blocks are supported..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full flex-grow bg-black/60 border border-white/10 rounded px-4 py-3 text-xs text-white font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian h-[200px] resize-none leading-relaxed"
                  required
                />
              </div>

              <div className="bg-black/45 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <label htmlFor="blog-status" className="text-white text-xs font-bold uppercase tracking-wide cursor-pointer">Publish Status</label>
                  <p className="text-[10px] text-marble/60">Drafts are hidden from the public feed</p>
                </div>
                <select
                  id="blog-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2 focus:outline-none focus:border-ares-red cursor-pointer"
                >
                  <option value="draft">🟡 Draft</option>
                  <option value="published">🟢 Published</option>
                </select>
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
                onClick={handleSavePost}
                className="clipped-button-sm bg-ares-red text-white font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg"
              >
                {editSlug ? "Update Entry" : "Publish Entry"}
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
