import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import LearningMetadataPanel from "@/components/docs/LearningMetadataPanel";
import TiptapRenderer, { type ASTNode } from "@/components/TiptapRenderer";
import type { PublicDocument } from "@/lib/publicContentApi";
import {
  buildDocumentSave,
  type DocumentEditorDraft,
  type DocumentEditorVariant,
} from "./documentEditorDraft";

interface DocumentDraftPreviewProps {
  draft: DocumentEditorDraft;
  variant: DocumentEditorVariant;
  defaultCategory: string;
}

export default function DocumentDraftPreview({
  draft,
  variant,
  defaultCategory,
}: DocumentDraftPreviewProps) {
  const built = buildDocumentSave(draft, variant, defaultCategory);
  if ("error" in built) {
    return (
      <div role="alert" className="border border-ares-gold/35 bg-ares-gold/10 p-5 text-white">
        <h3 className="font-heading text-lg font-black uppercase">Preview needs more information</h3>
        <p className="mt-2 text-sm text-marble/80">{built.error}</p>
      </div>
    );
  }

  const { slug, payload } = built;
  const content = payload.content || "";
  let tiptapDocument: ASTNode | null = null;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
      && (parsed as Record<string, unknown>).type === "doc") {
      tiptapDocument = parsed as ASTNode;
    }
  } catch {
    // Markdown is the expected fallback for non-JSON content.
  }

  const previewDocument = variant === "docs"
    ? ({ slug, ...payload } as PublicDocument)
    : null;

  return (
    <article aria-labelledby="draft-preview-title" className="mx-auto w-full max-w-5xl overflow-y-auto border border-white/10 bg-obsidian p-5 sm:p-8">
      <div className="mb-6 border-b border-ares-gold/25 pb-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ares-gold">Unsaved draft preview</p>
        <p className="mt-1 text-xs text-marble/60">This is a visual preview only. It does not save, approve, or publish the record.</p>
      </div>
      <h2 id="draft-preview-title" className="break-words font-heading text-3xl font-black text-white sm:text-4xl">
        {payload.title}
      </h2>
      {payload.description && <p className="mt-3 border-b border-white/10 pb-6 text-base leading-7 text-marble/70">{payload.description}</p>}
      {previewDocument && <div className="mt-6"><LearningMetadataPanel document={previewDocument} /></div>}
      <div className="ares-docs-content mt-8">
        {tiptapDocument ? <TiptapRenderer node={tiptapDocument} /> : <DocsMarkdownRenderer content={content} />}
      </div>
    </article>
  );
}
