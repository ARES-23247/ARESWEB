import React from "react";

interface EditorFooterProps {
  errorMsg: string;
  isPending: boolean;
  isEditing: boolean;
  onDelete?: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  deleteText?: string;
  draftText?: string;
  publishText?: string;
  updateText?: string;
  userRole?: string | unknown;
  roundedClass?: string;
}

export default function EditorFooter({
  errorMsg,
  isPending,
  isEditing,
  onDelete,
  onSaveDraft,
  onPublish,
  deleteText = "DELETE",
  draftText = "SAVE AS DRAFT",
  publishText = "PUBLISH",
  updateText = "UPDATE",
  userRole,
  roundedClass = "rounded-full" // Use "ares-cut-sm" for docs/events
}: EditorFooterProps) {
  return (
    <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-800">
      <span className="text-ares-red text-sm font-medium">{errorMsg}</span>
      <div className="flex gap-4">
        {isEditing && onDelete && (
          <button
            onClick={onDelete}
            disabled={isPending}
            className={`px-6 py-3.5 ${roundedClass} font-bold transition-all shadow-xl disabled:opacity-50 border border-ares-red/30 bg-ares-red/10 text-ares-red hover:bg-ares-red hover:text-white`}
          >
            {deleteText}
          </button>
        )}
        <button
          onClick={onSaveDraft}
          disabled={isPending}
          className={`px-6 py-3.5 ${roundedClass} font-bold transition-all shadow-xl disabled:opacity-50 border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800`}
        >
          {isPending ? "SAVING..." : draftText}
        </button>
        <button
          onClick={onPublish}
          disabled={isPending}
          className={`flex items-center justify-center min-w-[200px] px-8 py-3.5 ${roundedClass} font-bold tracking-wide transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
            ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-0.5"}`}
        >
          {isPending ? "COMMITTING..." : isEditing ? updateText : (userRole === "author" ? "SUBMIT FOR REVIEW" : publishText)}
        </button>
      </div>
    </div>
  );
}
