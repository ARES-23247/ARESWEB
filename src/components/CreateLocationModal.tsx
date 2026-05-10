import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { X, MapPin, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { locationSchema } from "@shared/routes/locations";
import { z } from "zod";
import { useSaveLocation } from "../api";

interface CreateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (locationName: string) => void;
}

export function CreateLocationModal({ isOpen, onClose, onSuccess }: CreateLocationModalProps) {
  const _queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState("");
  const [isSearchingOSM, setIsSearchingOSM] = useState(false);
  const [suggestions, setSuggestions] = useState<{ display_name: string }[]>([]);

  // Accessibility: Focus trap for keyboard navigation
  const { modalRef } = useFocusTrap({ isOpen, onClose });

  const form = useForm({
    defaultValues: {
      name: "",
      address: "",
      mapsUrl: "",
      isDeleted: 0
    }
  });


  const resetForm = useCallback(() => {
    form.setFieldValue("name", "");
    form.setFieldValue("address", "");
    form.setFieldValue("mapsUrl", "");
    form.setFieldValue("isDeleted", 0);
    setSuggestions([]);
    setErrorMsg("");
  }, [form]);

  const saveMutation = useSaveLocation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Venue record synchronized.");

        // Pass the new name back
        const formValues = form.state.values;
        onSuccess(formValues.name);

        resetForm();
      } else {
        setErrorMsg("Failed to save venue");
      }
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Network error.");
    }
  });

  // Debounced OSM Geocoding
  useEffect(() => {
    const timer = setTimeout(async () => {
      const addressQuery = form.state.values.address || "";
      if (!addressQuery || addressQuery.length < 4) {
        setSuggestions([]);
        return;
      }
      setIsSearchingOSM(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&addressdetails=1&limit=5`);
        const data = await res.json() as { display_name: string }[];
        setSuggestions(data);
      } catch (err) {
        console.error("OSM Err:", err);
      } finally {
        setIsSearchingOSM(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.state.values.address]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const onFormSubmit = () => {
    setErrorMsg("");
    const formValue = form.state.values;
    saveMutation.mutate({ ...formValue, id: undefined });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-location-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-obsidian border border-white/10 shadow-2xl ares-cut overflow-visible"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-ares-red/20 rounded-lg">
                  <MapPin className="text-ares-red" size={20} />
                </div>
                <div>
                  <h2 id="create-location-title" className="text-xl font-bold text-white uppercase tracking-wide">
                    Register New Venue
                  </h2>
                </div>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close modal"
                className="p-2 text-marble/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
              <form onSubmit={(e) => { e.preventDefault(); onFormSubmit(); }} className="p-6 space-y-5">
                {errorMsg && (
                  <div className="p-3 bg-ares-danger/10 border border-ares-danger/30 rounded text-ares-danger text-sm">
                    {errorMsg}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <div>
                    <label htmlFor="venue_name" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 block">Alias (e.g. &apos;Mars Workspace&apos;) *</label>
                    <form.Field
                      name="name"
                      children={(field) => (
                        <>
                          <input
                            id="venue_name"
                            type="text"
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className="w-full bg-obsidian border border-white/10 rounded p-3 text-white focus:border-ares-cyan outline-none"
                            placeholder="Enter short venue name"
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-[10px] font-black uppercase text-ares-red mt-1">{field.state.meta.errors[0]}</p>
                          )}
                        </>
                      )}
                    />
                  </div>

                  <div className="relative">
                    <label htmlFor="venue_address" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 block">Street Address (Auto-suggest) *</label>
                    <form.Field
                      name="address"
                      children={(field) => (
                        <>
                          <div className="relative">
                            <input
                              id="venue_address"
                              type="text"
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="w-full bg-obsidian border border-white/10 rounded p-3 text-white focus:border-ares-cyan outline-none"
                              placeholder="Start typing an address..."
                              autoComplete="off"
                            />
                            {isSearchingOSM && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-marble/50 text-xs">...</div>}
                          </div>
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-[10px] font-black uppercase text-ares-red mt-1">{field.state.meta.errors[0]}</p>
                          )}
                        </>
                      )}
                    />

                    {suggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-black border border-white/10 ares-cut-sm shadow-xl overflow-hidden">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full text-left p-3 hover:bg-ares-cyan hover:text-black border-b border-white/10 text-sm text-marble transition-colors last:border-0"
                            onClick={() => {
                              form.setFieldValue("address", s.display_name);
                              const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.display_name)}`;
                              form.setFieldValue("mapsUrl", mapsLink);
                              setSuggestions([]);
                            }}
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saveMutation.isPending}
                  className="px-5 py-2.5 text-sm font-bold text-marble/90 hover:text-white bg-white/5 hover:bg-white/10 transition-colors uppercase tracking-widest ares-cut-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2.5 text-sm font-bold uppercase tracking-widest bg-ares-cyan text-black hover:bg-white transition-colors ares-cut-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saveMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Save Venue
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

