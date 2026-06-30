import React from "react";
import MarkdownEditor from "@/components/MarkdownEditor";
import DocFormMetadataFields from "./DocFormMetadataFields";
import DocFormAttachmentFields from "./DocFormAttachmentFields";

interface DocFormMainFieldsProps {
  variant: "docs" | "documents" | "blog";
  formTitle: string;
  setFormTitle: (val: string) => void;
  formSlug: string;
  setFormSlug: (val: string) => void;
  editDoc: any;
  categories: string[];
  formCategory: string;
  setFormCategory: (val: string) => void;
  isCustomCategory: boolean;
  setIsCustomCategory: (val: boolean) => void;
  customCategoryText: string;
  setCustomCategoryText: (val: string) => void;
  formSortOrder: number;
  setFormSortOrder: (val: number) => void;
  formStatus: string;
  setFormStatus: (val: string) => void;
  isStudent: boolean;
  formDisplayInMathCorner: boolean;
  setFormDisplayInMathCorner: (val: boolean) => void;
  formDisplayInScienceCorner: boolean;
  setFormDisplayInScienceCorner: (val: boolean) => void;
  formDisplayInAreslib: boolean;
  setFormDisplayInAreslib: (val: boolean) => void;
  formIsPortfolio: boolean;
  setFormIsPortfolio: (val: boolean) => void;
  formIsExecutiveSummary: boolean;
  setFormIsExecutiveSummary: (val: boolean) => void;
  formFileUrl: string;
  setFormFileUrl: (val: string) => void;
  formThumbnail: string;
  setFormThumbnail: (val: string) => void;
  setIsPhotoPickerOpen: (val: boolean) => void;
  formAuthor: string;
  setFormAuthor: (val: string) => void;
  formDate: string;
  setFormDate: (val: string) => void;
  formDescription: string;
  setFormDescription: (val: string) => void;
  formContent: string;
  setFormContent: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  showAiSidebar: boolean;
  defaultCategory: string;
}

