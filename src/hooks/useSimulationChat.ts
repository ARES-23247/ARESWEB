import { useState, useCallback, useRef, useEffect } from "react";
import { logger } from "../utils/logger";
import { validateIdParam } from "../utils/security";
import { getSimChatKey } from "../utils/storageKeys";
import { 
  sanitizeUserInput, 
  sanitizeFilesForAI, 
  truncateChatHistory, 
  ChatMessage 
} from "../utils/ai";

const DEFAULT_MESSAGE: ChatMessage = { 
  role: "assistant", 
  content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you." 
};

const MAX_CHAT_MESSAGES = 50;

interface UseSimulationChatOptions {
  simId: string | null;
  files: Record<string, string>;
  activeFile: string;
  compileCode: (files: Record<string, string>) => Promise<string | null>;
  setFiles: (files: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setPendingAiChanges: (changes: Record<string, string> | null) => void;
  examples: {
    arm: string;
    elevator: string;
  };
  consoleLogs: { level: string; args: unknown[] }[];
  compileError: string | null;
}

export function useSimulationChat({
  simId,
  files,
  activeFile,
  compileCode: _compileCode,
  setFiles: _setFiles,
  setPendingAiChanges,
  examples,
  consoleLogs,
  compileError
}: UseSimulationChatOptions) {
  const loadChatMessages = useCallback((currentSimId: string | null): ChatMessage[] => {
    try {
      const id = currentSimId || 'new';
      const stored = sessionStorage.getItem(getSimChatKey(id));
      if (stored) {
        const parsed = JSON.parse(stored) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.every(m => typeof m.role === 'string' && typeof m.content === 'string')) {
          return parsed.slice(0, MAX_CHAT_MESSAGES);
        }
      }
    } catch (e) {
      logger.error("[useSimulationChat] Failed to load chat:", e);
    }
    return [DEFAULT_MESSAGE];
  }, []);

  const saveChatMessages = useCallback((messages: ChatMessage[], currentSimId: string | null) => {
    try {
      const validatedSimId = currentSimId ? validateIdParam(currentSimId) : null;
      const id = validatedSimId || 'new';
      const limited = messages.slice(-MAX_CHAT_MESSAGES);
      sessionStorage.setItem(getSimChatKey(id), JSON.stringify(limited));
    } catch (e) {
      logger.error("[useSimulationChat] Failed to save chat:", e);
    }
  }, []);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(loadChatMessages(simId));
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Persist chat to sessionStorage
  useEffect(() => {
    saveChatMessages(chatMessages, simId);
  }, [chatMessages, simId, saveChatMessages]);

  // Update chat messages when simId changes (e.g. on load)
  useEffect(() => {
    setChatMessages(loadChatMessages(simId));
  }, [simId, loadChatMessages]);

  const handleChatSend = useCallback(async (overrideMsg?: string) => {
    const msg = sanitizeUserInput((overrideMsg || chatInput).trim());
    if (!msg || isChatLoading) return;

    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const sanitizedFiles = sanitizeFilesForAI(files);
      const filesJson = JSON.stringify(sanitizedFiles, null, 2);
      const includeExamples = filesJson.length < 15000;

      const systemContext = `You are a z.AI simulation code assistant for ARES 23247, an FTC robotics team. The user is building interactive React simulations that run in a sandboxed iframe.
RULES:
- You MUST put EVERYTHING (all components, logic, and styling) into a SINGLE .tsx file. NEVER generate multiple files.
- The entrypoint component MUST be a default export (e.g., export default function MySim() {...})
- Use React.useState, React.useEffect, etc. (React is a global, don't import it)
- Use standard ARESWEB UI classes: sim-container, sim-title, sim-label, sim-value, sim-slider, sim-canvas, sim-btn, sim-grid, sim-flex
- Use Vite-style raw typescript format (.tsx).

ARES ROBOTICS SIMULATION TIPS:
- Physics: Matter.js is global as 'Matter'. Use for 2D rigid bodies.
- Coordinate Mapping: Field is 144x144 inches. (0,0) is center. Use areslib.FieldMapping for translations.
- Colors: ARES Red (#C00000), Dark (#0d0f14), Gold (#FFD700), White (#FFFFFF).
- Input: Always include a 'Reset' button in your simulation UI.

OUTPUT FORMAT:
- You can either output the COMPLETE updated file or use a PATCH block to edit specific parts efficiently.
- To output the COMPLETE file (e.g. for initial creation or major rewrites), use: \`\`\`tsx
- To surgically edit an existing file, use: \`\`\`patch
  Inside the patch block, use this EXACT format:
<<<<
old code to find (must match exactly)
====
new code to replace it with
>>>>

${includeExamples ? `EXAMPLES OF REAL ARESWEB SIMULATIONS:

\`\`\`tsx:ArmKgSim.tsx
${examples.arm}
\`\`\`

\`\`\`tsx:ElevatorPidSim.tsx
${examples.elevator}
\`\`\`
` : ''}
CURRENT FILES:
\`\`\`json
${filesJson}
\`\`\`

USER REQUEST: ${msg}`;

      const history = truncateChatHistory(chatMessages);
      const apiMessages = history.map(m => ({ role: m.role, content: sanitizeUserInput(m.content) }));
      apiMessages.push({ role: "user", content: msg });

      // Normalize for Anthropic: must start with user, must alternate roles
      const normalizedMessages: {role: "user"|"assistant", content: string}[] = [];
      for (const m of apiMessages) {
        if (normalizedMessages.length === 0 && m.role === "assistant") {
          continue; 
        }
        if (normalizedMessages.length > 0 && normalizedMessages[normalizedMessages.length - 1].role === m.role) {
          normalizedMessages[normalizedMessages.length - 1].content += "\n\n" + m.content;
        } else {
          normalizedMessages.push({ ...m });
        }
      }

      const res = await fetch("/api/ai/sim-playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: systemContext, messages: normalizedMessages, imageUrl: attachedImage }),
      });
      setAttachedImage(null);

