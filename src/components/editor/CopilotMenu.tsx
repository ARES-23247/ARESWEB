import React, { useState } from "react";
import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CopilotMenuProps {
  editor: Editor;
}

export function CopilotMenu({ editor }: CopilotMenuProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: "summarize" | "expand" | "question" | "grammar") => {
    const selection = editor.state.selection;
    if (selection.empty) {
      toast.error("Please select text to use the AI Copilot.");
      return;
    }

    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, " ");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/liveblocks-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentContext: selectedText,
          prompt: "Please provide a helpful modification.",
          action,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch AI response");

      // Simple streaming reader
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                accumulatedText += data.chunk;
              } catch (_e) {
                // Parse error, ignore parse errors on chunks
              }
            }
          }
        }
      }

      // Replace selected text or insert below
      editor.commands.insertContent(`\n\n**AI ${action}:**\n${accumulatedText}`);
      toast.success("AI Copilot finished!");
    } catch (e) {
      console.error(e);
      toast.error("AI Copilot encountered an error.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!editor) return null;

  return (
    <BubbleMenu editor={editor} className="flex bg-zinc-900 border border-zinc-700 shadow-xl rounded-md overflow-hidden">
      <div className="flex px-1 items-center bg-zinc-800 text-zinc-400 border-r border-zinc-700">
        <Sparkles className="w-4 h-4 mx-2 text-indigo-400" />
        <span className="text-xs font-semibold mr-2 uppercase tracking-widest text-indigo-300">z.ai</span>
      </div>
      {isLoading ? (
        <div className="flex items-center px-4 py-1.5 text-sm text-zinc-300 bg-zinc-800/50">
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-indigo-400" />
          <span>Generating...</span>
        </div>
      ) : (
        <>
          <button
            onClick={() => handleAction("summarize")}
            className="px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Summarize
          </button>
          <button
            onClick={() => handleAction("expand")}
            className="px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-l border-zinc-700"
          >
            Expand
          </button>
          <button
            onClick={() => handleAction("grammar")}
            className="px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-l border-zinc-700"
          >
            Fix Grammar
          </button>
        </>
      )}
    </BubbleMenu>
  );
}
