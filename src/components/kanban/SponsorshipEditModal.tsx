import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Building, DollarSign, Type, AlignLeft } from "lucide-react";

interface PipelineItem {
  id?: string;
  company_name: string;
  status: string;
  estimated_value: number;
  notes?: string | null;
  contact_person?: string | null;
}

interface SponsorshipEditModalProps {
  item: PipelineItem;
  onClose: () => void;
  onSave: (id: string, updates: Partial<PipelineItem>) => Promise<void>;
  onDelete: (id: string) => void;
}

const PIPELINE_COLUMNS = ["potential", "contacted", "pledged", "secured", "lost"] as const;

export default function SponsorshipEditModal({ item, onClose, onSave, onDelete }: SponsorshipEditModalProps) {
  const [companyName, setCompanyName] = useState(item.company_name || "");
  const [status, setStatus] = useState(item.status || "potential");
  const [estimatedValue, setEstimatedValue] = useState(item.estimated_value?.toString() || "0");
  const [contactPerson, setContactPerson] = useState(item.contact_person || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!item.id) return;
    setIsSaving(true);
    try {
      await onSave(item.id, {
        company_name: companyName,
        status,
        estimated_value: Number(estimatedValue),
        contact_person: contactPerson,
        notes: notes
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-obsidian border border-white/10 ares-cut p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-marble/50 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-black text-white mb-6 tracking-wide flex items-center gap-2">
          <Building className="text-ares-cyan" size={24} />
          Edit Sponsorship Lead
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="companyName" className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-1 block px-1">
              Company Name
            </label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 ares-cut-sm py-2 pl-10 pr-4 text-sm text-white focus:border-ares-red outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-1 block px-1">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white/5 border border-white/10 ares-cut-sm p-2.5 text-sm text-white focus:border-ares-red outline-none"
              >
                {PIPELINE_COLUMNS.map(c => (
                  <option key={c} value={c} className="bg-obsidian text-white">
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="estimatedValue" className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-1 block px-1">
                Est. Value ($)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
                <input
                  id="estimatedValue"
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 ares-cut-sm py-2 pl-10 pr-4 text-sm text-white focus:border-ares-red outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="contactPerson" className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-1 block px-1">
              Contact Person
            </label>
            <input
              id="contactPerson"
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. John Doe (john@example.com)"
              className="w-full bg-white/5 border border-white/10 ares-cut-sm p-2.5 text-sm text-white focus:border-ares-red outline-none"
            />
          </div>

          <div>
            <label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-marble/40 mb-1 block px-1">
              Notes
            </label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 text-marble/40" size={16} />
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details about the lead..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 ares-cut-sm py-2 pl-10 pr-4 text-sm text-white focus:border-ares-red outline-none resize-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm("Delete this lead? This cannot be undone.")) {
                if (item.id) onDelete(item.id);
              }
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-ares-red hover:bg-ares-red/10 ares-cut-sm transition-colors"
          >
            <Trash2 size={14} />
            Delete Lead
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-marble/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-ares-red text-white text-xs font-bold ares-cut-sm hover:bg-ares-danger transition-colors shadow-lg shadow-ares-red/20 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
