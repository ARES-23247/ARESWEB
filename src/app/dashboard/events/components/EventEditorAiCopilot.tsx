"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { TeamLocation } from "./LocationManagerModal";

interface EventEditorAiCopilotProps {
  formTitle: string;
  formDescription: string;
  setFormDescription: (val: string) => void;
  formLocationId: string;
  locations: TeamLocation[];
  setRevertAlert: (msg: string | null) => void;
}

export default function EventEditorAiCopilot({
  formTitle,
  formDescription,
  setFormDescription,
  formLocationId,
  locations,
  setRevertAlert,
}: EventEditorAiCopilotProps) {
  // AI states
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  // AI Copilot: Assistant prompt
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
          text: formDescription,
          context: `Event Title: ${formTitle}\nLocation: ${
            locations.find((l) => l.id === formLocationId)?.name || "MARS Building"
          }`
        })
      });

      if (!res.ok) throw new Error("AI Assistant service error.");
      const data = await res.json();
      setAiResponse(data.response || "");
    } catch (err: any) {
      setAiResponse(
        `Failed to contact Gemini co-pilot: ${err.message}. Using offline fallback.\n\nOur team is committed to implementing robust code structures inside FIRST® programs. By using ARESLib, we maintain clean state machines and accurate sensor integrations.`
      );
    } finally {
      setAiLoading(false);
    }
  };

  // AI Copilot: Grammar check
  const handleGrammarCheck = async () => {
    if (!formDescription.trim()) return;
    setAiLoading(true);
    setGrammarEdits([]);
    setSuggestedCorrection("");
    try {
      const res = await authenticatedFetch("/api/ai/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formDescription })
      });

      if (!res.ok) throw new Error("AI Grammar check service error.");
      const data = await res.json();
      setSuggestedCorrection(data.correctedText || "");
      setGrammarEdits(data.edits || []);
    } catch (err: any) {
      console.warn(err);
      setSuggestedCorrection(formDescription);
      setGrammarEdits([
        {
          original: "offline check",
          corrected: "online check",
          explanation: "Connect to live sync to get full Gemini spelling check."
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="w-full lg:w-[32%] border-l border-white/10 p-5 bg-black/35 rounded-xl flex flex-col justify-between overflow-y-auto shrink-0 space-y-5 scrollbar-thin scrollbar-thumb-white/5 text-left">
      <div className="space-y-5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={16} className="text-ares-cyan" />
          <h4 className="text-xs font-black uppercase tracking-widest text-white">Gemini Operation Copilot</h4>
        </div>

        <div className="space-y-2.5">
          <span className="text-[9px] uppercase font-black tracking-widest text-marble/45 block">
            Quick Assistant Presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                handleAiAssistant(
                  "Write a catchy announcement for our team newsletter introducing this event.",
                  "Outreach Copywriter"
                )
              }
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[8px] uppercase tracking-wider text-marble/80 hover:text-white transition-all cursor-pointer"
            >
              Newsletter Pitch
            </button>
            <button
              type="button"
              onClick={() =>
                handleAiAssistant(
                  "Suggest a list of safety guidelines and materials needed for this event.",
                  "Mechanical Safety"
                )
              }
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[8px] uppercase tracking-wider text-marble/80 hover:text-white transition-all cursor-pointer"
            >
              Safety Checklist
            </button>
            <button
              type="button"
              onClick={() =>
                handleAiAssistant(
                  "Refactor this explanation to be highly professional and engaging for FLL team parents.",
                  "Youth Coordinator"
                )
              }
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded text-[8px] uppercase tracking-wider text-marble/80 hover:text-white transition-all cursor-pointer"
            >
              Parent Friendly
            </button>
          </div>
        </div>

        {/* Chat Prompt */}
        <div className="space-y-2">
          <label
            htmlFor="ai-chat-prompt"
            className="block text-[8px] uppercase font-black tracking-widest text-marble/45"
          >
            Ask Custom Task
          </label>
          <div className="flex gap-2">
            <input
              id="ai-chat-prompt"
              type="text"
              placeholder="e.g. List potluck snack ideas..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-grow bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-cyan"
            />
            <button
              type="button"
              onClick={() => handleAiAssistant(aiPrompt)}
              disabled={aiLoading}
              className="px-3.5 bg-ares-cyan text-black rounded-lg hover:brightness-110 font-black uppercase text-[10px] tracking-wider transition-all disabled:opacity-40 cursor-pointer shrink-0"
            >
              Ask
            </button>
          </div>
        </div>

        {/* AI Response Output */}
        {aiResponse && (
          <div className="space-y-1.5 animate-fade-in">
            <span className="text-[8px] uppercase font-black tracking-widest text-ares-cyan block">
              Copilot Output
            </span>
            <div className="p-3 bg-black/45 border border-ares-cyan/10 rounded-lg text-xs leading-relaxed text-marble/90 font-medium font-mono max-h-[160px] overflow-y-auto scrollbar-thin whitespace-pre-wrap select-text">
              {aiResponse}
            </div>
          </div>
        )}

        {/* Grammar checker */}
        <div className="border-t border-white/5 pt-4 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase font-black tracking-widest text-marble/45">
              Description Grammar & Style
            </span>
            <button
              type="button"
              onClick={handleGrammarCheck}
              disabled={aiLoading}
              className="px-2.5 py-1 border border-ares-cyan/35 hover:bg-ares-cyan/15 text-ares-cyan text-[8px] uppercase font-black tracking-widest rounded transition-all cursor-pointer"
            >
              Run Spelling Audit
            </button>
          </div>

          {suggestedCorrection && (
            <div className="space-y-2 animate-fade-in text-left">
              <p className="text-[9px] text-marble/40">Suggested edit:</p>
              <div className="p-2.5 bg-white/5 rounded border border-white/5 text-[11px] leading-relaxed text-white whitespace-pre-wrap">
                {suggestedCorrection}
              </div>
              {grammarEdits.length > 0 && (
                <div className="space-y-1.5">
                  {grammarEdits.map((ed, idx) => (
                    <div key={idx} className="p-2 bg-ares-red/10 border border-ares-red/25 rounded text-[9px] text-marble/85 font-mono">
                      <span className="text-ares-red line-through block">-{ed.original}</span>
                      <span className="text-ares-success font-bold block">+{ed.corrected}</span>
                      {ed.explanation && <p className="text-[8px] text-marble/45 mt-1 italic">{ed.explanation}</p>}
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormDescription(suggestedCorrection);
                  setSuggestedCorrection("");
                  setGrammarEdits([]);
                  setRevertAlert("Spelling/grammar edits applied.");
                }}
                className="w-full py-1.5 bg-ares-cyan text-black font-black uppercase tracking-widest text-[9px] rounded hover:brightness-105 transition-all cursor-pointer shadow-md"
              >
                Apply Corrections
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-[8.5px] font-mono text-marble/35 uppercase leading-normal tracking-wide mt-5">
        Powered by Google Gemini 1.5 Pro. Logs auto-reconciled with ARESLib rules.
      </p>
    </div>
  );
}
