import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DroppableColumn } from "./DroppableColumn";
import { RefreshCw } from "lucide-react";

export interface KanbanColumnConfig {
  label: string;
  icon: any;
  bg: string;
  text: string;
  border: string;
}

export interface GenericKanbanBoardProps<T> {
  items: T[];
  columns: readonly string[];
  columnConfig: Record<string, KanbanColumnConfig>;
  getId: (item: T) => string;
  getStatus: (item: T) => string;
  getSortOrder: (item: T) => number;
  onReorder: (updates: { id: string; status: string; sort_order: number }[]) => void;
  renderItem: (item: T) => React.ReactNode;
  renderDragOverlay?: (item: T) => React.ReactNode;
  isLoading?: boolean;
  headerContent?: React.ReactNode;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
  emptyStateText?: string;
}

export function GenericKanbanBoard<T>({
  items,
  columns,
  columnConfig,
  getId,
  getStatus,
  getSortOrder,
  onReorder,
  renderItem,
  renderDragOverlay,
  isLoading = false,
  headerContent,
  activeFilter = null,
  onFilterChange,
  emptyStateText = "No items",
}: GenericKanbanBoardProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Group items by status column
  const grouped = useMemo(() => {
    const g: Record<string, T[]> = {};
    for (const col of columns) g[col] = [];
    for (const item of items) {
      const s = getStatus(item);
      const col = columns.includes(s) ? s : columns[0];
      g[col].push(item);
    }
    // Sort within each column
    for (const col of columns) {
      g[col].sort((a, b) => getSortOrder(a) - getSortOrder(b));
    }
    return g;
  }, [items, columns, getStatus, getSortOrder]);

  const filteredColumns = activeFilter
    ? { [activeFilter]: grouped[activeFilter] || [] }
    : grouped;

  const activeItem = activeId ? items.find(t => getId(t) === activeId) : null;

  // ── DnD Handlers ────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const findColumn = (id: string): string | null => {
    if (columns.includes(id)) return id;
    for (const col of columns) {
      if (grouped[col].some(t => String(getId(t)) === id)) return col;
    }
    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Only used to provide visual feedback if needed
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeItemId = String(active.id);
    const overId = String(over.id);

    const sourceCol = findColumn(activeItemId);
    const targetCol = findColumn(overId);

    if (!sourceCol || !targetCol) return;

    const item = items.find(t => String(getId(t)) === activeItemId);
    if (!item) return;

    const sourceItems = [...(grouped[sourceCol] || [])];
    const targetItems = sourceCol === targetCol ? sourceItems : [...(grouped[targetCol] || [])];

    if (sourceCol === targetCol) {
      const oldIndex = sourceItems.findIndex(t => String(getId(t)) === activeItemId);
      const newIndex = sourceItems.findIndex(t => String(getId(t)) === overId);
      
      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        const [moved] = sourceItems.splice(oldIndex, 1);
        sourceItems.splice(newIndex, 0, moved);
        
        const reorderUpdates: { id: string; status: string; sort_order: number }[] = sourceItems.map((t, i) => ({
          id: String(getId(t)),
          status: sourceCol,
          sort_order: i,
        }));
        onReorder(reorderUpdates);
      }
    } else {
      const oldIndex = sourceItems.findIndex(t => String(getId(t)) === activeItemId);
      if (oldIndex !== -1) sourceItems.splice(oldIndex, 1);

      const overIndex = targetItems.findIndex(t => String(getId(t)) === overId);
      const insertAt = overIndex >= 0 ? overIndex : targetItems.length;
      
      // Calculate order
      targetItems.splice(insertAt, 0, item);

      const reorderUpdates: { id: string; status: string; sort_order: number }[] = [
        ...sourceItems.map((t, i) => ({ id: String(getId(t)), status: sourceCol, sort_order: i })),
        ...targetItems.map((t, i) => ({ id: String(getId(t)), status: targetCol, sort_order: i }))
      ];
      
      onReorder(reorderUpdates);
    }
  };

  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6">
      {headerContent && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-4">
          {headerContent}
          {onFilterChange && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex bg-ares-gray-dark/50 ares-cut-sm p-0.5 border border-white/5">
                <button
                  onClick={() => onFilterChange(null)}
                  className={`px-2.5 py-1 text-xs font-bold ares-cut-sm transition-all ${
                    !activeFilter ? "bg-white/10 text-white" : "text-ares-gray hover:text-white"
                  }`}
                >
                  All
                </button>
                {columns.map(col => {
                  const config = columnConfig[col];
                  if (!config) return null;
                  return (
                    <button
                      key={col}
                      onClick={() => onFilterChange(activeFilter === col ? null : col)}
                      className={`px-2.5 py-1 text-xs font-bold ares-cut-sm transition-all ${
                        activeFilter === col ? "bg-white/10 text-white" : "text-ares-gray hover:text-white"
                      }`}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="text-ares-gray animate-spin" size={24} />
            <p className="text-ares-gray text-sm font-bold">Loading...</p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(filteredColumns).map(([status, colItems]) => {
              const config = columnConfig[status];
              if (!config) return null;
              const StatusIcon = config.icon;

              return (
                <div key={status} className={`ares-cut-sm border ${config.border} ${config.bg} overflow-hidden flex flex-col`}>
                  <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon size={14} className={config.text} />
                      <span className={`text-xs font-black uppercase tracking-wider ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-ares-gray bg-ares-gray-dark/80 px-2 py-0.5 ares-cut-sm">
                      {colItems.length}
                    </span>
                  </div>
                  <SortableContext
                    items={colItems.map(i => String(getId(i)))}
                    strategy={verticalListSortingStrategy}
                    id={status}
                  >
                    <DroppableColumn id={status} className="p-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 min-h-[150px] flex-1">
                      {colItems.length === 0 ? (
                        <p className="text-ares-gray text-xs text-center py-6 italic">{emptyStateText}</p>
                      ) : (
                        colItems.map((item) => renderItem(item))
                      )}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeItem && renderDragOverlay ? renderDragOverlay(activeItem) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
