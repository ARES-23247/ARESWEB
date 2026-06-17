"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Shield, 
  Activity, 
  FileText, 
  Download, 
  ExternalLink, 
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Circle
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";
import { authenticatedFetch } from "@/lib/api";

interface TeamDocument {
  slug: string;
  title: string;
  description: string;
  category: "spec" | "guide" | "business";
  fileUrl: string;
  createdAt: string;
}

interface DocumentRevision {
  id: string;
  title: string;
  description: string;
  category: "spec" | "guide" | "business";
  fileUrl: string;
  editedBy: string;
  editedByName: string;
  editedByAvatar: string;
  timestamp: string;
}

const MOCK_DOCS: TeamDocument[] = [
  {
    slug: "drivetrain-design-spec",
    title: "Chassis Mecanum Mechanical Design Specifications",
    description: "Detailed CAD assemblies, weight budgeting, and structure specs for our 18-inch GoBilda custom chassis.",
    category: "spec",
    fileUrl: "https://onshape.com",
    createdAt: "2026-05-10"
  },
  {
    slug: "ekf-programming-guide",
    title: "Extended Kalman Filter Odometry Integration Guide",
    description: "Technical instructions detailing dead wheel encoder mounting parameters and software integration calibrations.",
    category: "guide",
    fileUrl: "https://github.com",
    createdAt: "2026-05-18"
  },
  {
    slug: "sponsor-business-plan",
    title: "2026 Sponsorship Outreach & Sustainability Proposal",
    description: "Business plan proposal and world recaps compiled for local engineering firm partnerships and sponsorship ROI.",
    category: "business",
    fileUrl: "https://drive.google.com",
    createdAt: "2026-05-28"
  }
];

