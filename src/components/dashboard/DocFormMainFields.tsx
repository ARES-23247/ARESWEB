import type { FormEvent } from "react";
import MarkdownEditor from "@/components/MarkdownEditor";
import type { DocRecord } from "@/hooks/useDocumentSync";
import DocFormAttachmentFields from "./DocFormAttachmentFields";
import DocFormMetadataFields from "./DocFormMetadataFields";
import type {
  DocumentEditorDraft,
  DocumentEditorVariant,
} from "./documentEditorDraft";
import LearningMetadataFields from "./LearningMetadataFields";

interface DocFormMainFieldsProps {
  variant: DocumentEditorVariant;
  draft: DocumentEditorDraft;
  onChange: <Key extends keyof DocumentEditorDraft>(
    field: Key,
    value: DocumentEditorDraft[Key],
  ) => void;
  editDoc: DocRecord | null;
  categories: string[];
  isStudent: boolean;
  setIsPhotoPickerOpen: (value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  showAiSidebar: boolean;
  defaultCategory: string;
}

export default function DocFormMainFields({
  variant,
  draft,
  onChange,
  editDoc,
  categories,
  isStudent,
  setIsPhotoPickerOpen,
  onSubmit,
  showAiSidebar,
  defaultCategory,
}: DocFormMainFieldsProps) {
  const metadataProps = {
    variant,
    categories,
    formCategory: draft.category,
    setFormCategory: (value: string) => onChange("category", value),
    isCustomCategory: draft.category === "custom",
    setIsCustomCategory: (value: boolean) =>
      onChange("category", value ? "custom" : defaultCategory),
    customCategoryText: draft.customCategory,
    setCustomCategoryText: (value: string) => onChange("customCategory", value),
    formSortOrder: draft.sortOrder,
    setFormSortOrder: (value: number) => onChange("sortOrder", value),
    formStatus: draft.status,
    setFormStatus: (value: string) => onChange("status", value),
    isStudent,
    formDisplayInMathCorner: draft.displayInMathCorner,
    setFormDisplayInMathCorner: (value: boolean) =>
      onChange("displayInMathCorner", value),
    formDisplayInScienceCorner: draft.displayInScienceCorner,
    setFormDisplayInScienceCorner: (value: boolean) =>
      onChange("displayInScienceCorner", value),
    formDisplayInAreslib: draft.displayInAreslib,
    setFormDisplayInAreslib: (value: boolean) =>
      onChange("displayInAreslib", value),
    formIsPortfolio: draft.isPortfolio,
    setFormIsPortfolio: (value: boolean) => onChange("isPortfolio", value),
    formIsExecutiveSummary: draft.isExecutiveSummary,
    setFormIsExecutiveSummary: (value: boolean) =>
      onChange("isExecutiveSummary", value),
  };
  const attachmentProps = {
    variant,
    formFileUrl: draft.fileUrl,
    setFormFileUrl: (value: string) => onChange("fileUrl", value),
    formThumbnail: draft.thumbnail,
    setFormThumbnail: (value: string) => onChange("thumbnail", value),
    setIsPhotoPickerOpen,
  };

  return (
    <form
      id="docForm"
      onSubmit={onSubmit}
      className={`flex-grow space-y-6 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
        showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
      }`}
    >
      <div className="space-y-6 pb-6 text-left">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="formTitle"
              className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60"
            >
              Title
            </label>
            <input
              id="formTitle"
              type="text"
              placeholder="e.g. Pinpoint System Calibration"
              value={draft.title}
              onChange={(event) => onChange("title", event.target.value)}
              className="w-full rounded border border-white/10 bg-black/60 px-4 py-2.5 text-xs text-white transition-colors focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-cyan"
              required
            />
          </div>
          <div>
            <label
              htmlFor="formSlug"
              className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60"
            >
              Slug (URL Path)
            </label>
            <input
              id="formSlug"
              type="text"
              placeholder="e.g. pinpoint-calibration"
              value={draft.slug}
              onChange={(event) => onChange("slug", event.target.value)}
              className="w-full rounded border border-white/10 bg-black/60 px-4 py-2.5 font-mono text-xs text-white transition-colors focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-cyan disabled:opacity-50"
              disabled={Boolean(editDoc)}
              required
            />
          </div>
        </div>

        {variant === "docs" && <DocFormMetadataFields {...metadataProps} />}
        {variant === "docs" && <LearningMetadataFields draft={draft} onChange={onChange} />}
        {variant === "documents" && (
          <div className="space-y-6">
            <DocFormAttachmentFields {...attachmentProps} />
            <DocFormMetadataFields {...metadataProps} />
          </div>
        )}
        {variant === "blog" && (
          <div className="space-y-6">
            <DocFormMetadataFields
              {...metadataProps}
              formAuthor={draft.author}
              setFormAuthor={(value) => onChange("author", value)}
              formDate={draft.date}
              setFormDate={(value) => onChange("date", value)}
            />
            <DocFormAttachmentFields {...attachmentProps} />
          </div>
        )}

        <div>
          <label
            htmlFor="formDescription"
            className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60"
          >
            Short Abstract Summary
          </label>
          <textarea
            id="formDescription"
            rows={2}
            placeholder="A quick overview sentence summarizing the content."
            value={draft.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="w-full resize-none rounded border border-white/10 bg-black/60 p-3 text-xs leading-relaxed text-white focus:border-ares-red focus:outline-none focus:ring-2 focus:ring-ares-cyan"
          />
        </div>

        <div>
          <label
            htmlFor="formContent"
            className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-marble/60"
          >
            Document Content (Markdown & LaTeX)
          </label>
          <MarkdownEditor
            id="formContent"
            placeholder="Write rich markdown text. Use LaTeX style double dollar signs ($$) for display equations, or single dollar sign ($) for inline formulas."
            value={draft.content}
            onChange={(value) => onChange("content", value)}
            className="h-[350px]"
          />
        </div>
      </div>
    </form>
  );
}
