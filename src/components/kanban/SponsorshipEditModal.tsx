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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-obsidian border border-white/10 ares-cut-lg p-10 shadow-2xl backdrop-blur-xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ares-red to-ares-cyan opacity-50"></div>
        
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-6 right-6 text-marble/30 hover:text-white transition-all hover:rotate-90 duration-300"
        >
          <X size={24} />
        </button>

        <div className="mb-10">
          <h3 className="text-3xl font-black text-white tracking-tighter flex items-center gap-4 uppercase">
            <div className="p-2 bg-white/5 ares-cut-sm border border-white/10">
              <Building className="text-ares-cyan" size={28} />
            </div>
            LEAD_MODIFICATION
          </h3>
          <p className="text-marble/40 text-[10px] mt-3 uppercase tracking-[0.4em] font-black flex items-center gap-2">
            <span className="w-8 h-px bg-white/10"></span>
            MANAGE_SPONSORSHIP_LIFECYCLE_AND_COMMUNICATIONS
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="companyName" className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/30 mb-2 block px-1">
                CORPORATE_IDENTITY
              </label>
              <div className="relative group">
                <div className="absolute inset-0 bg-ares-red/5 opacity-0 group-focus-within:opacity-100 transition-opacity ares-cut-sm pointer-events-none"></div>
                <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-marble/20 group-focus-within:text-ares-red transition-colors" size={18} />
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 ares-cut-sm py-3.5 pl-12 pr-4 text-sm font-bold text-white focus:border-ares-red/50 outline-none transition-all placeholder:text-marble/10"
                  placeholder="ENTER_COMPANY_NAME"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/30 mb-2 block px-1">
                  PIPELINE_STATE
                </label>
                <div className="relative">
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as import("@shared/schemas/financeSchema").SponsorshipStatus)}
                    className="w-full bg-white/[0.03] border border-white/10 ares-cut-sm py-3.5 px-4 text-[10px] font-black uppercase tracking-widest text-white focus:border-ares-red/50 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {PIPELINE_COLUMNS.map(c => (
                      <option key={c} value={c} className="bg-obsidian text-white">
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-marble/30">
                    <AlignLeft size={14} className="rotate-90" />
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="estimatedValue" className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/30 mb-2 block px-1">
                  VALUE_PROJECTION
                </label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-marble/20 group-focus-within:text-ares-gold transition-colors" size={18} />
                  <input
                    id="estimatedValue"
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 ares-cut-sm py-3.5 pl-12 pr-4 text-sm font-black text-ares-gold focus:border-ares-gold/50 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="contactPerson" className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/30 mb-2 block px-1">
                POINT_OF_CONTACT
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-marble/20 group-focus-within:text-ares-cyan transition-colors" size={18} />
                <input
                  id="contactPerson"
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="NAME_OR_EMAIL_UPLINK"
                  className="w-full bg-white/[0.03] border border-white/10 ares-cut-sm py-3.5 pl-12 pr-4 text-sm font-bold text-white focus:border-ares-cyan/50 outline-none transition-all placeholder:text-marble/10"
                />
              </div>
            </div>

            <div className="relative" ref={dropdownRef}>
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/30 mb-2 flex items-center gap-2 px-1">
                <User size={12} className="text-ares-red" />
                OPERATIONAL_ASSIGNEES ({assigneeIds.length})
              </label>
              
              <div className="flex flex-wrap gap-2 p-3 bg-white/[0.03] border border-white/10 ares-cut-sm min-h-[54px] content-start relative group">
                {teamMembers.filter((m: { id: string; nickname?: string | null; name?: string | null }) => assigneeIds.includes(m.id)).map((m: { id: string; nickname?: string | null; name?: string | null }) => (
                  <span key={m.id} className="inline-flex items-center gap-2 px-3 py-1 bg-ares-red/10 border border-ares-red/30 text-ares-red text-[10px] font-black ares-cut-sm uppercase tracking-widest animate-in fade-in zoom-in-95">
                    {m.nickname || m.name}
                    <button onClick={() => toggleAssignee(m.id)} className="hover:text-white transition-colors" title="Remove Assignee">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button 
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  className="inline-flex items-center justify-center w-8 h-8 ares-cut-sm bg-white/5 border border-white/10 hover:bg-white/10 text-marble/40 hover:text-white transition-all ml-auto"
                  title="Add assignee"
                >
                  <Plus size={18} />
                </button>
              </div>

              <AnimatePresence>
                {showAssigneeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-[60] left-0 right-0 mt-2 bg-obsidian border border-white/10 ares-cut-sm shadow-2xl max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-ares-red/20 backdrop-blur-xl"
                  >
                    {teamMembers.map((m: { id: string; nickname?: string | null; name?: string | null }) => (
                      <button
                        key={m.id}
                        onClick={() => toggleAssignee(m.id)}
                        className={`w-full text-left px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-between border-b border-white/5 last:border-0 ${
                          assigneeIds.includes(m.id) 
                            ? "bg-ares-red/20 text-white" 
                            : "text-marble/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {m.nickname || m.name}
                        {assigneeIds.includes(m.id) && <CheckCircle2 size={14} className="text-ares-red" />}
                      </button>
                    ))}
                    {teamMembers.length === 0 && (
                      <div className="p-6 text-[10px] font-black uppercase tracking-widest text-marble/20 text-center">NO_MEMBERS_DETECTED</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-6 flex flex-col">
            <div className="flex-1 flex flex-col">
              <label htmlFor="notes" className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/30 mb-2 block px-1">
                INTELLIGENCE_NOTES
              </label>
              <div className="relative group flex-1">
                <AlignLeft className="absolute left-4 top-4 text-marble/20 group-focus-within:text-ares-cyan transition-colors" size={18} />
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="LOG_CRITICAL_LEAD_DATA..."
                  className="w-full h-full min-h-[150px] bg-white/[0.03] border border-white/10 ares-cut-sm py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-ares-cyan/50 outline-none transition-all placeholder:text-marble/10 resize-none"
                />
              </div>
            </div>

            <div className="bg-black/40 border border-white/5 ares-cut-sm p-6 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-marble/40">ZULIP_COMMS_UPLINK</span>
                <div className="w-2 h-2 rounded-full bg-ares-green animate-pulse"></div>
              </div>
              <div className="h-[250px] overflow-hidden border border-white/5 ares-cut-sm">
                <ZulipThread stream="finance" topic={companyName || "New Sponsorship"} />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 mt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
          <button
            onClick={() => {
              if (confirm("TERMINATE_LEAD_DATA? THIS_ACTION_IS_IRREVERSIBLE.")) {
                if (item.id) onDelete(item.id);
              }
            }}
            className="flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-ares-red hover:bg-ares-red/10 ares-cut-sm transition-all border border-transparent hover:border-ares-red/20"
          >
            <Trash2 size={16} />
            TERMINATE_LEAD
          </button>
          
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 hover:text-white transition-colors"
            >
              ABORT
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-12 py-3 bg-ares-red text-white text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm hover:bg-ares-danger transition-all shadow-xl shadow-ares-red/20 disabled:opacity-50 border border-ares-red/50 active:scale-95"
            >
              {isSaving ? "SYNCING..." : "COMMIT_CHANGES"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
