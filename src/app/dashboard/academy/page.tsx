"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Shield, 
  Activity, 
  FileText, 
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  AlertCircle,
  GraduationCap
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";
import { authenticatedFetch } from "@/lib/api";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";

interface DocRecord {
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  isDeleted: number;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  updatedAt?: string;
  original_authorNickname?: string;
  original_authorAvatar?: string;
}

interface DocRevision {
  id: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  editedBy: string;
  editedByName: string;
  editedByAvatar: string;
  timestamp: string;
}

const ACADEMY_CATEGORIES = [
  "AI 101",
  "Neural Networks",
  "Machine Vision",
  "Reinforcement Learning",
  "Generative AI",
  "Physics",
  "Mathematics",
  "Science of Climbing",
  "Science of Outdoor Sports"
];

export default function AcademyManagementPage() {
  const { user, authorizedUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editSlugQuery = searchParams.get("edit");

  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCategory, setFormCategory] = useState("AI 101");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState("");
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formStatus, setFormStatus] = useState("draft");

  // Display destination flags - default Math Corner to true for Academy Manager
  const [formDisplayInAreslib, setFormDisplayInAreslib] = useState(false);
  const [formDisplayInMathCorner, setFormDisplayInMathCorner] = useState(true);
  const [formDisplayInScienceCorner, setFormDisplayInScienceCorner] = useState(false);
  const [formIsPortfolio, setFormIsPortfolio] = useState(false);
  const [formIsExecutiveSummary, setFormIsExecutiveSummary] = useState(false);

  // Modal upgrades
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);

  // Identity and Revisions states
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userNickname, setUserNickname] = useState("");
  const [revisions, setRevisions] = useState<DocRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // AI Copilot States
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  const editorRef = useFocusTrap(isEditorOpen, () => handleCloseEditor());

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for real-time docs updates (Filtered for Academy context)
  useEffect(() => {
    try {
      const docsRef = collection(db, "docs");
      const unsubscribe = onSnapshot(
        docsRef,
        (snapshot) => {
          if (snapshot.empty) {
            setDocs([]);
            setIsLive(false);
            setLoadingList(false);
            return;
          }
          const list = snapshot.docs
            .map((docSnap) => {
              const data = docSnap.data();
              return {
                slug: docSnap.id,
                title: data.title || "Untitled Lesson",
                category: data.category || "General",
                sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
                description: data.description || "",
                content: data.content || "",
                status: data.status || "draft",
                isDeleted: typeof data.isDeleted === "number" ? data.isDeleted : 0,
                displayInAreslib: typeof data.displayInAreslib === "number" ? data.displayInAreslib : 0,
                displayInMathCorner: typeof data.displayInMathCorner === "number" ? data.displayInMathCorner : 0,
                displayInScienceCorner: typeof data.displayInScienceCorner === "number" ? data.displayInScienceCorner : 0,
                isPortfolio: typeof data.isPortfolio === "number" ? data.isPortfolio : 0,
                isExecutiveSummary: typeof data.isExecutiveSummary === "number" ? data.isExecutiveSummary : 0,
                updatedAt: data.updatedAt || new Date().toISOString(),
                original_authorNickname: data.original_authorNickname || "",
                original_authorAvatar: data.original_authorAvatar || ""
              } as DocRecord;
            })
            .filter((d) => d.isDeleted !== 1 && (d.displayInMathCorner === 1 || d.displayInScienceCorner === 1));

          setDocs(list);
          setIsLive(true);
          setLoadingList(false);
        },
        (err) => {
          console.warn("Firestore access error, standard fallback loaded.", err.message);
          setDocs([]);
          setIsLive(false);
          setLoadingList(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local offline sandbox mode loaded.", e);
      setDocs([]);
      setIsLive(false);
      setLoadingList(false);
    }
  }, []);

  // Fetch user profile for nickname and avatar
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

  // Fetch revisions list
  useEffect(() => {
    if (activeTab === "revisions" && editSlug) {
      fetchRevisionsList();
    }
  }, [activeTab, editSlug]);

  const fetchRevisionsList = async () => {
    if (!editSlug) return;
    setLoadingRevisions(true);
    try {
      const q = query(
        collection(db, "docs", editSlug, "revisions"),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as DocRevision[];
      setRevisions(list);
    } catch (err) {
      console.warn("Could not load revision logs:", err);
    } finally {
      setLoadingRevisions(false);
    }
  };

  // Auto-slug sync helper for new articles
  useEffect(() => {
    if (!editSlug) {
      const derived = formTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormSlug(derived);
    }
  }, [formTitle, editSlug]);

  // Auto-load drawer based on query parameter
  useEffect(() => {
    if (editSlugQuery && docs.length > 0 && !isEditorOpen) {
      const found = docs.find(d => d.slug === editSlugQuery);
      if (found) {
        handleOpenEdit(found);
      }
    }
  }, [editSlugQuery, docs]);

  const handleOpenCreate = () => {
    setEditSlug(null);
    setFormTitle("");
    setFormSlug("");
    setFormCategory("AI 101");
    setIsCustomCategory(false);
    setCustomCategoryText("");
    setFormSortOrder(1);
    setFormDescription("");
    setFormContent("");
    setFormStatus("draft");
    setFormDisplayInAreslib(false);
    setFormDisplayInMathCorner(true);
    setFormDisplayInScienceCorner(false);
    setFormIsPortfolio(false);
    setFormIsExecutiveSummary(false);

    // Reset modals
    setIsFullScreen(false);
    setActiveTab("edit");
    setShowAiSidebar(false);
    setRevertAlert(null);
    setGrammarEdits([]);
    setAiResponse("");
    setRevisions([]);

    setIsEditorOpen(true);
  };

  const handleOpenEdit = (docItem: DocRecord) => {
    setEditSlug(docItem.slug);
    setFormTitle(docItem.title);
    setFormSlug(docItem.slug);
    
    // Check if category is standard
    if (ACADEMY_CATEGORIES.includes(docItem.category)) {
      setFormCategory(docItem.category);
      setIsCustomCategory(false);
      setCustomCategoryText("");
    } else {
      setFormCategory("custom");
      setIsCustomCategory(true);
      setCustomCategoryText(docItem.category);
    }

    setFormSortOrder(docItem.sortOrder);
    setFormDescription(docItem.description);
    setFormContent(docItem.content);
    setFormStatus(docItem.status);
    setFormDisplayInAreslib(docItem.displayInAreslib === 1);
    setFormDisplayInMathCorner(docItem.displayInMathCorner === 1);
    setFormDisplayInScienceCorner(docItem.displayInScienceCorner === 1);
    setFormIsPortfolio(docItem.isPortfolio === 1);
    setFormIsExecutiveSummary(docItem.isExecutiveSummary === 1);

    // Reset modals
    setIsFullScreen(false);
    setActiveTab("edit");
    setShowAiSidebar(false);
    setRevertAlert(null);
    setGrammarEdits([]);
    setAiResponse("");
    setRevisions([]);

    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    if (searchParams.has("edit")) {
      searchParams.delete("edit");
      setSearchParams(searchParams);
    }
  };

  // Action: Save Document
  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSlug.trim()) return;
    if (!canEdit) return;

    const finalCategory = isCustomCategory ? customCategoryText.trim() : formCategory;
    if (!finalCategory) {
      alert("Please specify a category.");
      return;
    }

    const targetSlug = formSlug.trim();
    const payload: Omit<DocRecord, "slug"> = {
      title: formTitle.trim(),
      category: finalCategory,
      sortOrder: Number(formSortOrder) || 0,
      description: formDescription.trim(),
      content: formContent.trim(),
      status: formStatus,
      isDeleted: 0,
      displayInAreslib: formDisplayInAreslib ? 1 : 0,
      displayInMathCorner: formDisplayInMathCorner ? 1 : 0,
      displayInScienceCorner: formDisplayInScienceCorner ? 1 : 0,
      isPortfolio: formIsPortfolio ? 1 : 0,
      isExecutiveSummary: formIsExecutiveSummary ? 1 : 0,
      updatedAt: new Date().toISOString(),
      original_authorNickname: userNickname || user?.displayName || "Anonymous Member",
      original_authorAvatar: userProfile?.avatar || user?.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user?.uid || "default"}`
    };

    try {
      await setDoc(doc(db, "docs", targetSlug), payload);

      // Save Revision Document
      if (user) {
        const revId = `rev_${Date.now()}`;
        const revisionData: DocRevision = {
          id: revId,
          title: payload.title,
          description: payload.description,
          content: payload.content,
          category: payload.category,
          sortOrder: payload.sortOrder,
          status: payload.status,
          displayInAreslib: payload.displayInAreslib,
          displayInMathCorner: payload.displayInMathCorner,
          displayInScienceCorner: payload.displayInScienceCorner,
          isPortfolio: payload.isPortfolio,
          isExecutiveSummary: payload.isExecutiveSummary,
          editedBy: user.uid,
          editedByName: userNickname || user.displayName || "Anonymous Member",
          editedByAvatar: userProfile?.avatar || user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`,
          timestamp: new Date().toISOString()
        };
        await setDoc(doc(db, "docs", targetSlug, "revisions", revId), revisionData);
      }

      handleCloseEditor();
    } catch (err) {
      console.warn("Unable to save document online.", err);
      alert("Firestore offline/insufficient permissions. Unable to save.");
    }
  };

  // Action: Soft Delete
  const handleDeleteDoc = async (slug: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this lesson?")) return;

    try {
      await updateDoc(doc(db, "docs", slug), {
        isDeleted: 1,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Firestore delete failed. Using fallback.", err);
      alert("Unable to delete entry. Check connections.");
    }
  };

  // Action: Revert To Revision
  const handleRevertToRevision = (rev: DocRevision) => {
    setFormTitle(rev.title);
    setFormDescription(rev.description || "");
    setFormContent(rev.content || "");
    
    if (ACADEMY_CATEGORIES.includes(rev.category)) {
      setFormCategory(rev.category);
      setIsCustomCategory(false);
      setCustomCategoryText("");
    } else {
      setFormCategory("custom");
      setIsCustomCategory(true);
      setCustomCategoryText(rev.category);
    }

    setFormSortOrder(rev.sortOrder || 0);
    setFormStatus(rev.status || "draft");
    setFormDisplayInAreslib(rev.displayInAreslib === 1);
    setFormDisplayInMathCorner(rev.displayInMathCorner === 1);
    setFormDisplayInScienceCorner(rev.displayInScienceCorner === 1);
    setFormIsPortfolio(rev.isPortfolio === 1);
    setFormIsExecutiveSummary(rev.isExecutiveSummary === 1);

    setRevertAlert(`Reverted unsaved draft to revision from ${new Date(rev.timestamp).toLocaleString()}. Click Update Entry to commit changes.`);
    setActiveTab("edit");
  };

  // AI Copilot: Assistant prompt
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
          context: `Lesson Title: ${formTitle}\nCategory: ${isCustomCategory ? customCategoryText : formCategory}`
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

  // AI Copilot: Grammar check
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
      setSuggestedCorrection(formContent);
      setGrammarEdits([{ original: "offline check", corrected: "online check", explanation: "Connect to live sync to get full Gemini spelling check." }]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-10 w-full text-left">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Content Manager
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Academy Manager
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
            Author and publish *FIRST*® robotics lessons, mathematical equations, and science guides.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <Plus size={16} /> New Lesson
          </button>
        )}
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify the academy docs database.</span>
        </div>
      )}

      {/* Docs Inventory Table */}
      <div className="glass-card border border-white/10 ares-cut-lg overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center text-xs font-black uppercase text-ares-gold tracking-widest">
          <span>Active Academy Content</span>
          <span>{loadingList ? "Loading..." : `${docs.length} Lessons`}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-marble/40 uppercase font-black tracking-widest text-[9px] bg-black/5">
                <th className="p-4">Lesson / Article</th>
                <th className="p-4">Category</th>
                <th className="p-4">Order</th>
                <th className="p-4">Destinations</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-black/10">
              {loadingList ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-marble/40 font-mono">
                    Syncing lessons indices...
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-marble/40 font-mono">
                    No articles indexed. Create a new lesson to get started.
                  </td>
                </tr>
              ) : (
                docs.map((docItem) => {
                  const isPublished = docItem.status === "published";
                  
                  return (
                    <tr key={docItem.slug} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 max-w-sm">
                        <div className="flex gap-3">
                          <FileText className="text-ares-gold shrink-0 mt-0.5" size={16} />
                          <div>
                            <p className="font-extrabold text-white text-sm tracking-tight">{docItem.title}</p>
                            <p className="text-[11px] text-marble/60 mt-0.5 font-medium leading-relaxed truncate">{docItem.description || "No short description provided."}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 border border-white/15 bg-white/5 text-white rounded">
                          {docItem.category}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-marble/60 font-semibold">{docItem.sortOrder}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {docItem.displayInMathCorner === 1 && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-ares-red/10 text-ares-red border border-ares-red/20 rounded">Math</span>
                          )}
                          {docItem.displayInScienceCorner === 1 && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-ares-bronze/10 text-ares-bronze border border-ares-bronze/20 rounded">Science</span>
                          )}
                          {docItem.displayInAreslib === 1 && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-white/5 text-marble border border-white/10 rounded">ARESLib</span>
                          )}
                          {docItem.isPortfolio === 1 && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 bg-ares-gold/10 text-ares-gold border border-ares-gold/20 rounded">Portfolio</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                            isPublished
                              ? "bg-ares-success/15 border-ares-success/30 text-ares-success"
                              : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                          }`}
                        >
                          {docItem.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-1.5">
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(docItem)}
                                className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                                title="Edit Lesson"
                                aria-label={`Edit ${docItem.title}`}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteDoc(docItem.slug)}
                                className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-red-light border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                                title="Delete Lesson"
                                aria-label={`Delete ${docItem.title}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[9px] text-marble/40 uppercase font-black tracking-widest">🔒 Gated</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out / Drawer Article Editor Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => handleCloseEditor()}
          />

          <div 
            ref={editorRef} 
            tabIndex={-1} 
            className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 ${
              isFullScreen ? "w-full max-w-full" : "w-full max-w-5xl"
            }`}
          >
            <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
              <div>
                <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
                  {editSlug ? `Edit Lesson: ${formTitle}` : "Create Academy Lesson"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Compose premium markdown tutorials and mathematical guides
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                  title={isFullScreen ? "Minimize Editor" : "Maximize Editor"}
                >
                  {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={() => handleCloseEditor()}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                  aria-label="Close editor"
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
                  ✏️ Compose Article
                </button>
                {editSlug && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("revisions")}
                    className={`py-3 border-b-2 transition-all cursor-pointer ${
                      activeTab === "revisions" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
                    }`}
                  >
                    📜 Revision Logs
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

            {/* Content Canvas */}
            <div className="flex-1 overflow-hidden bg-black/10 p-6 flex flex-col">
              
              {/* Tab 1: EDIT FORM */}
              {activeTab === "edit" && (
                <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                  <form
                    onSubmit={handleSaveDoc}
                    className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
                      showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
                    }`}
                  >
                    <div className="space-y-6 pb-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="formTitle" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Lesson Title</label>
                          <input
                            id="formTitle"
                            type="text"
                            placeholder="e.g. Backpropagation Math & Visuals"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="formSlug" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Slug (URL Path)</label>
                          <input
                            id="formSlug"
                            type="text"
                            placeholder="e.g. backpropagation-math"
                            value={formSlug}
                            onChange={(e) => setFormSlug(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors font-mono disabled:opacity-50 focus:ring-2 focus:ring-ares-cyan"
                            disabled={!!editSlug}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="formCategory" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Category Group</label>
                          <select
                            id="formCategory"
                            value={formCategory}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormCategory(val);
                              setIsCustomCategory(val === "custom");
                            }}
                            className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                          >
                            {ACADEMY_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="custom">🛠️ Custom Category...</option>
                          </select>
                        </div>

                        {isCustomCategory && (
                          <div>
                            <label htmlFor="customCategoryText" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Custom Category Name</label>
                            <input
                              id="customCategoryText"
                              type="text"
                              placeholder="e.g. Advanced Control Theory"
                              value={customCategoryText}
                              onChange={(e) => setCustomCategoryText(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                              required
                            />
                          </div>
                        )}

                        <div>
                          <label htmlFor="formSortOrder" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Sorting Priority Order</label>
                          <input
                            id="formSortOrder"
                            type="number"
                            placeholder="1"
                            value={formSortOrder}
                            onChange={(e) => setFormSortOrder(Number(e.target.value))}
                            className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="formStatus" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Release Status</label>
                          <select
                            id="formStatus"
                            value={formStatus}
                            onChange={(e) => setFormStatus(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                          >
                            <option value="draft">🟡 Draft (Hidden)</option>
                            <option value="published">🟢 Published (Live)</option>
                          </select>
                        </div>
                      </div>

                      {/* Display destinations */}
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider mb-3 text-marble/60">Display Configurations</span>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 bg-black/25 border border-white/5 p-4 rounded-lg">
                          <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formDisplayInMathCorner}
                              onChange={(e) => setFormDisplayInMathCorner(e.target.checked)}
                              className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                            />
                            <span>Academy (Math Corner)</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formDisplayInScienceCorner}
                              onChange={(e) => setFormDisplayInScienceCorner(e.target.checked)}
                              className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                            />
                            <span>Academy (Science Corner)</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formDisplayInAreslib}
                              onChange={(e) => setFormDisplayInAreslib(e.target.checked)}
                              className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                            />
                            <span>ARESLib Reference</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formIsPortfolio}
                              onChange={(e) => setFormIsPortfolio(e.target.checked)}
                              className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                            />
                            <span>Portfolio Archive</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={formIsExecutiveSummary}
                              onChange={(e) => setFormIsExecutiveSummary(e.target.checked)}
                              className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                            />
                            <span>Executive Summary</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="formDescription" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Short Abstract Summary</label>
                        <textarea
                          id="formDescription"
                          rows={2}
                          placeholder="A quick overview sentence summarizing the article or lesson contents."
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded p-3 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan resize-none leading-relaxed"
                        />
                      </div>

                      <div>
                        <label htmlFor="formContent" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Lesson Content (Markdown & LaTeX)</label>
                        <MarkdownEditor
                          id="formContent"
                          placeholder="Write rich markdown text. Use LaTeX style double dollar signs ($$) for display equations, or single dollar sign ($) for inline formulas."
                          value={formContent}
                          onChange={setFormContent}
                          className="h-[350px]"
                        />
                      </div>
                    </div>
                  </form>

                  {/* AI Copilot Panel */}
                  {showAiSidebar && (
                    <div className="hidden lg:flex lg:w-[30%] bg-black/30 border border-white/15 rounded-xl p-4 flex-col gap-4 overflow-y-auto shrink-0 select-none scrollbar-thin scrollbar-thumb-white/5">
                      <div className="space-y-4">
                        {/* Section 1: Spelling & Grammar Checker */}
                        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2 mb-1.5">
                            <Sparkles size={11} /> Spelling & Tone
                          </h4>
                          <p className="text-[9px] text-marble/60 leading-normal mb-2.5">
                            Gemini will scan the current editor contents for grammar errors, mathematical typos, and tone constraints.
                          </p>
                          <button
                            type="button"
                            onClick={handleGrammarCheck}
                            disabled={aiLoading || !formContent}
                            className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
                          >
                            {aiLoading ? "Checking..." : "Verify Content Grammar"}
                          </button>
                        </div>

                        {/* Section 2: AI Writer Prompts */}
                        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg flex flex-col gap-2.5">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-cyan flex items-center gap-2">
                            <Sparkles size={11} /> AI Assistant
                          </h4>
                          
                          <textarea
                            placeholder="Tell Gemini to draft a paragraph, write equations, explain Kotlin code..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="w-full h-16 bg-black/60 border border-white/10 rounded p-2.5 text-xs text-white placeholder:text-marble/25 focus:outline-none focus:border-ares-cyan font-mono leading-relaxed resize-none focus:ring-2 focus:ring-ares-cyan"
                          />

                          {/* Presets Grid */}
                          <div className="grid grid-cols-2 gap-1.5 text-[8px] font-black uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Improve the explanation readability, ensuring it fits middle school levels while maintaining technical accuracy.", "Audit Readability")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              📚 Readability
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Expand this article section, providing detailed code snippets or LaTeX math equation derivations where appropriate.", "Derive Formulas")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              📐 Add Math/Code
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Summarize this lesson content down to a concise list of key takeaways or study notes.", "Summarize")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              ✂️ Study Notes
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant(aiPrompt)}
                              disabled={aiLoading || !aiPrompt.trim()}
                              className="p-1.5 bg-ares-cyan text-black hover:brightness-110 rounded text-center transition-all cursor-pointer font-bold disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
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
                                  setRevertAlert("Applied grammar and spelling corrections to the lesson draft!");
                                }}
                                className="w-full py-2.5 bg-ares-success text-white font-black uppercase tracking-widest text-[9px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all focus:ring-2 focus:ring-ares-cyan"
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
                                    setRevertAlert("Replaced content with Gemini generated text!");
                                  }}
                                  className="py-2.5 bg-ares-cyan text-black font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all focus:ring-2 focus:ring-ares-cyan"
                                >
                                  Replace Draft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormContent(formContent + "\n\n" + aiResponse);
                                    setAiResponse("");
                                    setRevertAlert("Appended Gemini response to content!");
                                  }}
                                  className="py-2.5 bg-white/5 border border-white/15 text-white font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:bg-white/10 transition-all focus:ring-2 focus:ring-ares-cyan"
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

              {/* Tab 2: REVISION HISTORY */}
              {activeTab === "revisions" && (
                <div className="flex-grow overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-white/5">
                  <RevisionHistoryTable
                    revisions={revisions}
                    isLoading={loadingRevisions}
                    onRevert={handleRevertToRevision}
                  />
                </div>
              )}

            </div>

            {activeTab === "edit" && (
              <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCloseEditor()}
                  className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDoc}
                  className="clipped-button-sm bg-ares-red text-white hover:bg-ares-red-dark font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  {editSlug ? "Update Entry" : "Publish Lesson"}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
