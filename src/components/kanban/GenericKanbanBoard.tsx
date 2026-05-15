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
import { type IconComponent } from "../../types/components";

export interface KanbanColumnConfig {
  label: string;
  icon: IconComponent;
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
  onReorder: (updates: { id: string; status: string; sortOrder: number }[]) => void;
  renderItem: (item: T) => React.ReactNode;
  renderDragOverlay?: (item: T) => React.ReactNode;
  isLoading?: boolean;
  headerContent?: React.ReactNode;
  activeFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
  emptyStateText?: string;
}

interface LocalItem<T> {
  id: string;
  item: T;
  status: string;
  sortOrder: number;
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

  // Maintain local state to allow instant drag-and-drop without snap-backs
  const [localItems, setLocalItems] = useState<LocalItem<T>[]>([]);

  // Sync with external items
  React.useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLocalItems(items.map(item => ({
        id: String(getId(item)),
        item,
        status: getStatus(item),
        sortOrder: getSortOrder(item)
      })));
    });
    return () => { active = false; };
  }, [items, getId, getStatus, getSortOrder]);

  // Group items by status column
  const grouped = useMemo(() => {
    const g: Record<string, LocalItem<T>[]> = {};
    for (const col of columns) g[col] = [];
    for (const lItem of localItems) {
      const col = columns.includes(lItem.status) ? lItem.status : columns[0];
      g[col].push(lItem);
    }
    // Sort within each column
    for (const col of columns) {
      g[col].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return g;
  }, [localItems, columns]);

  const filteredColumns = activeFilter
    ? { [activeFilter]: grouped[activeFilter] || [] }
    : grouped;

  const activeItem = activeId ? localItems.find(t => t.id === activeId)?.item : null;

  // ── DnD Handlers ────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const findColumn = (id: string): string | null => {
    if (columns.includes(id)) return id;
    for (const col of columns) {
      if (grouped[col].some(t => t.id === id)) return col;
    }
    return null;
  };

  // onDragOver handles moving items between columns instantly during the drag
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;
    
    if (!overId) return;

    const activeContainer = findColumn(String(active.id));
    const overContainer = findColumn(String(overId));

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setLocalItems((prev) => {
      return prev.map(item => {
        if (item.id === String(active.id)) {
          return { ...item, status: overContainer as string };
        }
        return item;
      });
    });
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

    const sourceItems = [...(grouped[sourceCol] || [])];
    const targetItems = sourceCol === targetCol ? sourceItems : [...(grouped[targetCol] || [])];

    if (sourceCol === targetCol) {
      const oldIndex = sourceItems.findIndex(t => t.id === activeItemId);
      const newIndex = sourceItems.findIndex(t => t.id === overId);
      
      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        const [moved] = sourceItems.splice(oldIndex, 1);
        sourceItems.splice(newIndex, 0, moved);
        
        const reorderUpdates = sourceItems.map((t, i) => ({
          id: t.id,
          status: sourceCol,
          sortOrder: i,
        }));

        // Optimitically update local items
        setLocalItems(prev => prev.map(item => {
          const update = reorderUpdates.find(u => u.id === item.id);
          if (update) return { ...item, status: update.status, sortOrder: update.sortOrder };
          return item;
        }));

        onReorder(reorderUpdates);
      }
    } else {
      // With onDragOver handling cross-container moves, active item is already in targetCol
      const oldIndex = targetItems.findIndex(t => t.id === activeItemId);
      if (oldIndex !== -1) targetItems.splice(oldIndex, 1);

      const overIndex = targetItems.findIndex(t => t.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : targetItems.length;
      
      const movedItem = localItems.find(t => t.id === activeItemId);
      if (!movedItem) return;

      targetItems.splice(insertAt, 0, movedItem);

      const reorderUpdates = targetItems.map((t, i) => ({ 
        id: t.id, 
        status: targetCol, 
        sortOrder: i 
      }));

      // Optimitically update local items
      setLocalItems(prev => prev.map(item => {
        const update = reorderUpdates.find(u => u.id === item.id);
        if (update) return { ...item, status: update.status, sortOrder: update.sortOrder };
        return item;
      }));
      
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

      {isLoading && localItems.length === 0 ? (
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
                <div key={status} className={`ares-cut-sm border ${config.border} ${config.bg} overflow-hidden flex flex-col backdrop-blur-md shadow-2xl relative group/col`}>
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                  <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 ares-cut-sm border ${config.border} bg-black/40 shadow-inner`}>
                        <StatusIcon size={14} className={config.text} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${config.text}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-ares-cyan/30 animate-pulse"></div>
                      <span className="text-[10px] font-mono font-black text-ares-gray bg-ares-gray-dark/80 px-2 py-0.5 ares-cut-sm border border-white/5 shadow-lg">
                        {String(colItems.length).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  <SortableContext
                    items={colItems.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                    id={status}
                  >
                    <DroppableColumn id={status} className="p-3 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 min-h-[250px] flex-1 bg-black/10">
                      {colItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 opacity-20">
                          <StatusIcon size={24} className="mb-3" />
                          <p className="text-ares-gray text-[9px] font-black uppercase tracking-[0.3em] italic">{emptyStateText}</p>
                        </div>
                      ) : (
                        colItems.map((lItem) => renderItem(lItem.item))
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
