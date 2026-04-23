import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  GitBranch, Plus, RefreshCw, 
  CheckCircle2, Circle, Clock, AlertTriangle 
} from "lucide-react";
import { ProjectBoard, ProjectItem } from "./types";

interface ProjectBoardKanbanProps {
  board: ProjectBoard | null;
  isLoading: boolean;
  isCreating: boolean;
  newTaskTitle: string;
  setNewTaskTitle: (val: string) => void;
  showCreateForm: boolean;
  setShowCreateForm: (val: boolean) => void;
  onCreateTask: () => void;
  onRefresh: () => void;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  "Todo":        { bg: "bg-ares-gray-dark/60",   text: "text-white/60", border: "border-ares-gray/30", icon: Circle },
  "In Progress": { bg: "bg-ares-cyan/10",         text: "text-ares-cyan",  border: "border-ares-cyan/30", icon: Clock },
  "Done":        { bg: "bg-ares-gold/10",         text: "text-ares-gold",  border: "border-ares-gold/30", icon: CheckCircle2 },
  "Blocked":     { bg: "bg-ares-red",           text: "text-white",    border: "border-ares-red/30",  icon: AlertTriangle },
};

const defaultStatus = { bg: "bg-ares-gray-dark/60", text: "text-white/60", border: "border-ares-gray/30", icon: Circle };

function getStatusConfig(status?: string) {
  if (!status) return defaultStatus;
  return statusConfig[status] || defaultStatus;
}

export default function ProjectBoardKanban({
  board, isLoading, isCreating, newTaskTitle, setNewTaskTitle,
  showCreateForm, setShowCreateForm, onCreateTask, onRefresh: _onRefresh
}: ProjectBoardKanbanProps) {
  const [activeKanbanFilter, setActiveKanbanFilter] = useState<string | null>(null);

  const kanbanColumns = ["Todo", "In Progress", "Done", "Blocked"];
  const groupedItems = kanbanColumns.reduce((acc, col) => {
    acc[col] = board?.items.filter(i => {
      if (!i.status && col === "Todo") return true;
      return i.status === col;
    }) || [];
    return acc;
  }, {} as Record<string, ProjectItem[]>);

  const filteredColumns = activeKanbanFilter 
    ? { [activeKanbanFilter]: groupedItems[activeKanbanFilter] || [] }
    : groupedItems;

  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
          <GitBranch size={16} className="text-ares-cyan" />
          {board?.title || "Project Board"}
        </h3>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-ares-gray-dark/50 ares-cut-sm p-0.5 border border-white/5">
            <button
              onClick={() => setActiveKanbanFilter(null)}
              className={`px-2.5 py-1 text-xs font-bold ares-cut-sm transition-all ${
                !activeKanbanFilter ? "bg-white/10 text-white" : "text-ares-gray hover:text-white"
              }`}
            >
              All
            </button>
            {kanbanColumns.map(col => (
              <button
                key={col}
                onClick={() => setActiveKanbanFilter(activeKanbanFilter === col ? null : col)}
                className={`px-2.5 py-1 text-xs font-bold ares-cut-sm transition-all ${
                  activeKanbanFilter === col ? "bg-white/10 text-white" : "text-ares-gray hover:text-white"
                }`}
              >
                {col}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="p-2 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan ares-cut-sm transition-all"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex gap-2 p-3 bg-ares-gray-dark/50 ares-cut-sm border border-white/5">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onCreateTask()}
                placeholder="New task title..."
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-ares-gray font-medium"
              />
              <button
                onClick={onCreateTask}
                disabled={isCreating || !newTaskTitle.trim()}
                className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan font-bold text-xs ares-cut-sm border border-ares-cyan/30 transition-all disabled:opacity-30"
              >
                {isCreating ? <RefreshCw size={14} className="animate-spin" /> : "Create"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!board ? (
        <div className="text-center py-12">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="text-ares-gray animate-spin" size={24} />
              <p className="text-ares-gray text-sm font-bold">Loading project board...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <GitBranch className="text-ares-gray" size={32} />
              <p className="text-ares-gray text-sm font-bold">GitHub Projects not configured</p>
              <p className="text-white/50 text-xs max-w-sm mx-auto">
                Set your <code className="text-ares-cyan">GITHUB_PAT</code> and <code className="text-ares-cyan">GITHUB_PROJECT_ID</code> in System Integrations to enable the project board.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(filteredColumns).map(([status, items]) => {
            const config = getStatusConfig(status);
            const StatusIcon = config.icon;

            return (
              <div key={status} className={`ares-cut-sm border ${config.border} ${config.bg} overflow-hidden`}>
                <div className="p-3 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon size={14} className={config.text} />
                    <span className={`text-xs font-black uppercase tracking-wider ${config.text}`}>
                      {status}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-ares-gray bg-ares-gray-dark/80 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/5">
                  {items.length === 0 ? (
                    <p className="text-ares-gray text-xs text-center py-6 italic">No items</p>
                  ) : (
                    items.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-obsidian/60 hover:bg-ares-gray-dark/60 ares-cut-sm border border-white/5 hover:border-white/10 transition-all cursor-default group"
                      >
                        <p className="text-sm font-bold text-white leading-tight mb-1.5">{item.title}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {item.assignees.slice(0, 2).map(a => (
                              <span key={a} className="text-[9px] font-bold text-ares-gray bg-ares-gray-dark px-1.5 py-0.5 rounded">
                                @{a}
                              </span>
                            ))}
                          </div>
                          <span className="text-[9px] text-ares-gray font-mono">
                            {item.type === "DRAFT_ISSUE" ? "Draft" : item.type === "ISSUE" ? "Issue" : "PR"}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
