
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { docSchema } from "@shared/schemas/docSchema";
import { api } from "../api/client";
import { useModal } from "../contexts/ModalContext";
import EditorFooter from "./editor/EditorFooter";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import { z } from "zod";

type DocFormValues = z.infer<typeof docSchema>;

interface DocData {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
  description: string;
  is_portfolio: number;
  is_executive_summary: number;
  content: string;
}

import { CollaborativeEditorRoom, useCollaborativeEditor } from "./editor/CollaborativeEditorRoom";

function DocsEditorInner({ editSlug, userRole }: { editSlug?: string, userRole?: string | unknown }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modal = useModal();
  const [errorMsg, setErrorMsg] = useState("");

  const { ydoc, provider } = useCollaborativeEditor();
  const editor = useRichEditor({ 
    placeholder: "<p>Start writing documentation here...</p>",
    ydoc,
    provider
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<DocFormValues>({
    resolver: zodResolver(docSchema) as unknown as import("react-hook-form").Resolver<DocFormValues>,
    defaultValues: {
      slug: "",
      title: "",
      category: "Getting Started",
      sortOrder: 10,
      description: "",
      isPortfolio: false,
      isExecutiveSummary: false,
      isDraft: false,
      content: "{}"
    }
  });

  const formValues = useWatch({ control });

  // Use standard API query instead of useEntityFetch
  const { data: docRes, isLoading, isError } = api.docs.adminDetail.useQuery(
    ["admin_doc_detail", editSlug || ""],
    {
      params: { slug: editSlug || "" }
    },
    {
      enabled: !!editSlug
    }
  );

  useEffect(() => {
    if (docRes?.status === 200 && docRes.body.doc) {
      const doc = docRes.body.doc as unknown as DocData;
      reset({
        slug: doc.slug || "",
        title: doc.title || "",
        category: doc.category || "Getting Started",
        sortOrder: doc.sort_order || 10,
        description: doc.description || "",
        isPortfolio: !!doc.is_portfolio,
        isExecutiveSummary: !!doc.is_executive_summary,
        content: doc.content || "{}"
      });
      
      if (editor && doc.content) {
        // In collaborative mode, avoid overwriting active live edits with the static DB snapshot.
        // We only inject the DB snapshot if the YDoc is currently empty (e.g. first user joining a new session).
        const shouldSetContent = !ydoc || ydoc.getXmlFragment("default").length === 0;
        
        if (shouldSetContent) {
          try {
            editor.commands.setContent(JSON.parse(doc.content));
          } catch {
            editor.commands.setContent(doc.content);
          }
        }
      }
    }
  }, [docRes, reset, editor, ydoc]);

  const saveMutation = api.docs.saveDoc.useMutation({
     
    onSuccess: (res: { status: number; body: { slug?: string; error?: string } }) => {
      if (res.status === 200) {
        queryClient.invalidateQueries({ queryKey: ["docs"] });
        queryClient.invalidateQueries({ queryKey: ["admin_docs"] });
        if (editSlug) queryClient.invalidateQueries({ queryKey: ["doc", editSlug] });
        if (formValues.isDraft || userRole === "author") {
          navigate("/dashboard");
        } else {
          navigate(`/docs/${res.body.slug}`);
        }
      } else {
        setErrorMsg(res.body.error || "Failed to publish");
      }
    },
     
    onError: (err: Error) => {
      setErrorMsg(err.message || "Network error");
    }
  });

  const deleteMutation = api.docs.deleteDoc.useMutation({
    onSuccess: (data: { status: number }) => {
      if (data.status === 200) {
        queryClient.invalidateQueries({ queryKey: ["docs"] });
        queryClient.invalidateQueries({ queryKey: ["admin_docs"] });
        navigate("/dashboard");
      } else {
        setErrorMsg("Failed to delete the document.");
      }
    },
    onError: () => {
      setErrorMsg("Failed to delete the document.");
    }
  });

  const onFormSubmit = (data: DocFormValues, isDraft = false) => {
    if (!editor) return;
    const content = JSON.stringify(editor.getJSON());
    saveMutation.mutate({ body: { ...data, content, isDraft } });
  };

  const handleDelete = async () => {
    if (!editSlug) return;
    const confirmed = await modal.confirm({
      title: "Delete Documentation",
      description: "Are you sure you want to permanently delete this documentation page?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    deleteMutation.mutate({ params: { slug: editSlug }, body: {} });
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {editSlug ? "Edit Document" : "Publish Document"}
        </h2>
        <p className="text-white/50 text-sm">
          {editSlug ? "Modify an existing ARESLib documentation page." : "Draft a new Markdown/Tiptap documentation page for the hub."}
        </p>
      </div>

      {isError && (
        <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
          COMMUNICATION FAULT: Failed to retrieve record from server.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-2">
        <div className="col-span-1 lg:col-span-2">
          <label htmlFor="doc-title" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Title</label>
          <input
            id="doc-title" type="text"
            {...register("title")}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
            placeholder="e.g. Swerve Kinematics"
          />
          {errors.title && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{errors.title.message as string}</p>}
        </div>
        
        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-slug" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Slug</label>
          <input
            id="doc-slug" type="text"
            {...register("slug")}
            disabled={!!editSlug}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="e.g. swerve-kinematics"
          />
          {errors.slug && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{errors.slug.message as string}</p>}
        </div>

        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-category" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Category</label>
          <input
            id="doc-category" type="text"
            {...register("category")}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
            placeholder="e.g. Tutorials"
          />
        </div>
        
        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-sort" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Sort Order</label>
          <input
            id="doc-sort" type="number"
            {...register("sortOrder", { valueAsNumber: true })}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="doc-description" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Description / Summary</label>
        <input
          id="doc-description" type="text"
          {...register("description")}
          className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
          placeholder="Brief summary of what this document covers..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 ares-cut-sm bg-obsidian/50 border border-white/5">
        <div className="flex items-center gap-3 cursor-pointer group">
          <input 
            id="isPortfolioToggle" type="checkbox" 
            {...register("isPortfolio")} 
            className="w-5 h-5 rounded border-white/10 bg-black text-ares-cyan focus:ring-ares-cyan"
          />
          <div>
            <label htmlFor="isPortfolioToggle" className="block text-sm font-bold text-white group-hover:text-ares-cyan transition-colors cursor-pointer">Judge&apos;s Portfolio Selection</label>
            <span className="block text-xs text-white/60">Feature this in the Rapid Review dashboard for judges.</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 cursor-pointer group">
          <input 
            id="isExecSummaryToggle" type="checkbox" 
            {...register("isExecutiveSummary")} 
            className="w-5 h-5 rounded border-white/10 bg-black text-ares-gold focus:ring-ares-gold"
          />
          <div>
            <label htmlFor="isExecSummaryToggle" className="block text-sm font-bold text-white group-hover:text-ares-gold transition-colors cursor-pointer">Executive Summary Flag</label>
            <span className="block text-xs text-white/60">Mark as the primary seasonal overview for rapid judging.</span>
          </div>
        </div>
      </div>

      {/* ===== Unified Rich Editor ===== */}
      <div className="flex-1 flex flex-col relative min-h-[500px]">
        {editor && <RichEditorToolbar editor={editor} documentTitle={formValues.title || ""} />}
      </div>

      <div className="mt-4 pt-6">
        {editSlug && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => navigate('/dashboard/manage_docs')}
              className="px-6 py-2 ares-cut-sm text-white/50 hover:text-white font-bold tracking-wider text-sm transition-colors"
            >
              Cancel Edit
            </button>
          </div>
        )}
        <EditorFooter 
          errorMsg={errorMsg}
          isPending={saveMutation.isPending}
          isEditing={!!editSlug}
          onDelete={handleDelete}
          onSaveDraft={handleSubmit((d) => onFormSubmit(d, true))}
          onPublish={handleSubmit((d) => onFormSubmit(d, false))}
          deleteText="DELETE DOC"
          updateText="UPDATE DOC"
          publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH DOC"}
          userRole={userRole}
          roundedClass="ares-cut"
        />
      </div>
    </div>
  );
}

export default function DocsEditor({ userRole }: { userRole?: string | unknown }) {
  const { editSlug } = useParams<{ editSlug?: string }>();

  // Use a predictable room ID based on the document slug
  const roomId = editSlug ? `doc_${editSlug}` : null;

  if (roomId) {
    return (
      <CollaborativeEditorRoom roomId={roomId}>
        <DocsEditorInner editSlug={editSlug} userRole={userRole} />
      </CollaborativeEditorRoom>
    );
  }

  // Single player mode for new documents until they are saved and get a slug
  return <DocsEditorInner editSlug={editSlug} userRole={userRole} />;
}