export default function DocumentsManagementPage() {
  const { user, authorizedUser } = useAuth();
  const [documents, setDocuments] = useState<TeamDocument[]>(MOCK_DOCS);
  const [isLive, setIsLive] = useState(false);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<"spec" | "guide" | "business">("spec");
  const [formFileUrl, setFormFileUrl] = useState("");

  // Upgraded modal states
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);

  // Identity and Revisions states
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userNickname, setUserNickname] = useState("");
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // AI Copilot States
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  const editorRef = useFocusTrap(isEditorOpen, () => setIsEditorOpen(false));

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for real-time document updates
  useEffect(() => {
    try {
      const docsRef = collection(db, "documents");
      const unsubscribe = onSnapshot(
        docsRef,
        (snapshot) => {
          if (snapshot.empty) {
            setDocuments(MOCK_DOCS);
            setIsLive(false);
            return;
          }
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              slug: doc.id,
              title: data.title || "Untitled Document",
              description: data.description || "",
              category: data.category || "spec",
              fileUrl: data.fileUrl || "",
              createdAt: data.createdAt || new Date().toISOString().split("T")[0]
            } as TeamDocument;
          });
          
          setDocuments(list);
          setIsLive(true);
        },
        (err) => {
          console.warn("Firestore not connected, using fallback mock docs.", err.message);
          setDocuments(MOCK_DOCS);
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn("Local sandbox mode, using static mock document list.", e);
      setDocuments(MOCK_DOCS);
      setIsLive(false);
    }
  }, []);

  // Fetch user profile for nickname and avatar (used in revision logging)
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

  // Fetch revisions when tab shifts
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
        collection(db, "documents", editSlug, "revisions"),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as DocumentRevision[];
      setRevisions(list);
    } catch (err) {
      console.warn("Could not load revision logs:", err);
    } finally {
      setLoadingRevisions(false);
    }
  };

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
    setFormDescription("");
    setFormCategory("spec");
    setFormFileUrl("https://drive.google.com");

    // Reset states
    setIsFullScreen(false);
    setActiveTab("edit");
    setShowAiSidebar(false);
    setRevertAlert(null);
    setGrammarEdits([]);
    setAiResponse("");
    setRevisions([]);

    setIsEditorOpen(true);
  };

  // Open editor for editing
  const handleOpenEdit = (docItem: TeamDocument) => {
    setEditSlug(docItem.slug);
    setFormTitle(docItem.title);
    setFormSlug(docItem.slug);
    setFormDescription(docItem.description);
    setFormCategory(docItem.category);
    setFormFileUrl(docItem.fileUrl);

    // Reset states
    setIsFullScreen(false);
    setActiveTab("edit");
    setShowAiSidebar(false);
    setRevertAlert(null);
    setGrammarEdits([]);
    setAiResponse("");
    setRevisions([]);

    setIsEditorOpen(true);
  };

  // 2. Action: Save Document
  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSlug.trim() || !formFileUrl.trim()) return;
    if (!canEdit) return;

    const targetSlug = formSlug.trim();
    const newDoc: TeamDocument = {
      slug: targetSlug,
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      fileUrl: formFileUrl.trim(),
      createdAt: new Date().toISOString().split("T")[0]
    };

    try {
      await setDoc(doc(db, "documents", targetSlug), newDoc);

      // Save Revision Document
      if (user) {
        const revId = `rev_${Date.now()}`;
        const revisionData: DocumentRevision = {
          id: revId,
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          fileUrl: formFileUrl.trim(),
          editedBy: user.uid,
          editedByName: userNickname || user.displayName || "Anonymous Member",
          editedByAvatar: userProfile?.avatar || user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`,
          timestamp: new Date().toISOString()
        };
        await setDoc(doc(db, "documents", targetSlug, "revisions", revId), revisionData);
      }

      setIsEditorOpen(false);
    } catch (err) {
      console.warn("Unable to save document online, updating local array.", err);
      if (editSlug) {
        setDocuments(documents.map(d => d.slug === editSlug ? newDoc : d));
      } else {
        setDocuments([newDoc, ...documents]);
      }
      setIsEditorOpen(false);
    }
  };

  // 3. Action: Delete Document
  const handleDeleteDoc = async (slug: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this document from the library?")) return;

    try {
      await deleteDoc(doc(db, "documents", slug));
    } catch (err) {
      console.warn("Firestore offline, deleting document locally.", err);
      setDocuments(documents.filter(d => d.slug !== slug));
    }
  };

  // 4. Action: Revert To Revision
  const handleRevertToRevision = (rev: DocumentRevision) => {
    setFormTitle(rev.title);
    setFormDescription(rev.description);
    setFormCategory(rev.category);
    setFormFileUrl(rev.fileUrl);
    setRevertAlert(`Reverted unsaved draft to revision from ${new Date(rev.timestamp).toLocaleString()}. Save document to commit changes.`);
    setActiveTab("edit");
  };

  // 5. AI Copilot: Assistant prompt
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
          text: formDescription,
          context: `Document Title: ${formTitle}\nCategory: ${formCategory}`
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

  // 6. AI Copilot: Grammar check
  const handleGrammarCheck = async () => {
    if (!formDescription.trim()) return;
    setAiLoading(true);
    setGrammarEdits([]);
    setSuggestedCorrection("");
    try {
      const res = await authenticatedFetch("/api/ai/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formDescription })
      });

      if (!res.ok) throw new Error("AI Grammar check service error.");
      const data = await res.json();
      setSuggestedCorrection(data.correctedText || "");
      setGrammarEdits(data.edits || []);
    } catch (err: any) {
      console.warn(err);
      setSuggestedCorrection(formDescription);
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
            <Activity size={12} className="animate-pulse" /> Engineering Repositories
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Manage Docs
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
            Maintain ARES design spec sheets, CAD assembly logs, software guides, and partnership folders in our secure cloud index.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <Plus size={16} /> New Document
          </button>
        )}
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify the document library.</span>
        </div>
      )}

      {/* Documents Table View */}
      <div className="glass-card border border-white/10 ares-cut-lg overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center text-xs font-black uppercase text-ares-gold tracking-widest">
          <span>Active Document Inventory</span>
          <span>{documents.length} Files</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-marble/40 uppercase font-black tracking-widest text-[9px] bg-black/5">
                <th className="p-4">Document / Specifications</th>
                <th className="p-4">Category</th>
                <th className="p-4">Creation Date</th>
                <th className="p-4">Reference URL</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-black/10">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-marble/40 font-mono">
                    No documents indexed in the library.
                  </td>
                </tr>
              ) : (
                documents.map((docItem) => {
                  const isSpec = docItem.category === "spec";
                  const isGuide = docItem.category === "guide";

                  return (
                    <tr key={docItem.slug} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 max-w-sm">
                        <div className="flex gap-3">
                          <FileText className="text-ares-gold shrink-0 mt-0.5" size={16} />
                          <div>
                            <p className="font-extrabold text-white text-sm tracking-tight">{docItem.title}</p>
                            <p className="text-[11px] text-marble/60 mt-0.5 font-medium leading-relaxed">{docItem.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                            isSpec
                              ? "bg-ares-red/15 border-ares-red/30 text-white"
                              : isGuide
                              ? "bg-ares-cyan/15 border-ares-cyan/30 text-ares-cyan"
                              : "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                          }`}
                        >
                          {docItem.category}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-marble/60 text-[10px]">{docItem.createdAt}</td>
                      <td className="p-4">
                        <a
                          href={docItem.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-ares-cyan hover:text-white font-bold uppercase tracking-widest inline-flex items-center gap-1"
                        >
                          Access File <ExternalLink size={10} />
                        </a>
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-1.5">
                          {canEdit ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(docItem)}
                                className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                                title="Edit Doc Info"
                                aria-label={`Edit ${docItem.title}`}
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteDoc(docItem.slug)}
                                className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-red-light border border-white/10 rounded transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                                title="Delete Doc Info"
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

      {/* Slide-out / Modal Document Editor Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            onClick={() => setIsEditorOpen(false)}
          />

          {/* Editor Drawer */}
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
                  {editSlug ? `Edit Document: ${formTitle}` : "Register Specification / Guide"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Secure external cloud bindings
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
                  onClick={() => setIsEditorOpen(false)}
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
                  ✏️ Edit Document
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
                    onSubmit={handleSaveDoc}
                    className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
                      showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
                    }`}
                  >
                    <div className="space-y-6">
                      <div>
                        <label htmlFor="formTitle" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Document Title</label>
                        <input
                          id="formTitle"
                          type="text"
                          placeholder="e.g. Pinpoint Pod EKF Integration Guide"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="formSlug" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Custom Document Slug</label>
                        <input
                          id="formSlug"
                          type="text"
                          placeholder="e.g. pinpoint-ekf-guide"
                          value={formSlug}
                          onChange={(e) => setFormSlug(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors font-mono disabled:opacity-50 focus:ring-2 focus:ring-ares-cyan"
                          disabled={!!editSlug}
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="formCategory" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Document Library Category</label>
                        <select
                          id="formCategory"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as any)}
                          className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                        >
                          <option value="spec">🛑 Mechanical / CAD Specifications</option>
                          <option value="guide">⚙️ Software / Electronics Guide</option>
                          <option value="business">🏆 Roster Proposal / Business Plan</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="formFileUrl" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Reference URL (File Path / Cloud Link)</label>
                        <input
                          id="formFileUrl"
                          type="url"
                          placeholder="e.g. https://drive.google.com/... or https://github.com/..."
                          value={formFileUrl}
                          onChange={(e) => setFormFileUrl(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors font-mono focus:ring-2 focus:ring-ares-cyan"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="formDescription" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Detailed Description</label>
                        <MarkdownEditor
                          id="formDescription"
                          placeholder="Describe target specifications, design budget margins, coding dependencies, etc..."
                          value={formDescription}
                          onChange={setFormDescription}
                          className="h-[250px]"
                        />
                      </div>
                    </div>
                  </form>

                  {/* AI Copilot Panel */}
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
                            disabled={aiLoading || !formDescription}
                            className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
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
                            className="w-full h-16 bg-black/60 border border-white/10 rounded p-2.5 text-xs text-white placeholder:text-marble/25 focus:outline-none focus:border-ares-cyan font-mono leading-relaxed resize-none focus:ring-2 focus:ring-ares-cyan"
                          />

                          {/* Presets Grid */}
                          <div className="grid grid-cols-2 gap-1.5 text-[8px] font-black uppercase tracking-wider">
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Rewrite the content to make it sound more professional and academic.", "Improve Writing")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              💼 Professional
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Expand this description, adding more technical specifications, CAD constraints, or coding APIs.", "Expand Content")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              ➕ Expand
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAiAssistant("Summarize the entire document description, extracting key highlights suitable for a 2-sentence snippet.", "Summarize")}
                              disabled={aiLoading}
                              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                            >
                              ✂️ Summarize
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
                                  setFormDescription(suggestedCorrection);
                                  setGrammarEdits([]);
                                  setSuggestedCorrection("");
                                  setRevertAlert("Applied grammar and spelling corrections to the draft!");
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
                                    setFormDescription(aiResponse);
                                    setAiResponse("");
                                    setRevertAlert("Replaced description with Gemini generated text!");
                                  }}
                                  className="py-2.5 bg-ares-cyan text-black font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all focus:ring-2 focus:ring-ares-cyan"
                                >
                                  Replace Draft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormDescription(formDescription + "\n\n" + aiResponse);
                                    setAiResponse("");
                                    setRevertAlert("Appended Gemini response to description!");
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
                  {loadingRevisions ? (
                    <div className="py-16 text-center text-marble/45 text-[10px] font-mono uppercase tracking-widest animate-pulse">
                      Retrieving edit logs...
                    </div>
                  ) : revisions.length === 0 ? (
                    <div className="py-16 text-center text-[10px] font-mono text-marble/35 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                      No document changes logged.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="bg-black/35 border border-white/5 rounded-lg p-4 flex items-start justify-between gap-4 hover:border-white/10 transition-colors"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <img src={rev.editedByAvatar} alt="" className="w-5 h-5 rounded-full shrink-0 border border-white/10" />
                              <span className="text-xs font-bold text-white truncate">{rev.editedByName}</span>
                              <span className="text-[9px] font-mono text-marble/45">
                                {new Date(rev.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-ares-gold uppercase truncate">{rev.title}</h5>
                            <p className="text-[10px] text-marble/60 line-clamp-2 leading-relaxed">
                              {rev.description || "No description changes."}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevertToRevision(rev)}
                            className="px-3 py-1.5 border border-ares-gold/30 hover:bg-ares-gold/10 text-ares-gold hover:text-white rounded text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shrink-0 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          >
                            Revert
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {activeTab === "edit" && (
              <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDoc}
                  className="clipped-button-sm bg-ares-red text-white hover:bg-ares-red-dark font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                >
                  {editSlug ? "Update Entry" : "Add to Library"}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
