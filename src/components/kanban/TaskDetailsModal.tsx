import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  X, Save, Trash2, Flag, Layout,
} from "lucide-react";
import { useSetTaskLabels, useGetTasks } from "../../api";
import { type Task as TaskItem } from "../../api";
import { toastApiError } from "../../api/honoClient";

import { CollaborativeEditorRoom, useCollaborativeEditor } from "../editor/CollaborativeEditorRoom";
import { useRichEditor } from "../editor/useRichEditor";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";

// Sub-components
import { TaskSubtasks, TaskChecklists, TaskAttachments, TaskMetaSidebar, TaskDocuments } from "./task-detail";

interface TaskDetailsModalProps {
  task: TaskItem;
  onClose: () => void;
  onSave: (id: string, updates: import("../../api").UpdateTaskRequest) => Promise<void>;
  onDelete: (id: string) => void;
  onTaskClick?: (task: TaskItem) => void;
}

import { HardDrive } from "lucide-react";
import DrivePickerModal from "../DrivePickerModal";

// Compact toolbar for the task modal – only essential formatting buttons
function CompactEditorToolbar({ editor, onInsertDriveEmbed }: { editor: Editor, onInsertDriveEmbed?: () => void }) {
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
      {onInsertDriveEmbed && (
        <>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button type="button" onClick={onInsertDriveEmbed} className="px-2 py-1 text-xs font-bold uppercase tracking-widest ares-cut-sm transition-all text-ares-cyan hover:bg-ares-cyan hover:text-black flex items-center gap-1.5 border border-ares-cyan/30">
            <HardDrive size={12} /> Drive
          </button>
        </>
      )}
    </div>
  );
}

function TaskEditorInner({ initialContent, onDescriptionChange }: { initialContent: string; onDescriptionChange: (content: string) => void }) {
  const { providerId } = useCollaborativeEditor();
  return <TaskEditorImpl key={providerId} initialContent={initialContent} onDescriptionChange={onDescriptionChange} />;
}

// Inner Editor that connects to PartyKit
function TaskEditorImpl({ initialContent, onDescriptionChange }: { initialContent: string; onDescriptionChange: (content: string) => void }) {
  const { ydoc, provider } = useCollaborativeEditor();
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  
  const editor = useRichEditor({
    placeholder: "<p>Write a detailed task description...</p>",
    ydoc,
    provider,
    yfield: 'default'
  });

  // Seed the editor with initial content if the ydoc is empty
  useEffect(() => {
    if (!editor || !initialContent) return;

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
    <div className="flex flex-col border border-white/10 ares-cut-sm bg-black/40 overflow-hidden flex-1 min-h-[250px] relative">
      {editor && <CompactEditorToolbar editor={editor} onInsertDriveEmbed={() => setIsDrivePickerOpen(true)} />}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-obsidian">
        <EditorContent editor={editor} className="prose prose-sm prose-invert max-w-none focus:outline-none" />
      </div>
      <DrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelect={(url, title) => {
          editor?.chain().focus().setGoogleDriveEmbed({ src: url, title }).run();
          setIsDrivePickerOpen(false);
        }}
      />
    </div>
  );
}

export default function TaskDetailsModal({ task, onClose, onSave, onDelete, onTaskClick }: TaskDetailsModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState(task.status || "todo");
  const [priority, setPriority] = useState(task.priority || "normal");
  const [subteam, setSubteam] = useState(task.subteam || "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees?.map((a) => a.id) || []);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(task.timeSpentSeconds || 0);

  // Labels
  const setLabelsMutation = useSetTaskLabels({ onError: (err: unknown) => toastApiError(err) });
  const [labelIds, setLabelIds] = useState<string[]>(task.labels?.map(l => l.id) || []);

  const { data: freshTaskData } = useGetTasks({ id: task.id }) as { data?: { tasks?: TaskItem[] } };
  const freshTask = freshTaskData?.tasks?.[0] || task;

  const { data: parentTaskData } = useGetTasks(
    { id: task.parentId || "skip" },
    { enabled: !!task.parentId }
  ) as { data?: { tasks?: TaskItem[] } };
  const parentTask = parentTaskData?.tasks?.[0];

  // Accessibility: Focus trap for keyboard navigation
  const { modalRef: focusTrapRef } = useFocusTrap({
    isOpen: true,
    onClose,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: import("../../api").UpdateTaskRequest = {};
      if (title !== task.title) updates.title = title;
      if (description !== (task.description || "")) updates.description = description || undefined;
      if (status !== task.status) updates.status = status as "todo" | "in_progress" | "done" | "blocked";
      if (priority !== task.priority) updates.priority = priority as "low" | "normal" | "high" | "urgent";
      if (subteam !== (task.subteam || "")) updates.subteam = subteam || null;
      if (dueDate !== (task.dueDate || "")) updates.dueDate = dueDate || undefined;

      const currentIds = task.assignees?.map((a) => a.id) || [];
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
        <div className="flex-shrink-0 flex flex-col p-4 border-b border-white/5 bg-white/5">
          {parentTask && (
            <button
              onClick={() => onTaskClick?.(parentTask)}
              className="text-[10px] font-bold text-ares-cyan hover:text-white flex items-center gap-1 mb-3 self-start transition-colors uppercase tracking-widest px-2 py-1 bg-ares-cyan/10 border border-ares-cyan/20 ares-cut-sm"
            >
              <Layout size={10} />
              ← Back to Parent Task: {parentTask.title}
            </button>
          )}
          <div className="flex items-center justify-between w-full">
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
              <div className="text-[10px] text-ares-gray font-mono tracking-wider uppercase hidden sm:block">
                ID: {task.id.split("-")[0]}
              </div>
              <button onClick={onClose} className="p-2 text-ares-gray hover:text-white transition-colors" title="Close modal">
                <X size={20} />
              </button>
            </div>
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

            <TaskSubtasks task={freshTask} onTaskClick={onTaskClick} />
            <TaskChecklists task={freshTask} />
            <TaskDocuments task={freshTask} />
            <TaskAttachments task={freshTask} />
          </div>

          {/* Right Column: Meta & Zulip */}
          <TaskMetaSidebar
            task={freshTask}
            status={status} setStatus={setStatus}
            priority={priority} setPriority={setPriority}
            subteam={subteam} setSubteam={setSubteam}
            assigneeIds={assigneeIds} setAssigneeIds={setAssigneeIds}
            dueDate={dueDate} setDueDate={setDueDate}
            timeSpentSeconds={timeSpentSeconds} setTimeSpentSeconds={setTimeSpentSeconds}
            labelIds={labelIds} setLabelIds={setLabelIds}
            onSave={onSave}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-t border-white/5 bg-white/5">
          <div className="flex items-center gap-4 text-[10px] text-ares-gray font-mono">
            <span>Created {new Date(freshTask.createdAt || 0).toLocaleDateString()}</span>
            {freshTask.creatorName && <span>by {freshTask.creatorName}</span>}
            <span>Updated {new Date(freshTask.updatedAt || 0).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-xs text-ares-red font-bold">Confirm?</span>
                <button
                  onClick={() => { onDelete(freshTask.id); onClose(); }}
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
