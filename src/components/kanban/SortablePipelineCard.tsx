import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, GripVertical, DollarSign, User } from "lucide-react";

import type { PipelineItem } from "../../types/finance";

interface SortablePipelineCardProps {
  item: PipelineItem;
  onDelete: (id: string) => void;
  onEdit: (item: PipelineItem) => void;
}

export function SortablePipelineCard({ item, onDelete, onEdit }: SortablePipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(item.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onEdit(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(item); } }}
      role="button"
      tabIndex={0}
      className="bg-black/60 p-4 ares-cut-sm border border-white/5 group hover:border-ares-red/30 transition-all cursor-pointer relative shadow-lg hover:shadow-ares-red/10 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover:h-full transition-all duration-300"></div>
      
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex items-start gap-3 flex-1 overflow-hidden">
          <div
            {...attributes}
            {...listeners}
            className="text-marble/10 group-hover:text-ares-red/60 cursor-grab active:cursor-grabbing p-1 -ml-2 -mt-1 transition-colors"
            onClick={(e) => e.stopPropagation()} 
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
            role="button"
            tabIndex={0}
          >
            <GripVertical size={16} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white leading-tight truncate group-hover:text-ares-red transition-colors">{item.companyName}</span>
        </div>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("TERMINATE_LEAD?")) {
              if (item.id) onDelete(item.id);
            }
          }} 
          className="opacity-0 group-hover:opacity-100 p-1 text-marble/20 hover:text-ares-red transition-all shrink-0 ares-cut-sm bg-white/5 hover:bg-ares-red/10 border border-white/5"
          title="Delete lead"
          aria-label="Delete lead"
        >
          <Trash2 size={12} />
        </button>
      </div>
      
      <div className="pl-7 flex items-center justify-between gap-4">
        <div className="text-[10px] font-black text-ares-gold flex items-center tracking-tighter">
          <DollarSign size={10} className="mr-0.5 opacity-50" />
          {Number(item.estimatedValue || 0).toLocaleString()}
        </div>
        <div className="flex items-center gap-3 overflow-hidden">
          {item.contactPerson && (
            <div className="text-[9px] font-black uppercase tracking-widest text-marble/20 truncate max-w-[80px]" title={item.contactPerson}>
              {item.contactPerson}
            </div>
          )}
          {item.assignees && item.assignees.length > 0 && (
            <div className="flex -space-x-2 shrink-0" title={`${item.assignees.length} assignees`}>
              {item.assignees.slice(0, 3).map((a, i) => (
                <div key={i} className="w-5 h-5 ares-cut-sm bg-black border border-ares-red/40 flex items-center justify-center text-[8px] font-bold text-ares-red shadow-lg group-hover:border-ares-red transition-colors">
                  <User size={10} className="opacity-60" />
                </div>
              ))}
              {item.assignees.length > 3 && (
                <div className="w-5 h-5 ares-cut-sm bg-black border border-white/10 flex items-center justify-center text-[8px] font-black text-marble/40">
                  +{item.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
