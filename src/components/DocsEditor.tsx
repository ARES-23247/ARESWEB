

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { docSchema } from "@shared/schemas/docSchema";
import { useGetAdminDocDetail, useSaveDoc, useDeleteDoc } from "../api";
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
  display_in_areslib?: number;
  display_in_math_corner?: number;
  display_in_science_corner?: number;
  content: string;
  zulip_stream?: string;
  zulip_topic?: string;
}

import { CollaborativeEditorRoom, useCollaborativeEditor } from "./editor/CollaborativeEditorRoom";
import VersionHistorySidebar from "./editor/VersionHistorySidebar";
import { CopilotMenu } from "./editor/CopilotMenu";
import ZulipThread from "./ZulipThread";

function DocsEditorInner({ editSlug, userRole, roomId }: { editSlug?: string, userRole?: string | unknown, roomId?: string | null }) {
  const navigate = useNavigate();
  const modal = useModal();
  const [errorMsg, setErrorMsg] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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
      displayInAreslib: true,
      displayInMathCorner: false,
      displayInScienceCorner: false,
      content: "{}"
    }
  });

  const formValues = useWatch({ control });

  const { data: docRes, isLoading, isError } = useGetAdminDocDetail(editSlug || "");

  useEffect(() => {
    if (docRes?.doc) {
      const doc = docRes.doc as unknown as DocData;
      reset({
        slug: doc.slug || "",
        title: doc.title || "",
        category: doc.category || "Getting Started",
        sortOrder: doc.sort_order || 10,
        description: doc.description || "",
        isPortfolio: !!doc.is_portfolio,
        isExecutiveSummary: !!doc.is_executive_summary,
        displayInAreslib: doc.display_in_areslib === undefined ? true : !!doc.display_in_areslib,
        displayInMathCorner: !!doc.display_in_math_corner,
        displayInScienceCorner: !!doc.display_in_science_corner,
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

  const saveMutation = useSaveDoc({
    onSuccess: (res) => {
      if (res.slug) {
        if (formValues.isDraft || userRole === "author") {
          navigate({ to: "/dashboard" });
        } else {
          navigate({ to: `/docs/${res.slug}` });
        }
      } else {
        setErrorMsg("Failed to publish");
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Network error");
    }
  });

  const deleteMutation = useDeleteDoc({
    onSuccess: () => {
      navigate({ to: "/dashboard/manage_docs" });
    },
    onError: () => {
      setErrorMsg("Failed to delete the document.");
    }
  });

  const onFormSubmit = (data: DocFormValues, isDraft = false) => {
    if (!editor) return;
    const content = JSON.stringify(editor.getJSON());
    saveMutation.mutate({ ...data, content, isDraft });
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

    deleteMutation.mutate(editSlug);
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><RefreshCw className="animate-spin text-ares-red" size={32} /></div>;

  return (
    <div className="flex flex-col gap-6 w-full relative h-full">
      <div className="flex flex-col gap-6 flex-1 min-w-0">
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

      <div className="mt-2 mb-2">
        <h3 className="text-sm font-bold text-ares-gold uppercase tracking-wider border-b border-white/10 pb-2 mb-4">Hub Visibility Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 ares-cut-sm bg-obsidian/50 border border-white/5">
          <div className="flex items-center gap-3 cursor-pointer group">
            <input
              id="displayAreslibToggle" type="checkbox"
              {...register("displayInAreslib")}
              className="w-5 h-5 rounded border-white/10 bg-black text-ares-cyan focus:ring-ares-cyan"
            />
            <div>
              <label htmlFor="displayAreslibToggle" className="block text-sm font-bold text-white group-hover:text-ares-cyan transition-colors cursor-pointer">Main Library (ARESLib)</label>
            </div>
          </div>

          <div className="flex items-center gap-3 cursor-pointer group">
            <input
              id="displayMathToggle" type="checkbox"
              {...register("displayInMathCorner")}
              className="w-5 h-5 rounded border-white/10 bg-black text-ares-cyan focus:ring-ares-cyan"
            />
            <div>
              <label htmlFor="displayMathToggle" className="block text-sm font-bold text-white group-hover:text-ares-cyan transition-colors cursor-pointer">Math Corner</label>
            </div>
          </div>

          <div className="flex items-center gap-3 cursor-pointer group">
            <input
              id="displayScienceToggle" type="checkbox"
              {...register("displayInScienceCorner")}
              className="w-5 h-5 rounded border-white/10 bg-black text-ares-cyan focus:ring-ares-cyan"
            />
            <div>
              <label htmlFor="displayScienceToggle" className="block text-sm font-bold text-white group-hover:text-ares-cyan transition-colors cursor-pointer">Science Corner</label>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Unified Rich Editor ===== */}
      <div className="flex-1 flex flex-col relative min-h-[500px]">
        {editor && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1"><RichEditorToolbar editor={editor} documentTitle={formValues.title || ""} /></div>
            </div>
            <CopilotMenu editor={editor} />
          </>
        )}
      </div>

      <div className="mt-4 pt-6">
        {editSlug && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => navigate({ to: '/dashboard/manage_docs' })}
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
          onSaveDraft={handleSubmit((d: DocFormValues) => onFormSubmit(d, true))}
          onPublish={handleSubmit((d: DocFormValues) => onFormSubmit(d, false))}
          deleteText="DELETE DOC"
          updateText="UPDATE DOC"
          publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH DOC"}
          userRole={userRole}
          roundedClass="ares-cut"
          onShowHistory={roomId && editor ? () => setIsHistoryOpen(true) : undefined}
        />
      </div>

      {isHistoryOpen && roomId && editor && (
        <VersionHistorySidebar
          roomId={roomId}
          editor={editor}
          onClose={() => setIsHistoryOpen(false)}
          historyUrl={editSlug ? `/api/docs/admin/${editSlug}/history` : undefined}
        />
      )}
      </div>

      {editSlug && docRes?.doc && (
        <div className="w-full flex flex-col gap-6 mt-6">
          <ZulipThread
            stream={(docRes.doc as unknown as DocData).zulip_stream || "documents"}
            topic={(docRes.doc as unknown as DocData).zulip_topic || `Doc: ${(docRes.doc as unknown as DocData).title}`}
          />
        </div>
      )}
    </div>
  );
}

export default function DocsEditor({ userRole }: { userRole?: string | unknown }) {
  const { editSlug } = useParams({ strict: false }) as Record<string, string>;

  const [draftId] = useState(() => `draft_doc_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`);
  const roomId = editSlug ? `doc_${editSlug}` : draftId;

  return (
    <CollaborativeEditorRoom roomId={roomId}>
      <DocsEditorInner editSlug={editSlug} userRole={userRole} roomId={roomId} />
    </CollaborativeEditorRoom>
  );
}


