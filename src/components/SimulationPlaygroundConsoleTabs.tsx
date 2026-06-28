import React from "react";
import { Sparkles } from "lucide-react";
import { SimConsole, LogEntry, TestResult } from "./editor/SimConsole";
import { AiChatPanel } from "./simulation/AiChatPanel";

interface SimulationPlaygroundConsoleTabsProps {
  bottomRightTab: 'console' | 'ai';
  setBottomRightTab: (tab: 'console' | 'ai') => void;
  consoleLogs: LogEntry[];
  setConsoleLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  testResults: TestResult[];
  setTestResults: React.Dispatch<React.SetStateAction<TestResult[]>>;
  handleFixWithAI: (error: string) => void;
  chatMessages: any[];
  isChatLoading: boolean;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleChatKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleChatSend: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export default function SimulationPlaygroundConsoleTabs({
  bottomRightTab,
  setBottomRightTab,
  consoleLogs,
  setConsoleLogs,
  testResults,
  setTestResults,
  handleFixWithAI,
  chatMessages,
  isChatLoading,
  chatInput,
  setChatInput,
  handleChatKeyDown,
  handleChatSend,
  chatEndRef,
  chatInputRef
}: SimulationPlaygroundConsoleTabsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-white/10 bg-obsidian-dark shrink-0">
        <button
          onClick={() => setBottomRightTab('console')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
            bottomRightTab === 'console'
              ? 'text-ares-cyan border-b-2 border-ares-cyan bg-white/5'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Console
        </button>
        <button
          onClick={() => setBottomRightTab('ai')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
            bottomRightTab === 'ai'
              ? 'text-indigo-400 border-b-2 border-indigo-400 bg-white/5'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Sparkles className="w-3 h-3" /> AI Chat
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {bottomRightTab === 'console' ? (
          <SimConsole
            logs={consoleLogs}
            testResults={testResults}
            onClear={() => {
              setConsoleLogs([]);
              setTestResults([]);
            }}
            onFixWithAI={() => handleFixWithAI("")}
          />
        ) : (
          <AiChatPanel
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleChatKeyDown={handleChatKeyDown}
            handleChatSend={handleChatSend}
            chatEndRef={chatEndRef}
            chatInputRef={chatInputRef}
          />
        )}
      </div>
    </div>
  );
}
