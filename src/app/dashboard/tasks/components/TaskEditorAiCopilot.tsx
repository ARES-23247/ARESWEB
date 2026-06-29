import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface TaskEditorAiCopilotProps {
  modalTitle: string;
  modalSubteam: string;
  modalPriority: string;
  modalDesc: string;
  setModalDesc: (desc: string) => void;
  setRevertAlert: (msg: string | null) => void;
}

export default function TaskEditorAiCopilot({
  modalTitle,
  modalSubteam,
  modalPriority,
  modalDesc,
  setModalDesc,
  setRevertAlert
}: TaskEditorAiCopilotProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  const handleAiAssistant = async (prompt: string, presetName = "") => {
    if (!prompt.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const res = await authenticatedFetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: presetName ? `${presetName}: ${prompt}` : prompt,
          text: modalDesc,
          context: `Task Title: ${modalTitle}\nSubteam: ${modalSubteam}\nPriority: ${modalPriority}`
        })
      });

      if (!res.ok) throw new Error("AI Assistant service error.");
      const data = await res.json();
      setAiResponse(data.response || "");
    } catch (err: any) {
      setAiResponse(`Failed to contact Gemini co-pilot: ${err.message}. Using offline fallback.\n\nOur team is committed to implementing robust code structures inside *FIRST*® programs. By using ARESLib, we maintain clean state machines and accurate sensor integrations.`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGrammarCheck = async () => {
    if (!modalDesc.trim()) return;
    setAiLoading(true);
    setGrammarEdits([]);
    setSuggestedCorrection("");
    try {
      const res = await authenticatedFetch("/api/ai/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: modalDesc })
      });

      if (!res.ok) throw new Error("AI Grammar service error.");
      const data = await res.json();
      if (Array.isArray(data.corrections)) {
        setGrammarEdits(data.corrections);
      }
      if (data.correctedText) {
        setSuggestedCorrection(data.correctedText);
      }
    } catch (err: any) {
      setAiResponse(`Failed to perform grammar check: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="hidden lg:flex lg:w-[30%] bg-black/30 border border-white/15 rounded-xl p-4 flex-col gap-4 overflow-y-auto shrink-0 select-none scrollbar-thin scrollbar-thumb-white/5 animate-slide-in">
      {/* Spelling & Grammar */}
      <div className="space-y-4">
        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2 mb-1.5">
            <Sparkles size={11} /> Spelling & Grammar
          </h4>
          <p className="text-[9px] text-marble/60 leading-normal mb-2.5">
            Gemini will scan the current task description for spelling errors and tone issues.
          </p>
          <button
            type="button"
            onClick={handleGrammarCheck}
            disabled={aiLoading || !modalDesc}
            className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40"
          >
            {aiLoading ? "Checking..." : "Verify Spelling & Grammar"}
          </button>
        </div>

        {/* AI Writer Prompts */}
        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg flex flex-col gap-2.5">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-cyan flex items-center gap-2">
            <Sparkles size={11} /> AI Writer Prompts
          </h4>
          
          <textarea
            placeholder="Tell Gemini what to write, expand, or adjust..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="w-full h-16 bg-black/60 border border-white/10 rounded p-2.5 text-xs text-white placeholder:text-marble/25 focus:outline-none focus:border-ares-cyan font-mono leading-relaxed resize-none"
          />

          {/* Presets Grid */}
          <div className="grid grid-cols-2 gap-1.5 text-[8px] font-black uppercase tracking-wider">
            <button
              type="button"
              onClick={() => handleAiAssistant("Rewrite the content to make it sound more professional and subsystem-oriented.", "Improve Description")}
              disabled={aiLoading}
              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer"
            >
              💼 Professional
            </button>
            <button
              type="button"
              onClick={() => handleAiAssistant("Expand this description, adding more technical details about robot subsystems, testing procedures, and documentation expectations.", "Expand")}
              disabled={aiLoading}
              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer"
            >
              ➕ Expand
            </button>
            <button
              type="button"
              onClick={() => handleAiAssistant("Summarize this task into a 1-sentence quick summary.", "Summarize")}
              disabled={aiLoading}
              className="p-1.5 border border-white/5 bg-white/3 hover:bg-white/10 text-marble/80 hover:text-white rounded text-left transition-colors cursor-pointer"
            >
              ✂️ Summarize
            </button>
            <button
              type="button"
              onClick={() => handleAiAssistant(aiPrompt)}
              disabled={aiLoading || !aiPrompt.trim()}
              className="p-1.5 bg-ares-cyan text-black hover:brightness-110 rounded text-center transition-all cursor-pointer font-bold disabled:opacity-40"
            >
              🚀 Ask AI
            </button>
          </div>
        </div>
      </div>

      {/* Output Sandbox */}
      <div className="bg-black/30 border border-white/10 rounded-lg p-3.5 flex flex-col justify-between overflow-hidden min-h-[200px] flex-grow">
        <div className="flex-grow overflow-y-auto pr-0.5 space-y-3.5 scrollbar-thin scrollbar-thumb-white/5">
          <h4 className="text-[9px] font-bold uppercase tracking-wider text-marble/55">
            Copilot Sandbox Output
          </h4>

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2.5">
              <span className="w-5 h-5 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
              <span className="text-[9px] text-marble/55 uppercase font-mono tracking-wider animate-pulse">
                Brainstorming...
              </span>
            </div>
          )}

          {!aiLoading && grammarEdits.length > 0 && (
            <div className="space-y-3">
              <div className="p-2.5 bg-ares-gold/10 border border-ares-gold/20 text-ares-gold rounded text-[10px] leading-normal font-semibold">
                Review corrections. Click <strong>Apply Correction</strong> below to insert.
              </div>
              
              <div className="space-y-2">
                {grammarEdits.map((edit: any, idx: number) => (
                  <div key={idx} className="bg-black/45 border border-white/5 p-2 rounded text-[10px] leading-relaxed">
                    <div className="flex flex-wrap gap-1 items-center mb-1 text-[8px] font-black uppercase tracking-wider">
                      <span className="bg-ares-red/25 text-ares-red border border-ares-red/35 px-1 py-0.5 rounded line-through">
                        {edit.original}
                      </span>
                      <span className="text-marble/55">➜</span>
                      <span className="bg-ares-success/25 text-ares-success border border-ares-success/35 px-1 py-0.5 rounded">
                        {edit.corrected}
                      </span>
                    </div>
                    <p className="text-marble/75 mt-0.5">{edit.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!aiLoading && aiResponse && (
            <div className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap text-marble bg-black/45 border border-white/5 p-3 rounded-lg overflow-x-auto">
              {aiResponse}
            </div>
          )}

          {!aiLoading && !aiResponse && grammarEdits.length === 0 && (
            <div className="py-16 text-center text-[9px] font-mono text-marble/30 uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
              Output empty
            </div>
          )}
        </div>

        {!aiLoading && (aiResponse || suggestedCorrection) && (
          <div className="border-t border-white/5 pt-3 mt-3 flex flex-col gap-2 shrink-0">
            {suggestedCorrection && grammarEdits.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setModalDesc(suggestedCorrection);
                  setGrammarEdits([]);
                  setSuggestedCorrection("");
                  setRevertAlert("Applied grammar and spelling corrections to the description!");
                }}
                className="w-full py-2.5 bg-ares-success text-white font-black uppercase tracking-widest text-[9px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all"
              >
                Apply Correction
              </button>
            )}
            {aiResponse && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalDesc(aiResponse);
                    setRevertAlert("Replaced description with Gemini generated text!");
                  }}
                  className="py-2.5 bg-ares-cyan text-black font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:brightness-105 transition-all"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalDesc(modalDesc + "\n\n" + aiResponse);
                    setRevertAlert("Appended Gemini response to description!");
                  }}
                  className="py-2.5 bg-white/5 border border-white/15 text-white font-black uppercase tracking-widest text-[8px] ares-cut-sm cursor-pointer shadow-lg hover:bg-white/10 transition-all"
                >
                  Append
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
