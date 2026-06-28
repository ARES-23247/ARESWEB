import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface DocFormDrawerAiCopilotProps {
  formContent: string;
  formTitle: string;
  formCategory: string;
  onApplyGrammarFixes: (correctedText: string) => void;
  onAppendContent: (content: string) => void;
  setRevertAlert: (msg: string) => void;
}

export default function DocFormDrawerAiCopilot({
  formContent,
  formTitle,
  formCategory,
  onApplyGrammarFixes,
  onAppendContent,
  setRevertAlert
}: DocFormDrawerAiCopilotProps) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
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
          text: formContent,
          context: `Title: ${formTitle}\nCategory: ${formCategory}`
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
    if (!formContent.trim()) return;
    setAiLoading(true);
    setGrammarEdits([]);
    setSuggestedCorrection("");
    try {
      const res = await authenticatedFetch("/api/ai/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formContent })
      });

      if (!res.ok) throw new Error("AI Grammar check service error.");
      const data = await res.json();
      setSuggestedCorrection(data.correctedText || "");
      setGrammarEdits(data.edits || []);
    } catch (err: any) {
      console.warn(err);
      setSuggestedCorrection(formContent);
      setGrammarEdits([{ original: "offline check", corrected: "online check", explanation: "Connect to live sync to get full Gemini spelling check." }]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="hidden lg:flex lg:w-[30%] bg-black/30 border border-white/15 rounded-xl p-4 flex-col gap-4 overflow-y-auto shrink-0 select-none scrollbar-thin scrollbar-thumb-white/5">
      <div className="space-y-4">
        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2 mb-1.5">
            <Sparkles size={11} /> Spelling & Tone
          </h4>
          <p className="text-[9px] text-marble/60 leading-normal mb-2.5">
            Gemini will scan the current editor contents for grammar errors, mathematical typos, and tone constraints.
          </p>
          <button
            type="button"
            onClick={handleGrammarCheck}
            disabled={aiLoading || !formContent}
            className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
          >
            {aiLoading ? "Checking..." : "Verify Content Grammar"}
          </button>
        </div>

        {/* AI Tone corrections view */}
        {suggestedCorrection && (
          <div className="bg-black/40 border border-white/5 rounded-lg p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-ares-success">
                Spelling Scan Report
              </span>
              <button
                type="button"
                onClick={() => {
                  onApplyGrammarFixes(suggestedCorrection);
                  setSuggestedCorrection("");
                  setGrammarEdits([]);
                  setRevertAlert("Applied AI spelling corrections to draft content.");
                }}
                className="text-[9px] font-black uppercase tracking-wider bg-ares-success/15 hover:bg-ares-success/25 border border-ares-success/30 px-2 py-0.5 rounded text-ares-success cursor-pointer"
              >
                Apply Fixes
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
              {grammarEdits.length === 0 ? (
                <p className="text-[9px] text-marble/40 font-mono italic">
                  Zero grammar issues identified.
                </p>
              ) : (
                grammarEdits.map((ed, idx) => (
                  <div key={idx} className="text-[9px] bg-black/30 p-2 border border-white/5 rounded">
                    <p className="text-ares-danger-soft line-through">{ed.original}</p>
                    <p className="text-ares-success mt-0.5 font-bold">{ed.corrected}</p>
                    {ed.explanation && (
                      <p className="text-marble/40 mt-1 font-medium">{ed.explanation}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Section 2: AI Writing assistant */}
        <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2">
            <Sparkles size={11} /> AI Writer assistant
          </h4>
          <p className="text-[9px] text-marble/60 leading-normal">
            Type a command to draft paragraphs, translate algorithms, or summarize sections.
          </p>
          <textarea
            rows={3}
            placeholder="e.g. Write a brief section explaining Pinpoint encoder ticks per rev math..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded p-2.5 text-[10px] text-white focus:outline-none focus:border-ares-red resize-none font-medium leading-relaxed focus:ring-1 focus:ring-ares-cyan"
          />
          <button
            type="button"
            onClick={() => handleAiAssistant(aiPrompt)}
            disabled={aiLoading || !aiPrompt.trim()}
            className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
          >
            {aiLoading ? "Drafting..." : "Generate AI Draft"}
          </button>
        </div>

        {/* Generated AI output view */}
        {aiResponse && (
          <div className="bg-black/40 border border-white/5 rounded-lg p-3.5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-ares-cyan">
                AI Generated Draft
              </span>
              <button
                type="button"
                onClick={() => {
                  onAppendContent(aiResponse);
                  setAiResponse("");
                  setAiPrompt("");
                  setRevertAlert("Appended generated AI draft to the editor body.");
                }}
                className="text-[9px] font-black uppercase tracking-wider bg-ares-cyan/15 hover:bg-ares-cyan/25 border border-ares-cyan/30 px-2 py-0.5 rounded text-ares-cyan cursor-pointer"
              >
                Append Text
              </button>
            </div>
            <p className="text-[10px] font-medium leading-relaxed text-marble/85 whitespace-pre-wrap max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
              {aiResponse}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
