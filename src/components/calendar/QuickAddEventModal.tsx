import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { X, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useGetLocations } from "../../api/locations";
import { useSaveEvent } from "../../api/events";
import { useRichEditor } from "../editor/useRichEditor";
import { EditorContent, type Editor } from "@tiptap/react";

function CompactEditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 bg-obsidian/95 border-b border-white/10 p-1.5 w-full">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 text-xs font-bold ares-cut-sm transition-all ${editor.isActive("bold") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 text-xs italic ares-cut-sm transition-all ${editor.isActive("italic") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-2 py-1 text-xs line-through ares-cut-sm transition-all ${editor.isActive("strike") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>S</button>
      <div className="w-px h-4 bg-white/10 mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 text-xs font-bold ares-cut-sm transition-all ${editor.isActive("heading", { level: 2 }) ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 text-xs ares-cut-sm transition-all ${editor.isActive("bulletList") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>• List</button>
      <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={`px-2 py-1 text-xs ares-cut-sm transition-all ${editor.isActive("taskList") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>☑️</button>
      <div className="w-px h-4 bg-white/10 mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`px-2 py-1 text-xs font-mono ares-cut-sm transition-all ${editor.isActive("codeBlock") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>{"<>"}</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2 py-1 text-xs ares-cut-sm transition-all ${editor.isActive("blockquote") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>&quot;</button>
      <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 text-xs ares-cut-sm transition-all text-marble/60 hover:bg-ares-gray-dark hover:text-white">―</button>
    </div>
  );
}

interface QuickAddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onSuccess?: () => void;
}

interface FormData {
  title: string;
  dateStart: string;
  dateEnd: string;
  location: string;
  customLocation: string;
  category: "internal" | "outreach" | "external";
}

const DEFAULT_FORM_DATA: FormData = {
  title: "",
  dateStart: "",
  dateEnd: "",
  location: "",
  customLocation: "",
  category: "internal",
};

import { CreateLocationModal } from "../CreateLocationModal";
import { LocationCombobox } from "../LocationCombobox";

