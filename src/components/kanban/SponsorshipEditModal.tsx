import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Building, DollarSign, Type, AlignLeft, User, CheckCircle2, Plus } from "lucide-react";
import { useGetUsers } from "../../api/users";
import ZulipThread from "../ZulipThread";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import type { PipelineItem } from "../../types/finance";

interface SponsorshipEditModalProps {
  item: PipelineItem;
  onClose: () => void;
  onSave: (id: string, updates: Partial<PipelineItem>) => Promise<void>;
  onDelete: (id: string) => void;
}

const PIPELINE_COLUMNS = ["potential", "contacted", "pledged", "secured", "lost"] as const;

export default function SponsorshipEditModal({ item, onClose, onSave, onDelete }: SponsorshipEditModalProps) {
  const [companyName, setCompanyName] = useState(item.companyName || "");
  const [status, setStatus] = useState(item.status || "potential");
  const [estimatedValue, setEstimatedValue] = useState(item.estimatedValue?.toString() || "0");
  const [contactPerson, setContactPerson] = useState(item.contactPerson || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(item.assignees || []);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Accessibility: Focus trap for keyboard navigation
  const { modalRef } = useFocusTrap({ isOpen: true, onClose });

  const { data: usersData } = useGetUsers({ limit: 100 }, { staleTime: 60000 });
  const teamMembers = usersData?.users ?? [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!item.id) return;
    setIsSaving(true);
    try {
      await onSave(item.id, {
        companyName: companyName,
        status,
        estimatedValue: Number(estimatedValue),
        contactPerson: contactPerson,
        notes: notes,
        assignees: assigneeIds,
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
        ref={modalRef}
        role="dialog"
        aria-modal="true"
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
            <label htmlFor="companyName" className="text-[10px] font-black uppercase tracking-widest text-marble/60 mb-1 block px-1">
              Company Name
            </label>
            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/60" size={16} />
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
              <label htmlFor="status" className="text-[10px] font-black uppercase tracking-widest text-marble/60 mb-1 block px-1">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as import("@shared/schemas/financeSchema").SponsorshipStatus)}
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
              <label htmlFor="estimatedValue" className="text-[10px] font-black uppercase tracking-widest text-marble/60 mb-1 block px-1">
                Est. Value ($)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/60" size={16} />
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
            <label htmlFor="contactPerson" className="text-[10px] font-black uppercase tracking-widest text-marble/60 mb-1 block px-1">
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
            <label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-marble/60 mb-1 block px-1">
              Notes
            </label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 text-marble/60" size={16} />
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

          <div className="relative" ref={dropdownRef}>
            <label className="text-[10px] font-black uppercase tracking-widest text-marble/60 mb-1 flex items-center gap-1 px-1">
              <User size={10} />
              Assignees ({assigneeIds.length})
            </label>
            
            <div className="flex flex-wrap gap-1.5 p-2 bg-white/5 border border-white/10 ares-cut-sm min-h-[42px] content-start">
              {teamMembers.filter((m: { id: string; nickname?: string | null; name?: string | null }) => assigneeIds.includes(m.id)).map((m: { id: string; nickname?: string | null; name?: string | null }) => (
                <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-ares-red/10 border border-ares-red/30 text-ares-red text-[10px] font-black ares-cut-sm uppercase tracking-wider">
                  {m.nickname || m.name}
                  <button onClick={() => toggleAssignee(m.id)} className="hover:text-white transition-colors" title="Remove Assignee">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button 
                onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-marble/60 hover:text-white transition-all ml-auto"
                title="Add assignee"
              >
                <Plus size={14} />
              </button>
            </div>

            <AnimatePresence>
              {showAssigneeDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-[60] left-0 right-0 mt-1 bg-obsidian border border-white/10 ares-cut-sm shadow-2xl max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
                >
                  {teamMembers.map((m: { id: string; nickname?: string | null; name?: string | null }) => (
                    <button
                      key={m.id}
                      onClick={() => toggleAssignee(m.id)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold transition-all flex items-center justify-between ${
                        assigneeIds.includes(m.id) 
                          ? "bg-ares-red/10 text-ares-red" 
                          : "text-marble hover:bg-white/5"
                      }`}
                    >
                      {m.nickname || m.name}
                      {assigneeIds.includes(m.id) && <CheckCircle2 size={12} />}
                    </button>
                  ))}
                  {teamMembers.length === 0 && (
                    <div className="p-3 text-xs text-marble/60 italic text-center">No team members found</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-white/5 pt-4">
            <ZulipThread stream="finance" topic={companyName || "New Sponsorship"} />
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
