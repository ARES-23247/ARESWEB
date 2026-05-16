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
      className="bg-black/60 p-3 ares-cut-sm border border-white/5 group hover:bg-white/5 hover:border-white/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="flex justify-between items-start mb-1 gap-2">
        <div className="flex items-start gap-2 flex-1 overflow-hidden">
          <div
            {...attributes}
            {...listeners}
            className="text-marble/20 hover:text-white cursor-grab active:cursor-grabbing p-0.5 -ml-1 mt-0.5"
            onClick={(e) => e.stopPropagation()} // Prevent edit modal from opening when dragging
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
            role="button"
            tabIndex={0}
          >
            <GripVertical size={14} />
          </div>
          <span className="text-xs font-bold text-white leading-tight truncate">{item.companyName}</span>
        </div>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete lead?")) {
              if (item.id) onDelete(item.id);
            }
          }} 
          className="opacity-0 group-hover:opacity-100 text-marble/20 hover:text-ares-red transition-all shrink-0"
          title="Delete lead"
          aria-label="Delete lead"
        >
          <Trash2 size={12} />
        </button>
      </div>
      
      <div className="pl-6 flex items-center justify-between">
        <div className="text-[10px] font-black text-ares-gold flex items-center">
          <DollarSign size={10} className="mr-0.5 opacity-70" />
          {Number(item.estimatedValue || 0).toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          {item.contactPerson && (
            <div className="text-[10px] font-medium text-marble/60 truncate max-w-[80px]" title={item.contactPerson}>
              {item.contactPerson}
            </div>
          )}
          {item.assignees && item.assignees.length > 0 && (
            <div className="flex -space-x-1" title={`${item.assignees.length} assignees`}>
              {item.assignees.slice(0, 3).map((a, i) => (
                <div key={i} className="w-4 h-4 rounded-full bg-ares-red/20 border border-ares-red flex items-center justify-center text-[8px] font-bold text-ares-red">
                  {/* Normally would show initials or avatar here */}
                  <span className="opacity-80"><User size={8} /></span>
                </div>
              ))}
              {item.assignees.length > 3 && (
                <div className="w-4 h-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[8px] font-bold text-marble">
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
