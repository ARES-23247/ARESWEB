import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useGetLocations } from "../../api/locations";
import { useSaveEvent } from "../../api/events";

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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousDateRef = useRef<Date | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Fetch locations from registry (only when modal is open)
  const { data: locationsData } = useGetLocations({ enabled: isOpen, staleTime: 5 * 60 * 1000 });
  const locations = locationsData?.locations || [];
  const saveEvent = useSaveEvent({
    onSuccess: () => {
      toast.success("Event created successfully!");
      setFormData(DEFAULT_FORM_DATA);
      onClose();
      onSuccess?.();
    }
  });

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

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const titleInput = modalRef.current?.querySelector('#quick-event-title-input') as HTMLElement;
        if (titleInput) titleInput.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const locationValue = formData.location === "CUSTOM" ? undefined : formData.location;

      await saveEvent.mutateAsync({
        title: formData.title,
        dateStart: formData.dateStart,
        dateEnd: formData.dateEnd || undefined,
        location: locationValue || undefined,
        category: formData.category,
        description: "",
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
            className="relative w-full max-w-lg bg-obsidian border border-white/10 shadow-2xl ares-cut overflow-hidden"
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
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-ares-danger/10 border border-ares-danger/30 rounded text-ares-danger text-sm">
                  {error}
                </div>
              )}

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
                <div className="col-span-2">
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
                  const selectEl = document.getElementById('quick-event-location');
                  if (selectEl instanceof HTMLSelectElement && !Array.from(selectEl.options).some(opt => opt.value === newName)) {
                    const tempOpt = new Option(newName, newName);
                    selectEl.add(tempOpt, selectEl.options[selectEl.options.length - 1]);
                  }
                  updateField("location", newName);
                }}
              />

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
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
