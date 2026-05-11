import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  X, Save, Trash2, Calendar, User, AlertTriangle, Flag,
  CheckCircle2, Circle, Clock, Plus, Layout, Layers,
  Link as LinkIcon, Tag, ListTodo, Paperclip, FileText, Image as ImageIcon
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetUsers, useCreateTask, useGetTasks,
  useCreateTaskAttachment, useDeleteTaskAttachment,
  useCreateTaskChecklist, useUpdateTaskChecklist, useDeleteTaskChecklist,
  useSetTaskLabels
} from "../../api";
import { type Task as TaskItem } from "../../api";
import { KANBAN_SUBTEAMS } from "../command/ProjectBoardKanban";
import ZulipThread from "../ZulipThread";

import { CollaborativeEditorRoom, useCollaborativeEditor } from "../editor/CollaborativeEditorRoom";
import { useRichEditor } from "../editor/useRichEditor";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";

interface TaskDetailsModalProps {
  task: TaskItem;
  onClose: () => void;
  onSave: (id: string, updates: import("../../api").UpdateTaskRequest) => Promise<void>;
  onDelete: (id: string) => void;
  onTaskClick?: (task: TaskItem) => void;
}

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo", icon: Circle, color: "text-white/60" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-ares-cyan" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-ares-gold" },
  { value: "blocked", label: "Parked", icon: AlertTriangle, color: "text-ares-red" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-white/5 text-ares-gray/50" },
  { value: "normal", label: "Normal", color: "bg-white/5 text-ares-gray" },
  { value: "high", label: "High", color: "bg-ares-bronze/30 text-ares-bronze" },
  { value: "urgent", label: "Urgent", color: "bg-ares-red/20 text-ares-red" },
];