// Fetch locations from registry (only when modal is open)
export function QuickAddEventModal({
  isOpen,
  onClose,
  selectedDate,
  onSuccess,
}: QuickAddEventModalProps) {
  const previousDateRef = useRef<Date | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Accessibility: Focus trap for keyboard navigation
  const { modalRef } = useFocusTrap({ isOpen, onClose });

  // Fetch locations from registry (only when modal is open)
  const { data: locationsData } = useGetLocations({ enabled: isOpen, staleTime: 0 });
  const locations = locationsData?.locations || [];
  const saveEvent = useSaveEvent({
    onSuccess: () => {
      toast.success("Event created successfully!");
      setFormData(DEFAULT_FORM_DATA);
      if (editor) {
        editor.commands.setContent("");
      }
      onClose();
      onSuccess?.();
    }
  });

  const editor = useRichEditor({
    placeholder: "<p>Add event description or notes...</p>",
  });

  // Reset editor when modal closes
  useEffect(() => {
    if (!isOpen && editor) {
      editor.commands.setContent("");
    }
  }, [isOpen, editor]);

  // Initialize form with selected date when modal opens or date changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      // Only update if the date has actually changed
      if (!previousDateRef.current || selectedDate.getTime() !== previousDateRef.current.getTime()) {
        const dateStr = format(selectedDate, "yyyy-MM-dd'T'HH:mm");
        setFormData({
          ...DEFAULT_FORM_DATA,
          dateStart: dateStr,
          dateEnd: format(new Date(selectedDate.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"), // +1 hour
        });
        previousDateRef.current = selectedDate;
      }
    } else if (!isOpen) {
      // Reset ref when modal closes
      previousDateRef.current = null;
    }
  }, [isOpen, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const locationValue = formData.location === "CUSTOM" ? undefined : formData.location;
      const descJson = editor ? JSON.stringify(editor.getJSON()) : "";

      await saveEvent.mutateAsync({
        title: formData.title,
        dateStart: formData.dateStart,
        dateEnd: formData.dateEnd || undefined,
        location: locationValue || undefined,
        category: formData.category,
        description: descJson,
        isDraft: false,
        isPotluck: false,
        isVolunteer: false,
        meetingNotes: undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-event-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-obsidian border border-white/10 shadow-2xl ares-cut overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-ares-red/20 rounded-lg">
                  <Plus className="text-ares-red" size={20} />
                </div>
                <div>
                  <h2 id="quick-event-title" className="text-xl font-bold text-white uppercase tracking-wide">
                    Quick Add Event
                  </h2>
                  {selectedDate && (
                    <p className="text-xs text-marble/70 uppercase tracking-widest flex items-center gap-2 mt-1">
                      <Calendar size={12} />
                      {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 text-marble/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="mb-5 p-3 bg-ares-danger/10 border border-ares-danger/30 rounded text-ares-danger text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-6">
                {/* Left Column: Core Details */}
                <div className="space-y-5">
                  {/* Title */}
                  <div>
                    <label htmlFor="quick-event-title-input" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                      Event Title <span className="text-ares-red">*</span>
                    </label>
                    <input
                      id="quick-event-title-input"
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="e.g., Team Practice, Outreach Demo"
                      className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label htmlFor="quick-event-category" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                      Category
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["internal", "outreach", "external"] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => updateField("category", cat)}
                          className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ares-cut-sm transition-all ${
                            formData.category === cat
                              ? cat === "internal"
                                ? "bg-ares-red text-white"
                                : cat === "outreach"
                                ? "bg-ares-gold text-black"
                                : "bg-ares-cyan text-black"
                              : "bg-white/5 text-marble/70 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {cat === "internal" ? "Practice" : cat === "outreach" ? "Outreach" : "Community"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date/Time Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="quick-event-start" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                        Start <span className="text-ares-red">*</span>
                      </label>
                      <input
                        id="quick-event-start"
                        type="datetime-local"
                        value={formData.dateStart}
                        onChange={(e) => updateField("dateStart", e.target.value)}
                        className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all [&::-webkit-calendar-picker-indicator]:invert"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-event-end" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                        End
                      </label>
                      <input
                        id="quick-event-end"
                        type="datetime-local"
                        value={formData.dateEnd}
                        onChange={(e) => updateField("dateEnd", e.target.value)}
                        className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all [&::-webkit-calendar-picker-indicator]:invert"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label htmlFor="quick-event-location" className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Location</span>
                      <span className="text-xs text-white/60 font-normal normal-case">Pick from registry</span>
                    </label>
                    <div className="relative group">
                      <LocationCombobox
                        id="quick-event-location"
                        locations={locations}
                        value={formData.location || ''}
                        onChange={(val) => updateField("location", val)}
                        onCustomClick={() => setIsLocationModalOpen(true)}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Description */}
                <div className="space-y-5 h-full flex flex-col">
                  <div>
                    <div className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                      Description
                    </div>
                    <div className="flex flex-col border border-white/10 ares-cut-sm bg-black/40 overflow-hidden h-[330px]">
                      {editor && <CompactEditorToolbar editor={editor} />}
                      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-obsidian">
                        <EditorContent editor={editor} className="prose prose-sm prose-invert max-w-none focus:outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <CreateLocationModal
                isOpen={isLocationModalOpen}
                onClose={() => {
                  setIsLocationModalOpen(false);
                  if (formData.location === "CUSTOM") {
                    updateField("location", "");
                  }
                }}
                onSuccess={(newName) => {
                  setIsLocationModalOpen(false);
                  updateField("location", newName);
                }}
              />

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-bold text-marble/90 hover:text-white bg-white/5 hover:bg-white/10 transition-colors uppercase tracking-widest ares-cut-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim()}
                  className="px-5 py-2.5 text-sm font-bold uppercase tracking-widest bg-ares-red text-white hover:bg-ares-red/80 transition-colors ares-cut-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Event
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
