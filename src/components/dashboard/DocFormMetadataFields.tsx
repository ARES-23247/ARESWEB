import React from "react";
import { AlertCircle } from "lucide-react";

interface DocFormMetadataFieldsProps {
  variant: "docs" | "documents" | "blog";
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
  formAuthor?: string;
  setFormAuthor?: (val: string) => void;
  formDate?: string;
  setFormDate?: (val: string) => void;
}

export default function DocFormMetadataFields({
  variant,
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
  formAuthor = "",
  setFormAuthor,
  formDate = "",
  setFormDate
}: DocFormMetadataFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Docs Variant Fields */}
      {variant === "docs" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="formCategory"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Category / Section
            </label>
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
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="custom">🛠️ Custom Category...</option>
            </select>
          </div>

          {isCustomCategory && (
            <div>
              <label
                htmlFor="customCategoryText"
                className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
              >
                Custom Category Name
              </label>
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
            <label
              htmlFor="formSortOrder"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Sorting Priority Order
            </label>
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
            <label
              htmlFor="formStatus"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Release Status
            </label>
            <select
              id="formStatus"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isStudent}
            >
              <option value="draft">🟡 Draft (Hidden)</option>
              {!isStudent && <option value="published">🟢 Published (Live)</option>}
            </select>
            {isStudent && (
              <div className="mt-1 text-[10px] text-ares-gold flex items-center gap-1">
                <AlertCircle size={10} />
                <span>Coaches/mentors must review before publishing.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents Variant Fields */}
      {variant === "documents" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="formCategory"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Document Type
            </label>
            <select
              id="formCategory"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="formStatus"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Status
            </label>
            <select
              id="formStatus"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isStudent}
            >
              <option value="draft">🟡 Draft (Hidden)</option>
              {!isStudent && <option value="published">🟢 Published (Live)</option>}
            </select>
            {isStudent && (
              <div className="mt-1 text-[10px] text-ares-gold flex items-center gap-1">
                <AlertCircle size={10} />
                <span>Coaches/mentors must review before publishing.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blog Variant Fields */}
      {variant === "blog" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="formAuthor"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Post Author
            </label>
            <input
              id="formAuthor"
              type="text"
              value={formAuthor}
              readOnly
              className="w-full bg-black/35 border border-white/5 rounded px-4 py-2.5 text-xs text-marble/50 focus:outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label
              htmlFor="formDate"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Publication Date
            </label>
            <input
              id="formDate"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate && setFormDate(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
              required
            />
          </div>

          <div>
            <label
              htmlFor="formStatus"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Status
            </label>
            <select
              id="formStatus"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isStudent}
            >
              <option value="draft">🟡 Draft (Hidden)</option>
              {!isStudent && <option value="published">🟢 Published (Live)</option>}
            </select>
            {isStudent && (
              <div className="mt-1 text-[10px] text-ares-gold flex items-center gap-1">
                <AlertCircle size={10} />
                <span>Coaches/mentors must review before publishing.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Display Destinations (Docs variant checkmarks) */}
      {variant === "docs" && (
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider mb-3 text-marble/60">
            Display Configurations
          </span>
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
      )}
    </div>
  );
}
