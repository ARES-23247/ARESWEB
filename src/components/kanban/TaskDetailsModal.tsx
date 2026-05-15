import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  X, Save, Trash2, Layout,
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
    <div className="flex flex-wrap items-center gap-1 bg-black/80 border-b border-white/5 p-2 w-full backdrop-blur-md shadow-inner">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2.5 py-1 text-[10px] font-black ares-cut-sm transition-all border ${editor.isActive("bold") ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2.5 py-1 text-[10px] italic ares-cut-sm transition-all border ${editor.isActive("italic") ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-2.5 py-1 text-[10px] line-through ares-cut-sm transition-all border ${editor.isActive("strike") ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>S</button>
      <div className="w-px h-4 bg-white/5 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2.5 py-1 text-[10px] font-black uppercase ares-cut-sm transition-all border ${editor.isActive("heading", { level: 2 }) ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2.5 py-1 text-[10px] font-black uppercase ares-cut-sm transition-all border ${editor.isActive("bulletList") ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>• LIST</button>
      <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={`px-2.5 py-1 text-[10px] font-black uppercase ares-cut-sm transition-all border ${editor.isActive("taskList") ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>☑ CHECKLIST</button>
      <div className="w-px h-4 bg-white/5 mx-1" />
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`px-2.5 py-1 text-[10px] font-mono ares-cut-sm transition-all border ${editor.isActive("codeBlock") ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>{"<>"}</button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2.5 py-1 text-[10px] font-black uppercase ares-cut-sm transition-all border ${editor.isActive("blockquote") ? "bg-white/10 text-white border-white/20 shadow-lg" : "text-marble/30 border-transparent hover:bg-white/5 hover:text-white"}`}>&quot; QUOTE</button>
      {onInsertDriveEmbed && (
        <>
          <div className="w-px h-4 bg-white/5 mx-1" />
          <button type="button" onClick={onInsertDriveEmbed} className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm transition-all text-ares-cyan border border-ares-cyan/20 hover:bg-ares-cyan hover:text-black flex items-center gap-2 shadow-lg shadow-ares-cyan/5">
            <HardDrive size={12} /> DRIVE_ASSET
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
        <div className="flex-shrink-0 flex flex-col p-6 border-b border-white/5 bg-black/40 backdrop-blur-xl">
          {parentTask && (
            <button
              onClick={() => onTaskClick?.(parentTask)}
              className="text-[10px] font-black text-ares-cyan hover:text-white flex items-center gap-2 mb-4 self-start transition-all uppercase tracking-[0.3em] px-4 py-2 bg-ares-cyan/5 border border-ares-cyan/20 ares-cut-sm shadow-lg shadow-ares-cyan/5 group"
            >
              <Layout size={12} className="group-hover:scale-110 transition-transform" />
              BACK_TO_PARENT_COMMAND: {parentTask.title}
            </button>
          )}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-5">
              <div className="p-3 bg-ares-cyan/10 ares-cut-sm border border-ares-cyan/30 shadow-lg shadow-ares-cyan/10">
                <Layout size={24} className="text-ares-cyan" />
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent border-none text-3xl font-black text-white px-0 focus:outline-none focus:ring-0 min-w-[400px] uppercase tracking-tighter placeholder:text-marble/10"
                placeholder="OBJECTIVE_NOMENCLATURE..."
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="text-[10px] text-marble/20 font-black tracking-[0.4em] uppercase hidden sm:block border-l border-white/5 pl-6">
                TACTICAL_ID: {task.id.split("-")[0]}
              </div>
              <button onClick={onClose} className="p-2 text-marble/20 hover:text-ares-red transition-all hover:rotate-90" title="Close interface">
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* Content: Two Columns */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[600px]">
          {/* Left Column: Editor & Main Info */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar border-r border-white/5">
            <div className="flex flex-col flex-1 gap-4">
              <div className="text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] flex items-center gap-3">
                <div className="w-6 h-px bg-marble/10"></div>
                MISSION_DESCRIPTION
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
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-t border-white/5 bg-black/60 backdrop-blur-xl">
          <div className="flex items-center gap-6 text-[9px] font-black text-marble/20 uppercase tracking-[0.2em]">
            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-ares-cyan/30 rounded-full"></div> INIT: {new Date(freshTask.createdAt || 0).toLocaleDateString()}</span>
            {freshTask.creatorName && <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-ares-gold/30 rounded-full"></div> ASSET: {freshTask.creatorName}</span>}
            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-ares-cyan/30 rounded-full"></div> SYNC: {new Date(freshTask.updatedAt || 0).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-4">
            {confirmDelete ? (
              <div className="flex items-center gap-4 mr-6 bg-ares-red/5 px-4 py-2 ares-cut-sm border border-ares-red/20 shadow-lg shadow-ares-red/5">
                <span className="text-[10px] text-ares-red font-black uppercase tracking-[0.2em]">CONFIRM_TERMINATION?</span>
                <button
                  onClick={() => { onDelete(freshTask.id); onClose(); }}
                  className="px-5 py-2 bg-ares-red text-white text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm shadow-lg shadow-ares-red/20 hover:scale-105 active:scale-95 transition-all"
                >
                  TERMINATE_TASK
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-5 py-2 bg-white/5 hover:bg-white/10 text-marble/40 text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm border border-white/10 transition-all"
                >
                  ABORT
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-3 text-marble/20 hover:text-ares-red transition-all ares-cut-sm bg-white/5 border border-white/5 hover:border-ares-red/30 shadow-xl"
                title="Initialize deletion sequence"
              >
                <Trash2 size={20} />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-marble/60 text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm border border-white/10 transition-all shadow-xl"
            >
              CLOSE_INTERFACE
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-8 py-3 bg-ares-cyan text-black hover:bg-ares-cyan/90 text-[10px] font-black uppercase tracking-[0.3em] ares-cut-sm flex items-center gap-3 disabled:opacity-30 transition-all shadow-lg shadow-ares-cyan/20 active:scale-95"
            >
              <Save size={16} />
              {isSaving ? "TRANSMITTING..." : "COMMIT_CHANGES"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
