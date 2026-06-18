"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, getDoc, getDocs, addDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Shield, 
  Activity, 
  Search, 
  ExternalLink, 
  X, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  History, 
  Check, 
  AlertCircle, 
  Image as ImageIcon 
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import { authenticatedFetch } from "@/lib/api";
import { cleanThumbnailUrl } from "@/lib/utils";

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
  authorUid?: string;
  authorAvatar?: string;
  authorUids?: string[];
}

interface Revision {
  id: string;
  title: string;
  snippet: string;
  content: string;
  thumbnail: string;
  status: "draft" | "published";
  editedBy: string;
  editedByName: string;
  editedByAvatar: string;
  timestamp: string;
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

export default function BlogManagementPage({
  editorOnly = false,
  onEditorClose,
  prefilledAction,
  prefilledSlug
}: {
  editorOnly?: boolean;
  onEditorClose?: () => void;
  prefilledAction?: "create" | "edit" | null;
  prefilledSlug?: string | null;
} = {}) {
  const { user, authorizedUser } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>(MOCK_POSTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userNickname, setUserNickname] = useState("");
  
  // Editor Drawer States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(true);
  
  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSnippet, setFormSnippet] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formThumbnail, setFormThumbnail] = useState("");
  const [formStatus, setFormStatus] = useState<"draft" | "published">("draft");

  // Revisions & Modal Picker States
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);

  // Team Roster & Multi-Author States
  const [teamMembers, setTeamMembers] = useState<{ uid: string; nickname: string; avatar: string; }[]>([]);
  const [selectedAuthorUids, setSelectedAuthorUids] = useState<string[]>([]);
  const [isAuthorDropdownOpen, setIsAuthorDropdownOpen] = useState(false);

  // AI Copilot States
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    onEditorClose?.();
  };

  const editorRef = useFocusTrap(isEditorOpen, handleCloseEditor);

  // Fetch team roster for author selection
  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const res = await authenticatedFetch("/api/profiles/team-roster");
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(data.members || []);
        }
      } catch (err) {
        console.error("Failed to load team roster:", err);
      }
    };
    fetchRoster();
  }, []);

  // Fetch full user profile for avatar and nickname
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const userProfileRef = doc(db, "user_profiles", user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        if (userProfileSnap.exists()) {
          const profileData = userProfileSnap.data();
          setUserProfile(profileData);
          if (profileData.nickname) {
            setUserNickname(profileData.nickname);
          }
        }
      } catch (err) {
        console.warn("Could not retrieve user profile:", err);
      }
    };
    fetchProfile();
  }, [user]);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // Listen for real-time blog post updates
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
                thumbnail: cleanThumbnailUrl(data.thumbnail || ""),
                status: data.status || "draft",
                isDeleted: data.isDeleted || 0,
                authorUid: data.authorUid || "",
                authorAvatar: data.authorAvatar || "",
                authorUids: data.authorUids || []
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

  // Handle opening create or edit modal via query parameters or props
  useEffect(() => {
    if (editorOnly) {
      if (prefilledAction === "create") {
        handleOpenCreate();
      } else if (prefilledAction === "edit" && prefilledSlug) {
        const post = posts.find((p) => p.slug === prefilledSlug);
        if (post) {
          handleOpenEdit(post);
        }
      }
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "create") {
      handleOpenCreate();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [editorOnly, prefilledAction, prefilledSlug, posts]);

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

  // Fetch revisions when tab shifts or post selected
  useEffect(() => {
    if (activeTab === "revisions" && editSlug) {
      fetchRevisionsList();
    }
  }, [activeTab, editSlug]);

  const fetchRevisionsList = async () => {
    if (!editSlug) return;
    setLoadingRevisions(true);
    try {
      const q = query(collection(db, "posts", editSlug, "revisions"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Revision[];
      setRevisions(list);
    } catch (err) {
      console.warn("Could not load revision logs:", err);
    } finally {
      setLoadingRevisions(false);
    }
  };

  // Open editor for creating
  const handleOpenCreate = () => {
    setEditSlug(null);
    setFormTitle("");
    setFormSlug("");
    setFormSnippet("");
    setFormContent("");
    setFormAuthor(userNickname || "ARES Member");
    setSelectedAuthorUids(user ? [user.uid] : []);
    setIsAuthorDropdownOpen(false);
    setFormThumbnail("");
    setFormStatus("draft");
    setRevisions([]);
    setRevertAlert(null);
    setGrammarEdits([]);
    setAiResponse("");
    setActiveTab("edit");
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
    if (post.authorUids && post.authorUids.length > 0) {
      setSelectedAuthorUids(post.authorUids);
    } else if (post.authorUid) {
      setSelectedAuthorUids([post.authorUid]);
    } else {
      const matchingMember = teamMembers.find(
        (m) => m.nickname.toLowerCase() === post.author.toLowerCase()
      );
      setSelectedAuthorUids(matchingMember ? [matchingMember.uid] : []);
    }
    setIsAuthorDropdownOpen(false);
    setFormThumbnail(post.thumbnail);
    setFormStatus(post.status);
    setRevisions([]);
    setRevertAlert(null);
    setGrammarEdits([]);
    setAiResponse("");
    setActiveTab("edit");
    setIsEditorOpen(true);
  };

  // Action: Save Blog Post & revision
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSlug.trim()) return;
    if (!canEdit) return;

    const targetSlug = formSlug.trim();
    const currentEditorId = user?.uid;
    const uidsToSave = [...selectedAuthorUids];
    if (currentEditorId && !uidsToSave.includes(currentEditorId)) {
      uidsToSave.push(currentEditorId);
    }

    const namesToSave = uidsToSave.map((uid) => {
      const match = teamMembers.find((m) => m.uid === uid);
      if (match) return match.nickname;
      if (uid === user?.uid) {
        return userNickname || authorizedUser?.name || user?.displayName || "ARES Member";
      }
      return "ARES Member";
    });
    const finalAuthorString = Array.from(new Set(namesToSave)).filter(Boolean).join(", ") || "ARES Member";

    let finalAvatar = "";
    if (uidsToSave.length > 0) {
      const firstAuthor = teamMembers.find((m) => m.uid === uidsToSave[0]);
      if (firstAuthor) {
        finalAvatar = firstAuthor.avatar;
      } else if (uidsToSave[0] === user?.uid) {
        finalAvatar = userProfile?.avatar || user?.photoURL || "";
      }
    }
    if (!finalAvatar) {
      finalAvatar = userProfile?.avatar || user?.photoURL || "";
    }

    const currentAvatar = userProfile?.avatar || user?.photoURL || "";
    const currentAuthorName = userNickname || authorizedUser?.name || user?.displayName || formAuthor || "ARES Member";

    const newPost: BlogPost = {
      slug: targetSlug,
      title: formTitle.trim(),
      snippet: formSnippet.trim(),
      content: formContent,
      author: finalAuthorString,
      date: new Date().toISOString().split("T")[0],
      thumbnail: formThumbnail.trim(),
      status: formStatus,
      isDeleted: 0,
      authorUid: uidsToSave[0] || user?.uid || "",
      authorAvatar: finalAvatar,
      authorUids: uidsToSave
    };

    try {
      await setDoc(doc(db, "posts", targetSlug), newPost);

      // Append revision subcollection entry
      await addDoc(collection(db, "posts", targetSlug, "revisions"), {
        title: formTitle.trim(),
        snippet: formSnippet.trim(),
        content: formContent,
        thumbnail: formThumbnail.trim(),
        status: formStatus,
        editedBy: user?.uid || "",
        editedByName: currentAuthorName,
        editedByAvatar: currentAvatar,
        timestamp: new Date().toISOString()
      });

      handleCloseEditor();
    } catch (err) {
      console.warn("Unable to save post online, updating local array.", err);
      if (editSlug) {
        setPosts(posts.map(p => p.slug === editSlug ? newPost : p));
      } else {
        setPosts([newPost, ...posts]);
      }
      handleCloseEditor();
    }
  };

  // Action: Revert Form States to Selected Revision
  const handleRevertToRevision = (revision: Revision) => {
    setFormTitle(revision.title);
    setFormSnippet(revision.snippet);
    setFormContent(revision.content);
    setFormThumbnail(cleanThumbnailUrl(revision.thumbnail));
    setFormStatus(revision.status);
    setRevertAlert(`Restored contents from revision (${new Date(revision.timestamp).toLocaleString()})! Click "Update Entry" below to commit these changes.`);
    setActiveTab("edit");
  };

  // Action: Delete Blog Post
  const handleDeletePost = async (slug: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this blog post? This will move it to trash/archives.")) return;

    try {
      await setDoc(doc(db, "posts", slug), { isDeleted: 1 }, { merge: true });
    } catch (err) {
      console.warn("Firestore offline, soft-deleting card locally.", err);
      setPosts(posts.filter(p => p.slug !== slug));
    }
  };

  // AI Assistant Call
  const handleAiAssistant = async (prompt: string, presetName = "") => {
    if (!prompt.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const res = await authenticatedFetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: presetName ? `${presetName}: ${prompt}` : prompt,
          text: formContent,
          context: `Title: ${formTitle}\nSnippet: ${formSnippet}`
        })
      });

      if (!res.ok) throw new Error("AI Assistant service error.");
      const data = await res.json();
      setAiResponse(data.response || "");
    } catch (err: any) {
      setAiResponse(`Failed to contact Gemini co-pilot: ${err.message}. Using offline fallback.\n\nOur team is committed to implementing robust code structures inside FIRST® programs. By using ARESLib, we maintain clean state machines and accurate sensor integrations.`);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Grammar & Spelling Check
  const handleGrammarCheck = async () => {
    if (!formContent.trim()) return;
    setAiLoading(true);
    setGrammarEdits([]);
    setSuggestedCorrection("");
    try {
      const res = await authenticatedFetch("/api/ai/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formContent })
      });

      if (!res.ok) throw new Error("AI Grammar check service error.");
      const data = await res.json();
      setSuggestedCorrection(data.correctedText || "");
      setGrammarEdits(data.edits || []);
    } catch (err: any) {
      console.warn(err);
      // Simple offline fallback notice
      setSuggestedCorrection(formContent);
      setGrammarEdits([{ original: "offline check", corrected: "online check", explanation: "Connect to live sync to get full Gemini spelling check." }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter posts
  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ensure the logged-in user is always present in the displayed checklist
  const displayedMembers = [...teamMembers];
  if (user && !displayedMembers.some((m) => m.uid === user.uid)) {
    displayedMembers.unshift({
      uid: user.uid,
      nickname: userNickname || authorizedUser?.name || user.displayName || "ARES Member",
      avatar: userProfile?.avatar || user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`
    });
  }

  return (
    <>
      {!editorOnly && (
        <div className="space-y-10 w-full text-left">
      
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
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl animate-fade-in"
          >
            <Plus size={16} /> New Blog Post
          </button>
        )}
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to publish blog posts.</span>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-black/40 border border-white/10 p-4 ares-cut">
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
        {filteredPosts.map((post) => {
          const authorAvatar = post.authorAvatar;
          const authorAvatarUrl = authorAvatar
            ? (authorAvatar.startsWith("http") || authorAvatar.includes("/")
                ? authorAvatar
                : `https://api.dicebear.com/7.x/bottts/svg?seed=${authorAvatar}`)
            : `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author || post.slug}`;

          return (
            <div
              key={post.slug}
              className="glass-card hero-card flex flex-col justify-between overflow-hidden border border-white/10 group"
            >
              <div className="relative h-44 w-full overflow-hidden bg-black/40 border-b border-white/5 flex items-center justify-center">
                <img
                  src={cleanThumbnailUrl(post.thumbnail || "/favicon.png")}
                  alt={post.title}
                  className={post.thumbnail ? "w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" : "w-12 h-12 object-contain opacity-25 group-hover:scale-110 transition-transform duration-300 m-auto"}
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
              
              <div className="p-5 flex-grow flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <img
                      src={authorAvatarUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover border border-white/10"
                    />
                    <span className="text-[10px] text-marble/50 font-bold uppercase tracking-wider">
                      By {post.author} • {post.date}
                    </span>
                  </div>
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
          );
        })}
      </div>
      </div>
    )}

      {/* Upgraded Expandable Slide-out / Modal Content Editor Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={handleCloseEditor}
          />

          {/* Editor Drawer container */}
          <div 
            ref={editorRef} 
            tabIndex={-1} 
            className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 ${
              isFullScreen ? "w-full max-w-full" : "w-full max-w-5xl"
            }`}
          >
            {/* Header */}
            <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
              <div>
                <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
                  {editSlug ? `Edit Article: ${editSlug}` : "Create New Blog Entry"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Markdown support enabled
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Full screen toggle */}
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  title={isFullScreen ? "Minimize Editor" : "Maximize Editor"}
                >
                  {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                {/* Close */}
                <button
                  onClick={handleCloseEditor}
                  aria-label="Close editor"
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {/* Sub-Header: Tabs Switcher */}
            <div className="px-6 border-b border-white/5 bg-black/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    activeTab === "edit" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
                  }`}
                >
                  ✏️ Edit Article
                </button>
                {editSlug && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("revisions")}
                    className={`py-3 border-b-2 transition-all cursor-pointer ${
                      activeTab === "revisions" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
                    }`}
                  >
                    📜 Revision History
                  </button>
                )}
              </div>
              
              {activeTab === "edit" && (
                <button
                  type="button"
                  onClick={() => setShowAiSidebar(!showAiSidebar)}
                  className={`py-1.5 px-3 border rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] ${
                    showAiSidebar 
                      ? "border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan" 
                      : "border-white/10 hover:border-white/25 text-marble/60 hover:text-white"
                  }`}
                >
                  <Sparkles size={11} className={aiLoading ? "animate-spin" : ""} />
                  {showAiSidebar ? "Hide AI Copilot" : "Show AI Copilot"}
                </button>
              )}
            </div>

            {/* Revert Alert banner */}
            {revertAlert && activeTab === "edit" && (
              <div className="px-6 py-3.5 bg-ares-gold/10 border-b border-ares-gold/20 text-ares-gold text-xs font-semibold flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{revertAlert}</span>
                </div>
                <button onClick={() => setRevertAlert(null)} className="text-ares-gold hover:text-white cursor-pointer font-bold text-[10px] uppercase">
                  Dismiss
                </button>
              </div>
            )}

            {/* Content canvas - changes depending on active tab */}
            <div className="flex-1 overflow-hidden bg-black/10 p-6 flex flex-col">
              
              {/* Tab 1: EDIT FORM */}
              {activeTab === "edit" && (
                <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                  <form
                    onSubmit={handleSavePost}
                    className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
                      showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
                    }`}
                  >
                  <div className="space-y-6">
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
                      
                      {/* Thumbnail Picker */}
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Thumbnail Image</label>
                        {formThumbnail ? (
                          <div className="relative w-full h-[120px] rounded-lg border border-white/15 overflow-hidden group/thumb bg-black/40">
                            <img
                              src={cleanThumbnailUrl(formThumbnail)}
                              alt="Thumbnail Preview"
                              className="w-full h-full object-cover opacity-90 group-hover/thumb:opacity-75 transition-opacity"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/35">
                              <button
                                type="button"
                                onClick={() => setIsPhotoPickerOpen(true)}
                                className="px-3.5 py-1.5 bg-white text-black font-black uppercase tracking-widest text-[9px] ares-cut-sm cursor-pointer shadow-lg hover:bg-ares-gold transition-colors"
                              >
                                Crop / Replace
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => setIsPhotoPickerOpen(true)}
                            className="w-full h-[120px] rounded-lg border-2 border-dashed border-white/10 hover:border-ares-red/40 bg-black/35 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                          >
                            <ImageIcon size={20} className="text-marble/40" />
                            <span className="text-[10px] font-extrabold uppercase text-marble/60 tracking-wider">
                              + Add & Crop Thumbnail
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Author(s)</label>
                        <button
                          type="button"
                          onClick={() => setIsAuthorDropdownOpen(!isAuthorDropdownOpen)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-all cursor-pointer text-left h-10"
                        >
                          <span className="truncate">
                            {selectedAuthorUids.length === 0
                              ? "Select Author(s)..."
                              : selectedAuthorUids
                                  .map((uid) => displayedMembers.find((m) => m.uid === uid)?.nickname || "Unknown")
                                  .filter(Boolean)
                                  .join(", ")}
                          </span>
                          <span className="text-marble/40 ml-2 select-none">▼</span>
                        </button>

                        {isAuthorDropdownOpen && (
                          <>
                            {/* Backdrop to close dropdown */}
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setIsAuthorDropdownOpen(false)}
                            />
                            <div className="absolute left-0 right-0 mt-1.5 bg-obsidian border border-white/15 rounded-lg shadow-2xl max-h-56 overflow-y-auto z-20 p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/5">
                              {displayedMembers.map((member) => {
                                const isChecked = selectedAuthorUids.includes(member.uid);
                                return (
                                  <label
                                    key={member.uid}
                                    className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-white/5 rounded-md cursor-pointer transition-colors text-xs text-marble/90 hover:text-white select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedAuthorUids(selectedAuthorUids.filter((id) => id !== member.uid));
                                        } else {
                                          setSelectedAuthorUids([...selectedAuthorUids, member.uid]);
                                        }
                                      }}
                                      className="rounded border-white/10 text-ares-red focus:ring-ares-red bg-black/40 cursor-pointer w-4 h-4"
                                    />
                                    <img
                                      src={member.avatar}
                                      alt=""
                                      className="w-5 h-5 rounded-full object-cover border border-white/5"
                                    />
                                    <span className="font-semibold">{member.nickname}</span>
                                    {member.uid === user?.uid && (
                                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-ares-gold bg-ares-gold/15 px-1.5 py-0.5 rounded border border-ares-gold/25 ml-auto">
                                        You
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                              {displayedMembers.length === 0 && (
                                <div className="text-center py-4 text-[10px] text-marble/40 uppercase tracking-wider">
                                  No members found
                                </div>
                              )}
                            </div>
                          </>
                        )}
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
                        className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-red focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian transition-colors mb-4"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor="blog-content" className="block text-[10px] font-bold uppercase tracking-wider text-marble/60">Article Body</label>
                      </div>
                      <MarkdownEditor
                        id="blog-content"
                        placeholder={`### Heading 3\nWrite blog content using standard markdown syntax. Code syntax blocks are supported...`}
                        value={formContent}
                        onChange={setFormContent}
                        className={isFullScreen ? "h-[360px] md:h-[450px]" : "h-[250px] md:h-[300px]"}
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
                    </div>
                  </form>

                  {showAiSidebar && (
                    <div className="hidden lg:flex lg:w-[30%] bg-black/30 border border-white/15 rounded-xl p-4 flex-col gap-4 overflow-y-auto shrink-0 select-none scrollbar-thin scrollbar-thumb-white/5">
                      {/* Section 1: Spelling & Grammar Checker */}
                      <div className="space-y-4">
                        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2 mb-1.5">
                            <Sparkles size={11} /> Spelling & Grammar
                          </h4>
                          <p className="text-[9px] text-marble/60 leading-normal mb-2.5">
                            Gemini will scan the current editor contents for spelling errors and technical tone issues.
                          </p>
                          <button
                            type="button"
                            onClick={handleGrammarCheck}
                            disabled={aiLoading || !formContent}
                            className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40"
                          >
                            {aiLoading ? "Checking..." : "Verify Spelling & Grammar"}
                          </button>
                        </div>

                        {/* Section 2: AI Writer Prompts */}
                        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg flex flex-col gap-2.5">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-cyan flex items-center gap-2">
                            <Sparkles size={11} /> AI Writer Prompts
                          </h4>
                          
                          <textarea
                            placeholder="Tell Gemini what to write, expand, or adjust..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="w-full h-16 bg-black/60 border border-white/10 rounded p-2.5 text-xs text-white placeholder:text-marble/25 focus:outline-none focus:border-ares-cyan font-mono leading-relaxed resize-none"
                          />

                          {/* Presets Grid */}
                          <div className="grid grid-cols-2 gap-1.5 text-[8px] font-black uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Rewrite the content to make it sound more professional and academic.", "Improve Writing")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer"
                            >
                              💼 Professional
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Expand this article, adding more technical details about odometry calculations and loop timers.", "Expand Content")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer"
                            >
                              ➕ Expand
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Summarize the entire article, extracting key highlights suitable for a 2-sentence snippet.", "Summarize")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer"
                            >
                              ✂️ Summarize
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant(aiPrompt)}
                              disabled={aiLoading || !aiPrompt.trim()}
                              className="p-1.5 bg-ares-cyan text-black hover:brightness-110 rounded text-center transition-all cursor-pointer font-bold disabled:opacity-40"
                            >
                              🚀 Ask AI
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Output Sandbox */}
                      <div className="bg-black/30 border border-white/10 rounded-lg p-3.5 flex flex-col justify-between overflow-hidden min-h-[200px] flex-grow">
                        <div className="flex-grow overflow-y-auto pr-0.5 space-y-3.5 scrollbar-thin scrollbar-thumb-white/5">
                          <h4 className="text-[9px] font-bold uppercase tracking-wider text-marble/55">
                            Copilot Sandbox Output
                          </h4>

                          {aiLoading && (
                            <div className="flex flex-col items-center justify-center py-12 gap-2.5">
                              <span className="w-5 h-5 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                              <span className="text-[9px] text-marble/55 uppercase font-mono tracking-wider animate-pulse">
                                Brainstorming...
                              </span>
                            </div>
                          )}

                          {/* Render spelling corrections */}
                          {!aiLoading && grammarEdits.length > 0 && (
                            <div className="space-y-3">
                              <div className="p-2.5 bg-ares-gold/10 border border-ares-gold/20 text-ares-gold rounded text-[10px] leading-normal font-semibold">
                                Review corrections. Click <strong>Apply Correction</strong> below to insert.
                              </div>
                              
                              <div className="space-y-2">
                                {grammarEdits.map((edit, idx) => (
                                  <div key={idx} className="bg-black/45 border border-white/5 p-2 rounded text-[10px] leading-relaxed">
                                    <div className="flex flex-wrap gap-1 items-center mb-1 text-[8px] font-black uppercase tracking-wider">
                                      <span className="bg-ares-red/25 text-ares-red border border-ares-red/35 px-1 py-0.5 rounded line-through">
                                        {edit.original}
                                      </span>
                                      <span className="text-marble/55">➜</span>
                                      <span className="bg-ares-success/25 text-ares-success border border-ares-success/35 px-1 py-0.5 rounded">
                                        {edit.corrected}
                                      </span>
                                    </div>
                                    <p className="text-marble/75 mt-0.5">{edit.explanation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Render assistant text */}
                          {!aiLoading && aiResponse && (
                            <div className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap text-marble bg-black/45 border border-white/5 p-3 rounded-lg overflow-x-auto">
                              {aiResponse}
                            </div>
                          )}

                          {!aiLoading && !aiResponse && grammarEdits.length === 0 && (
                            <div className="py-16 text-center text-[9px] font-mono text-marble/30 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                              Output empty
                            </div>
                          )}
                        </div>

                        {/* Action buttons for outputs */}
                        {!aiLoading && (aiResponse || suggestedCorrection) && (
                          <div className="border-t border-white/5 pt-3 mt-3 flex flex-col gap-2 shrink-0">
                            {suggestedCorrection && grammarEdits.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormContent(suggestedCorrection);
                                  setGrammarEdits([]);
                                  setSuggestedCorrection("");
                                  setRevertAlert("Applied grammar and spelling corrections to the draft!");
                                }}
                                className="w-full py-2.5 bg-ares-success text-white font-black uppercase tracking-widest text-[9px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all"
                              >
                                Apply Correction
                              </button>
                            )}
                            {aiResponse && (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormContent(aiResponse);
                                    setAiResponse("");
                                    setRevertAlert("Replaced draft with Gemini generated text!");
                                  }}
                                  className="py-2.5 bg-ares-cyan text-black font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all"
                                >
                                  Replace Draft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormContent(formContent + "\n\n" + aiResponse);
                                    setAiResponse("");
                                    setRevertAlert("Appended Gemini response to draft!");
                                  }}
                                  className="py-2.5 bg-white/5 border border-white/15 text-white font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:bg-white/10 transition-all"
                                >
                                  Append to Draft
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: REVISIONS LOGS */}
              {activeTab === "revisions" && (
                <div className="flex-grow space-y-4 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    Past Revisions ({revisions.length})
                  </h4>

                  {loadingRevisions ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                      <span className="w-6 h-6 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                      <span className="text-[10px] text-marble/55">Loading revision history...</span>
                    </div>
                  ) : revisions.length === 0 ? (
                    <div className="py-16 text-center text-xs font-mono text-marble/45 border border-dashed border-white/10 rounded-lg bg-black/15">
                      No past revision logs recorded.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {revisions.map((rev) => {
                        const avatar = rev.editedByAvatar;
                        const avatarUrl = avatar
                          ? (avatar.startsWith("http") || avatar.includes("/") ? avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${avatar}`)
                          : `https://api.dicebear.com/7.x/bottts/svg?seed=${rev.editedByName}`;

                        return (
                          <div
                            key={rev.id}
                            className="bg-black/25 hover:bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={avatarUrl}
                                alt=""
                                className="w-8 h-8 rounded-full border border-white/10 shrink-0"
                              />
                              <div>
                                <span className="text-xs font-extrabold text-white block uppercase tracking-tight">
                                  {rev.editedByName}
                                </span>
                                <span className="text-[10px] text-marble/50 font-mono">
                                  {new Date(rev.timestamp).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 border rounded ${
                                rev.status === "published" ? "bg-ares-success/15 border-ares-success/30 text-ares-success" : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                              }`}>
                                {rev.status}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRevertToRevision(rev)}
                                className="px-3 py-1 bg-white/5 border border-white/15 text-white hover:text-black hover:bg-ares-gold transition-colors font-bold text-[10px] uppercase ares-cut-sm cursor-pointer"
                              >
                                Revert
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer */}
            {activeTab === "edit" && (
              <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseEditor}
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
            )}
          </div>
        </div>
      )}

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onSelect={(url) => setFormThumbnail(url)}
      />

    </>
  );
}