      if (!res.ok || !res.body) throw new Error("AI request failed");

      let accumulatedText = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      const initialFiles = { ...files };
      let finalFiles: Record<string, string> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                accumulatedText += data.chunk;
                
                const blockLines = accumulatedText.split('\n');
                const newFiles: Record<string, string> = {};
                let currentFileName: string | null = null;
                let currentContent: string[] = [];
                let isPatchBlock = false;
                
                for (let i = 0; i < blockLines.length; i++) {
                  const l = blockLines[i];
                  if (l.startsWith('```')) {
                    if (currentFileName) {
                      if (isPatchBlock) {
                        const patchStr = currentContent.join('\n');
                        const originalCode = initialFiles[currentFileName] || "";
                        let patchedCode = originalCode;
                        const patchRegex = /<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>/g;
                        let match;
                        while ((match = patchRegex.exec(patchStr)) !== null) {
                          const oldText = match[1];
                          const newText = match[2];
                          if (patchedCode.includes(oldText)) {
                            patchedCode = patchedCode.replace(oldText, newText);
                          }
                        }
                        newFiles[currentFileName] = patchedCode;
                      } else {
                        newFiles[currentFileName] = currentContent.join('\n');
                      }
                      currentFileName = null;
                      currentContent = [];
                      isPatchBlock = false;
                    } else {
                      const match = l.match(/```(tsx|patch)[^\n]*/);
                      if (match) {
                        currentFileName = activeFile;
                        isPatchBlock = match[1] === "patch";
                      }
                    }
                  } else if (currentFileName) {
                    currentContent.push(l);
                  }
                }
                
                if (currentFileName) {
                  if (isPatchBlock) {
                    const patchStr = currentContent.join('\n');
                    const originalCode = initialFiles[currentFileName] || "";
                    let patchedCode = originalCode;
                    const patchRegex = /<<<<\n([\s\S]*?)\n====\n([\s\S]*?)\n>>>>/g;
                    let match;
                    while ((match = patchRegex.exec(patchStr)) !== null) {
                      const oldText = match[1];
                      const newText = match[2];
                      if (patchedCode.includes(oldText)) {
                        patchedCode = patchedCode.replace(oldText, newText);
                      }
                    }
                    newFiles[currentFileName] = patchedCode;
                  } else {
                    newFiles[currentFileName] = currentContent.join('\n');
                  }
                }
                
                if (Object.keys(newFiles).length > 0) {
                  finalFiles = newFiles;
                }
              }
            } catch { /* ignore */ }
          }
        }
      }

      const reply = accumulatedText.trim();
      
      if (Object.keys(finalFiles).length > 0) {
        setPendingAiChanges(finalFiles);
        setChatMessages(prev => [...prev, { role: "assistant", content: reply + "\n\nI've drafted the changes. Review the diff above and Accept or Reject." }]);
      } else {
        setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
      }

    } catch (e: unknown) {
      logger.error("[useSimulationChat] AI Chat error:", e);
      setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ Error: ${(e as Error)?.message || "Network error"}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatMessages, files, attachedImage, activeFile, chatInput, isChatLoading, examples, setPendingAiChanges]);

  const handleFixWithAI = useCallback(() => {
    const errorLogs = consoleLogs.filter(l => l.level === "error");
    if (errorLogs.length === 0 && !compileError) return;

    const errorContext = [
      compileError ? `Compile Error:\n${compileError}` : "",
      errorLogs.length > 0 ? `Runtime Errors:\n${errorLogs.map(l => l.args.join(" ")).join("\n")}` : ""
    ].filter(Boolean).join("\n\n");

    const fixPrompt = `I'm seeing these errors in the simulation:\n\n${errorContext}\n\nPlease help me fix them. Analyze the provided current files and errors, then suggest a patch or full file replacement to resolve the issue.`;
    handleChatSend(fixPrompt);
    chatInputRef.current?.focus();
  }, [consoleLogs, compileError, handleChatSend]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }, [handleChatSend]);

  const resetChat = useCallback(() => {
    setChatMessages([DEFAULT_MESSAGE]);
  }, []);

  return {
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    isChatLoading,
    attachedImage,
    setAttachedImage,
    chatEndRef,
    chatInputRef,
    handleChatSend,
    handleFixWithAI,
    handleChatKeyDown,
    resetChat
  };
}
