"use client";

import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Pencil, Shield, Activity, FileText, Download, ExternalLink, X } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";

interface TeamDocument {
  slug: string;
  title: string;
  description: string;
  category: "spec" | "guide" | "business";
  fileUrl: string;
  createdAt: string;
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

  return (
    <div className="space-y-10 w-full">
      
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
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl"
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
          <div ref={editorRef} tabIndex={-1} className="relative z-10 w-full max-w-lg h-full bg-obsidian border-l border-white/10 flex flex-col justify-between animate-slide-in shadow-2xl focus:outline-none">
            <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20">
              <div>
                <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
                  {editSlug ? `Edit Document: ${editSlug}` : "Register Specification / Guide"}
                </h3>
                <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
                  Secure external cloud bindings
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                aria-label="Close editor drawer"
              >
                <X size={16} />
              </button>
            </header>

            {/* Form Canvas */}
            <form onSubmit={handleSaveDoc} className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  className="h-28"
                />
              </div>
            </form>

            <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20">
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
          </div>
        </div>
      )}

    </div>
  );
}
