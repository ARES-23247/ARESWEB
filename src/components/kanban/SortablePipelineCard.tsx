import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, GripVertical, Building, DollarSign } from "lucide-react";

interface PipelineItem {
  id?: string;
  company_name: string;
  status: string;
  estimated_value: number;
  notes?: string | null;
  contact_person?: string | null;
}

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
      className="bg-black/60 p-3 ares-cut-sm border border-white/5 group hover:border-white/20 transition-all cursor-pointer relative"
    >
      <div className="flex justify-between items-start mb-1 gap-2">
        <div className="flex items-start gap-2 flex-1 overflow-hidden">
          <div
            {...attributes}
            {...listeners}
            className="text-marble/20 hover:text-white cursor-grab active:cursor-grabbing p-0.5 -ml-1 mt-0.5"
            onClick={(e) => e.stopPropagation()} // Prevent edit modal from opening when dragging
          >
            <GripVertical size={14} />
          </div>
          <span className="text-xs font-bold text-white leading-tight truncate">{item.company_name}</span>
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
          {Number(item.estimated_value || 0).toLocaleString()}
        </div>
        {item.contact_person && (
          <div className="text-[10px] font-medium text-marble/40 truncate max-w-[120px]" title={item.contact_person}>
            {item.contact_person}
          </div>
        )}
      </div>
    </div>
  );
}