// Compact toolbar for the task modal – only essential formatting buttons, no import/export/fullscreen/editor-content
function CompactEditorToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 bg-obsidian/95 border-b border-white/10 p-1.5 w-full">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 text-xs font-bold ares-cut-sm transition-all ${editor.isActive("bold") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 text-xs italic ares-cut-sm transition-all ${editor.isActive("italic") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-2 py-1 text-xs line-through ares-cut-sm transition-all ${editor.isActive("strike") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>S</button>
      <div className="w-px h-4 bg-white/10 mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 text-xs font-bold ares-cut-sm transition-all ${editor.isActive("heading", { level: 2 }) ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 text-xs ares-cut-sm transition-all ${editor.isActive("bulletList") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>• List</button>
      <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={`px-2 py-1 text-xs ares-cut-sm transition-all ${editor.isActive("taskList") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>☑️</button>
      <div className="w-px h-4 bg-white/10 mx-0.5" />
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`px-2 py-1 text-xs font-mono ares-cut-sm transition-all ${editor.isActive("codeBlock") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>{"<>"}</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2 py-1 text-xs ares-cut-sm transition-all ${editor.isActive("blockquote") ? "bg-ares-gray-dark text-white" : "text-marble/60 hover:bg-ares-gray-dark hover:text-white"}`}>&quot;</button>
      <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 text-xs ares-cut-sm transition-all text-marble/60 hover:bg-ares-gray-dark hover:text-white">―</button>
    </div>
  );
}

// Inner Editor that connects to PartyKit
function TaskEditorInner({ initialContent, onDescriptionChange }: { initialContent: string; onDescriptionChange: (content: string) => void }) {
  const { ydoc, provider } = useCollaborativeEditor();
  const editor = useRichEditor({
    placeholder: "<p>Write a detailed task description...</p>",
    ydoc,
    provider,
    yfield: 'default'
  });

  // Seed the editor with initial content if the ydoc is empty
  useEffect(() => {
    if (!editor || !initialContent) return;

    // In collaborative mode, avoid overwriting active live edits with the static DB snapshot.
    // We only inject the DB snapshot if the YDoc is currently empty (e.g. first user joining a new session).
    const shouldSetContent = !ydoc || ydoc.getXmlFragment("default").length === 0;

    if (shouldSetContent) {
      try {
        const parsed = JSON.parse(initialContent);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.content)) {
          try {
            editor.commands.setContent(parsed);
          } catch (renderErr) {
            console.error("Tiptap render error on AST", renderErr);
            editor.commands.setContent(initialContent);
          }
        } else {
          editor.commands.setContent(initialContent);
        }
      } catch {
        editor.commands.setContent(initialContent);
      }
    }
  }, [editor, initialContent, ydoc]);

  // Sync back to parent when editor changes
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      onDescriptionChange(JSON.stringify(editor.getJSON()));
    };
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor, onDescriptionChange]);

  return (
    <div className="flex flex-col border border-white/10 ares-cut-sm bg-black/40 overflow-hidden flex-1 min-h-[250px]">
      {editor && <CompactEditorToolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-obsidian">
        <EditorContent editor={editor} className="prose prose-sm prose-invert max-w-none focus:outline-none" />
      </div>
    </div>
  );
}

export default function TaskDetailsModal({ task, onClose, onSave, onDelete, onTaskClick }: TaskDetailsModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [subteam, setSubteam] = useState(task.subteam || "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees?.map((a: { id: string }) => a.id) || []);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [timeSpentSeconds, setTimeSpentSeconds] = useState(task.timeSpentSeconds || 0);

  const queryClient = useQueryClient();

  const createSubtaskMutation = useCreateTask({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "subtasks", task.id] });
    },
  });

  const { data: usersData } = useGetUsers({ limit: 100 });
  const teamMembers = usersData?.users ?? [];

  const { data: subtasksData } = useGetTasks({ parentId: task.id }, { staleTime: 10000 });
  const subtasks = subtasksData?.tasks ?? [];

  // Checklists
  const [newChecklist, setNewChecklist] = useState("");
  const createChecklistMutation = useCreateTaskChecklist();
  const updateChecklistMutation = useUpdateTaskChecklist();
  const deleteChecklistMutation = useDeleteTaskChecklist();

  // Attachments
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const createAttachmentMutation = useCreateTaskAttachment();
  const deleteAttachmentMutation = useDeleteTaskAttachment();

  // Labels
  const setLabelsMutation = useSetTaskLabels();
  const [labelIds, setLabelIds] = useState<string[]>(task.labels?.map(l => l.id) || []);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  // Global predefined ARES labels to emulate the DB entries until an admin UI exists
  const GLOBAL_LABELS = [
    { id: "lbl-bug", name: "Bug", colorTheme: "text-ares-red bg-ares-red/10 border-ares-red/30" },
    { id: "lbl-feature", name: "Feature", colorTheme: "text-ares-cyan bg-ares-cyan/10 border-ares-cyan/30" },
    { id: "lbl-urgent", name: "Urgent", colorTheme: "text-ares-gold bg-ares-gold/10 border-ares-gold/30" },
    { id: "lbl-design", name: "Design", colorTheme: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
    { id: "lbl-backend", name: "Backend", colorTheme: "text-green-400 bg-green-400/10 border-green-400/30" }
  ];

  // Accessibility: Focus trap for keyboard navigation
  const { modalRef: focusTrapRef } = useFocusTrap({
    isOpen: true, // TaskDetailsModal is always rendered when open
    onClose,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: import("../../api").UpdateTaskRequest = {};
      if (title !== task.title) updates.title = title;
      if (description !== (task.description || "")) updates.description = description || null;
      if (status !== task.status) updates.status = status as "todo" | "in_progress" | "done" | "blocked";
      if (priority !== task.priority) updates.priority = priority as "low" | "normal" | "high" | "urgent";
      if (subteam !== (task.subteam || "")) updates.subteam = subteam || null;
      if (dueDate !== (task.dueDate || "")) updates.dueDate = dueDate || null;
      
      const currentIds = task.assignees?.map((a: { id: string }) => a.id) || [];
      const hasAssigneeChange = assigneeIds.length !== currentIds.length || 
        !assigneeIds.every(id => currentIds.includes(id));
      
      if (hasAssigneeChange) {
        updates.assignees = assigneeIds;
      }
      
      if (timeSpentSeconds !== (task.timeSpentSeconds || 0)) {
        updates.timeSpentSeconds = timeSpentSeconds;
      }

      const currentLabelIds = task.labels?.map(l => l.id) || [];
      const hasLabelChange = labelIds.length !== currentLabelIds.length || 
        !labelIds.every(id => currentLabelIds.includes(id));

      if (Object.keys(updates).length > 0) {
        await onSave(task.id, updates);
      }
      
      if (hasLabelChange) {
        await setLabelsMutation.mutateAsync({ id: task.id, labelIds });
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "done";
  const currentAssignees = teamMembers.filter((m: { id: string }) => assigneeIds.includes(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-6xl max-h-full bg-obsidian border border-white/10 ares-cut-md shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ares-cyan/10 ares-cut-sm border border-ares-cyan/20">
              <Layout size={18} className="text-ares-cyan" />
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none text-white text-xl font-bold px-0 focus:outline-none focus:ring-0 min-w-[300px]"
              placeholder="Task title..."
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-ares-gray font-mono tracking-wider uppercase">
              ID: {task.id.slice(0, 8)}
            </div>
            <button onClick={onClose} className="p-2 text-ares-gray hover:text-white transition-colors" title="Close modal">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content: Two Columns */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[600px]">
          {/* Left Column: Editor & Main Info */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar border-r border-white/5">
            <div className="flex flex-col flex-1 gap-2">
              <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
                <Flag size={14} /> Description
              </div>
              <CollaborativeEditorRoom roomId={`task-${task.id}`}>
                <TaskEditorInner 
                  initialContent={task.description || ""} 
                  onDescriptionChange={setDescription} 
                />
              </CollaborativeEditorRoom>
            </div>
            
            {/* Subtasks */}
            <div className="flex flex-col gap-3 mt-6 border-t border-white/5 pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
                  <Layers size={14} className="text-ares-cyan" /> Subtasks
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                {subtasks.length === 0 ? (
                  <div className="text-center p-4 border border-dashed border-white/10 ares-cut-sm bg-white/5">
                    <p className="text-sm text-ares-gray">No subtasks found.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {subtasks.map((st: TaskItem) => (
                      <button 
                        key={st.id} 
                        type="button"
                        onClick={() => onTaskClick?.(st)}
                        className="flex items-center justify-between p-3 border border-white/5 bg-black/40 hover:bg-white/5 ares-cut-sm transition-colors cursor-pointer group w-full text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${st.status === "done" ? "bg-ares-gold" : "bg-ares-cyan"}`} />
                          <span className={`text-sm font-bold group-hover:text-ares-cyan transition-colors ${st.status === "done" ? "text-ares-gray line-through" : "text-white"}`}>
                            {st.title}
                          </span>
                        </div>
                        <span className="text-xs text-ares-gray uppercase tracking-wider">{st.status}</span>
                      </button>
                    ))}
                  </div>
                )}
                <form 
                  className="flex items-center gap-2 mt-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const input = form.elements.namedItem("subtaskTitle") as HTMLInputElement;
                    const title = input.value.trim();
                    if (!title) return;
                    input.value = "";
                    input.disabled = true;
                    try {
                      await createSubtaskMutation.mutateAsync({ title, parentId: task.id });
                    } catch (err) {
                      console.error("Failed to create subtask:", err);
                    } finally {
                      if (input) {
                        input.disabled = false;
                        input.focus();
                      }
                    }
                  }}
                >
                  <input
                    type="text"
                    name="subtaskTitle"
                    id="new-subtask-input"
                    placeholder="Add a new subtask..."
                    className="flex-1 bg-black/40 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
                  />
                  <button
                    type="submit"
                    className="bg-ares-cyan hover:bg-ares-cyan/80 text-black p-2.5 ares-cut-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                    disabled={createSubtaskMutation.isPending}
                    title="Add Subtask"
                  >
                    <Plus size={18} />
                  </button>
                </form>
              </div>
            </div>

            {/* Checklists */}
            <div className="flex flex-col gap-3 mt-6 border-t border-white/5 pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
                  <ListTodo size={14} className="text-ares-cyan" /> Checklists
                </div>
                {task.checklists && task.checklists.length > 0 && (
                  <div className="text-xs text-ares-gray font-bold">
                    {Math.round((task.checklists.filter(c => c.isCompleted === 1).length / task.checklists.length) * 100)}%
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                {task.checklists?.sort((a, b) => a.sortOrder - b.sortOrder).map(c => (
                  <div key={c.id} className="flex items-center gap-3 group">
                    <button 
                      onClick={() => updateChecklistMutation.mutate({ id: task.id, checklistId: c.id, updates: { isCompleted: c.isCompleted === 1 ? 0 : 1 } })}
                      className={`flex-shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${c.isCompleted === 1 ? "bg-ares-cyan border-ares-cyan text-black" : "border-white/20 hover:border-ares-cyan"}`}
                    >
                      {c.isCompleted === 1 ? <CheckCircle2 size={12} /> : null}
                    </button>
                    <span className={`flex-1 text-sm ${c.isCompleted === 1 ? "text-ares-gray line-through" : "text-white"}`}>
                      {c.content}
                    </span>
                    <button 
                      onClick={() => deleteChecklistMutation.mutate({ id: task.id, checklistId: c.id })}
                      className="opacity-0 group-hover:opacity-100 p-1 text-ares-gray hover:text-ares-red transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                
              <form 
                className="mt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newChecklist.trim()) {
                    await createChecklistMutation.mutateAsync({ id: task.id, content: newChecklist.trim() });
                    setNewChecklist("");
                  }
                }}
              >
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={newChecklist}
                    onChange={(e) => setNewChecklist(e.target.value)}
                    placeholder="Add an item..."
                    className="flex-1 bg-black/40 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
                  />
                  <button
                    type="submit"
                    className="bg-ares-cyan hover:bg-ares-cyan/80 text-black p-2.5 ares-cut-sm font-bold flex items-center justify-center transition-colors disabled:opacity-50"
                    disabled={!newChecklist.trim() || createChecklistMutation.isPending}
                    title="Add Checklist Item"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </form>
            </div>
            </div>

            {/* Attachments */}
            <div className="flex flex-col gap-3 mt-6 border-t border-white/5 pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
                  <Paperclip size={14} className="text-ares-cyan" /> Attachments
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {task.attachments?.map(a => {
                  let Icon = LinkIcon;
                  if (a.type === 'document') Icon = FileText;
                  else if (a.type === 'image') Icon = ImageIcon;
                  
                  return (
                    <div key={a.id} className="relative group p-3 border border-white/5 bg-black/40 hover:bg-white/5 ares-cut-sm transition-colors flex items-center gap-3">
                      <div className="p-2 bg-white/5 ares-cut-sm flex-shrink-0">
                        <Icon size={16} className="text-ares-cyan" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white hover:text-ares-cyan truncate block transition-colors">
                          {a.title}
                        </a>
                        <span className="text-xs text-ares-gray uppercase tracking-wider">{a.type}</span>
                      </div>
                      <button 
                        onClick={() => deleteAttachmentMutation.mutate({ id: task.id, attachmentId: a.id })}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-ares-gray hover:text-ares-red transition-all bg-black/80 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <input
                type="url"
                value={newAttachmentUrl}
                onChange={(e) => setNewAttachmentUrl(e.target.value)}
                placeholder="Paste a Google link or any URL..."
                className="bg-black/40 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 mt-1 transition-colors w-full"
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newAttachmentUrl.trim()) {
                    await createAttachmentMutation.mutateAsync({ id: task.id, url: newAttachmentUrl.trim() });
                    setNewAttachmentUrl("");
                  }
                }}
              />
            </div>
          </div>

          {/* Right Column: Meta & Zulip */}
          <div className="w-full lg:w-96 flex flex-col shrink-0 bg-black/20 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-6 flex flex-col">
              {/* Status */}
              <div>
                <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">Status</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUS_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setStatus(opt.value)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold ares-cut-sm transition-all ${
                          status === opt.value
                            ? "bg-white/10 border border-white/20 text-white shadow-inner"
                            : "bg-ares-gray-dark/30 border border-white/5 text-ares-gray hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Icon size={12} className={opt.color} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">Priority</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPriority(opt.value)}
                      className={`px-2.5 py-2 text-xs font-bold ares-cut-sm transition-all ${
                        priority === opt.value
                          ? `${opt.color} border border-white/20 shadow-inner`
                          : "bg-ares-gray-dark/30 border border-white/5 text-ares-gray hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Labels */}
              <div className="relative" ref={labelDropdownRef}>
                <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Tag size={10} />
                  Labels
                </span>
                
                <div className="flex flex-wrap gap-1.5 p-2 bg-ares-gray-dark/50 border border-white/10 ares-cut-sm min-h-[42px] content-start">
                  {labelIds.map(labelId => {
                    const label = GLOBAL_LABELS.find(l => l.id === labelId) || task.labels?.find(l => l.id === labelId);
                    if (!label) return null;
                    return (
                      <span key={label.id} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black ares-cut-sm uppercase tracking-wider border ${label.colorTheme}`}>
                        {label.name}
                        <button onClick={() => setLabelIds(labelIds.filter(id => id !== label.id))} className="opacity-70 hover:opacity-100 transition-opacity" title="Remove Label">
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                  <button 
                    onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-ares-gray hover:text-white transition-all ml-auto"
                    title="Add label"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <AnimatePresence>
                  {showLabelDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-[60] left-0 right-0 mt-1 bg-obsidian border border-white/10 ares-cut-sm shadow-2xl max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
                    >
                      {GLOBAL_LABELS.map(label => (
                        <button
                          key={label.id}
                          onClick={() => {
                            if (labelIds.includes(label.id)) {
                              setLabelIds(labelIds.filter(id => id !== label.id));
                            } else {
                              setLabelIds([...labelIds, label.id]);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold transition-all flex items-center justify-between hover:bg-white/5 ${labelIds.includes(label.id) ? "bg-white/5" : ""}`}
                        >
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black ares-cut-sm uppercase tracking-wider border ${label.colorTheme}`}>
                            {label.name}
                          </span>
                          {labelIds.includes(label.id) && <CheckCircle2 size={12} className="text-white" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Subteam */}
              <div>
                <span className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">Subteam</span>
                <select
                  value={subteam}
                  onChange={(e) => setSubteam(e.target.value)}
                  className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
                >
                  <option value="">No Subteam</option>
                  {KANBAN_SUBTEAMS.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              {/* Assignees */}
              <div className="relative" ref={dropdownRef}>
                <label className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <User size={10} />
                  Assignees ({assigneeIds.length})
                </label>
                
                <div className="flex flex-wrap gap-1.5 p-2 bg-ares-gray-dark/50 border border-white/10 ares-cut-sm min-h-[42px] content-start">
                  {currentAssignees.map((m: { id: string; nickname?: string | null; name?: string | null }) => (
                    <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan text-[10px] font-black ares-cut-sm uppercase tracking-wider">
                      {m.nickname || m.name}
                      <button onClick={() => toggleAssignee(m.id)} className="hover:text-white transition-colors" title="Remove Assignee">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <button 
                    onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-ares-gray hover:text-white transition-all ml-auto"
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
                              ? "bg-ares-cyan/10 text-ares-cyan" 
                              : "text-marble hover:bg-white/5"
                          }`}
                        >
                          {m.nickname || m.name}
                          {assigneeIds.includes(m.id) && <CheckCircle2 size={12} />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-start-date" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
                    <Calendar size={10} className="inline mr-1" />
                    Start Date
                  </label>
                  <input
                    id="modal-start-date"
                    title="Start Date"
                    type="date"
                    value={task.startDate || ""}
                    onChange={(e) => onSave(task.id, { startDate: e.target.value })}
                    className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="modal-due-date" className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
                    <Calendar size={10} className="inline mr-1" />
                    Due Date
                    {isOverdue && (
                      <span className="ml-1.5 text-ares-red text-[9px] uppercase font-black">Overdue</span>
                    )}
                  </label>
                  <input
                    id="modal-due-date"
                    title="Due Date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`w-full bg-ares-gray-dark/50 border text-sm px-3 py-2.5 ares-cut-sm outline-none transition-colors ${
                      isOverdue
                        ? "border-ares-red/40 text-ares-red focus:border-ares-red/60"
                        : "border-white/10 text-white focus:border-ares-cyan/50"
                    }`}
                  />
                </div>
              </div>
              
              {/* Time & Estimates */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
                    <Clock size={10} className="inline mr-1 text-ares-gold" />
                    Time Logged
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="HH"
                      value={Math.floor(timeSpentSeconds / 3600) || ""}
                      onChange={(e) => {
                        const h = parseInt(e.target.value) || 0;
                        const m = Math.floor((timeSpentSeconds % 3600) / 60);
                        setTimeSpentSeconds(h * 3600 + m * 60);
                      }}
                      className="w-16 bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-2 py-2 ares-cut-sm outline-none focus:border-ares-gold/50 text-center transition-colors"
                    />
                    <span className="text-ares-gray font-bold">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="MM"
                      value={Math.floor((timeSpentSeconds % 3600) / 60) || ""}
                      onChange={(e) => {
                        const h = Math.floor(timeSpentSeconds / 3600);
                        const m = parseInt(e.target.value) || 0;
                        setTimeSpentSeconds(h * 3600 + m * 60);
                      }}
                      className="w-16 bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-2 py-2 ares-cut-sm outline-none focus:border-ares-gold/50 text-center transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-ares-gray uppercase tracking-widest mb-1.5 block">
                    <AlertTriangle size={10} className="inline mr-1 text-ares-gray" />
                    Estimate (Min)
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Total Minutes"
                    value={task.estimatedMinutes || ""}
                    onChange={(e) => onSave(task.id, { estimatedMinutes: parseInt(e.target.value) || null })}
                    className="w-full bg-ares-gray-dark/50 border border-white/10 text-white text-sm px-3 py-2 ares-cut-sm outline-none focus:border-white/30 transition-colors"
                  />
                </div>
              </div>

              {/* Zulip Thread */}
              <div className="flex-1 min-h-[400px] border-t border-white/5 bg-obsidian flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <ZulipThread
                    stream={task.zulipStream || "kanban"}
                    topic={task.zulipTopic || `Task: ${task.title}`} 
                    className="m-0 border-none bg-transparent shadow-none max-h-none h-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-t border-white/5 bg-white/5">
          <div className="flex items-center gap-4 text-[10px] text-ares-gray font-mono">
            <span>Created {new Date(task.createdAt || 0).toLocaleDateString()}</span>
            {task.creatorName && <span>by {task.creatorName}</span>}
            <span>Updated {new Date(task.updatedAt || 0).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xs text-ares-red font-bold">Confirm?</span>
                <button
                  onClick={() => { onDelete(task.id); onClose(); }}
                  className="px-3 py-1.5 bg-ares-red/20 hover:bg-ares-red/30 text-ares-red text-xs font-bold ares-cut-sm border border-ares-red/30"
                >
                  Delete Task
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-ares-gray text-xs font-bold ares-cut-sm border border-white/5"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-ares-gray hover:text-ares-red transition-colors mr-2"
                title="Delete task"
              >
                <Trash2 size={16} />
              </button>
            )}
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-marble text-sm font-bold ares-cut-sm border border-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-6 py-2 bg-ares-cyan text-black hover:bg-ares-cyan/80 text-sm font-bold ares-cut-sm flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              <Save size={16} />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