export default function DocFormMainFields({
  variant,
  formTitle,
  setFormTitle,
  formSlug,
  setFormSlug,
  editDoc,
  categories,
  formCategory,
  setFormCategory,
  isCustomCategory,
  setIsCustomCategory,
  customCategoryText,
  setCustomCategoryText,
  formSortOrder,
  setFormSortOrder,
  formStatus,
  setFormStatus,
  isStudent,
  formDisplayInMathCorner,
  setFormDisplayInMathCorner,
  formDisplayInScienceCorner,
  setFormDisplayInScienceCorner,
  formDisplayInAreslib,
  setFormDisplayInAreslib,
  formIsPortfolio,
  setFormIsPortfolio,
  formIsExecutiveSummary,
  setFormIsExecutiveSummary,
  formFileUrl,
  setFormFileUrl,
  formThumbnail,
  setFormThumbnail,
  setIsPhotoPickerOpen,
  formAuthor,
  setFormAuthor,
  formDate,
  setFormDate,
  formDescription,
  setFormDescription,
  formContent,
  setFormContent,
  onSubmit,
  showAiSidebar,
  defaultCategory
}: DocFormMainFieldsProps) {
  return (
    <form
      id="docForm"
      onSubmit={onSubmit}
      className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
        showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
      }`}
    >
      <div className="space-y-6 pb-6 text-left">
        {/* Title & Slug Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="formTitle"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Title
            </label>
            <input
              id="formTitle"
              type="text"
              placeholder="e.g. Pinpoint System Calibration"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
              required
            />
          </div>

          <div>
            <label
              htmlFor="formSlug"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Slug (URL Path)
            </label>
            <input
              id="formSlug"
              type="text"
              placeholder="e.g. pinpoint-calibration"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors font-mono disabled:opacity-50 focus:ring-2 focus:ring-ares-cyan"
              disabled={!!editDoc}
              required
            />
          </div>
        </div>

        {/* Docs Variant Fields */}
        {variant === "docs" && (
          <DocFormMetadataFields
            variant={variant}
            categories={categories}
            formCategory={formCategory}
            setFormCategory={setFormCategory}
            isCustomCategory={isCustomCategory}
            setIsCustomCategory={setIsCustomCategory}
            customCategoryText={customCategoryText}
            setCustomCategoryText={setCustomCategoryText}
            formSortOrder={formSortOrder}
            setFormSortOrder={setFormSortOrder}
            formStatus={formStatus}
            setFormStatus={setFormStatus}
            isStudent={isStudent}
            formDisplayInMathCorner={formDisplayInMathCorner}
            setFormDisplayInMathCorner={setFormDisplayInMathCorner}
            formDisplayInScienceCorner={formDisplayInScienceCorner}
            setFormDisplayInScienceCorner={setFormDisplayInScienceCorner}
            formDisplayInAreslib={formDisplayInAreslib}
            setFormDisplayInAreslib={setFormDisplayInAreslib}
            formIsPortfolio={formIsPortfolio}
            setFormIsPortfolio={setFormIsPortfolio}
            formIsExecutiveSummary={formIsExecutiveSummary}
            setFormIsExecutiveSummary={setFormIsExecutiveSummary}
          />
        )}

        {/* Documents Variant Fields */}
        {variant === "documents" && (
          <div className="space-y-6">
            <DocFormAttachmentFields
              variant={variant}
              formFileUrl={formFileUrl}
              setFormFileUrl={setFormFileUrl}
              formThumbnail={formThumbnail}
              setFormThumbnail={setFormThumbnail}
              setIsPhotoPickerOpen={setIsPhotoPickerOpen}
            />
            <DocFormMetadataFields
              variant={variant}
              categories={categories}
              formCategory={formCategory}
              setFormCategory={setFormCategory}
              isCustomCategory={isCustomCategory}
              setIsCustomCategory={setIsCustomCategory}
              customCategoryText={customCategoryText}
              setCustomCategoryText={setCustomCategoryText}
              formSortOrder={formSortOrder}
              setFormSortOrder={setFormSortOrder}
              formStatus={formStatus}
              setFormStatus={setFormStatus}
              isStudent={isStudent}
              formDisplayInMathCorner={formDisplayInMathCorner}
              setFormDisplayInMathCorner={setFormDisplayInMathCorner}
              formDisplayInScienceCorner={formDisplayInScienceCorner}
              setFormDisplayInScienceCorner={setFormDisplayInScienceCorner}
              formDisplayInAreslib={formDisplayInAreslib}
              setFormDisplayInAreslib={setFormDisplayInAreslib}
              formIsPortfolio={formIsPortfolio}
              setFormIsPortfolio={setFormIsPortfolio}
              formIsExecutiveSummary={formIsExecutiveSummary}
              setFormIsExecutiveSummary={setFormIsExecutiveSummary}
            />
          </div>
        )}

        {/* Blog Variant Fields */}
        {variant === "blog" && (
          <div className="space-y-6">
            <DocFormMetadataFields
              variant={variant}
              categories={categories}
              formCategory={formCategory}
              setFormCategory={setFormCategory}
              isCustomCategory={isCustomCategory}
              setIsCustomCategory={setIsCustomCategory}
              customCategoryText={customCategoryText}
              setCustomCategoryText={setCustomCategoryText}
              formSortOrder={formSortOrder}
              setFormSortOrder={setFormSortOrder}
              formStatus={formStatus}
              setFormStatus={setFormStatus}
              isStudent={isStudent}
              formDisplayInMathCorner={formDisplayInMathCorner}
              setFormDisplayInMathCorner={setFormDisplayInMathCorner}
              formDisplayInScienceCorner={formDisplayInScienceCorner}
              setFormDisplayInScienceCorner={setFormDisplayInScienceCorner}
              formDisplayInAreslib={formDisplayInAreslib}
              setFormDisplayInAreslib={setFormDisplayInAreslib}
              formIsPortfolio={formIsPortfolio}
              setFormIsPortfolio={setFormIsPortfolio}
              formIsExecutiveSummary={formIsExecutiveSummary}
              setFormIsExecutiveSummary={setFormIsExecutiveSummary}
              formAuthor={formAuthor}
              setFormAuthor={setFormAuthor}
              formDate={formDate}
              setFormDate={setFormDate}
            />
            <DocFormAttachmentFields
              variant={variant}
              formFileUrl={formFileUrl}
              setFormFileUrl={setFormFileUrl}
              formThumbnail={formThumbnail}
              setFormThumbnail={setFormThumbnail}
              setIsPhotoPickerOpen={setIsPhotoPickerOpen}
            />
          </div>
        )}

        {/* Abstract Description field */}
        <div>
          <label
            htmlFor="formDescription"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            Short Abstract Summary
          </label>
          <textarea
            id="formDescription"
            rows={2}
            placeholder="A quick overview sentence summarizing the content."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded p-3 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan resize-none leading-relaxed"
          />
        </div>

        {/* Markdown Content Editor */}
        <div>
          <label
            htmlFor="formContent"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            Document Content (Markdown & LaTeX)
          </label>
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
  );
}
