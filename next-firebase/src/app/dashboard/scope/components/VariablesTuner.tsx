"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, Trash2, RefreshCw, Send, Check, AlertCircle, Sliders } from "lucide-react";

export interface TunableConstant {
  key: string;
  value: any;
  type: "double" | "boolean" | "string" | "int";
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}

interface VariablesTunerProps {
  isStreaming: boolean;
  onPublishValue: (key: string, value: any, type: string) => void;
  savedConstants?: TunableConstant[];
  onConstantsChange?: (constants: TunableConstant[]) => void;
}

const DEFAULT_CONSTANTS: TunableConstant[] = [
  { key: "Drive/Translation/kP", value: 0.12, type: "double", min: 0.0, max: 1.0, step: 0.01, description: "Proportional gain for translation feedback loop" },
  { key: "Drive/Translation/kI", value: 0.0, type: "double", min: 0.0, max: 0.5, step: 0.01, description: "Integral gain for translation feedback loop" },
  { key: "Drive/Translation/kD", value: 0.015, type: "double", min: 0.0, max: 0.1, step: 0.001, description: "Derivative gain for translation feedback loop" },
  { key: "Drive/Heading/kP", value: 1.4, type: "double", min: 0.0, max: 5.0, step: 0.05, description: "Proportional gain for robot heading PID" },
  { key: "Drive/Heading/kI", value: 0.0, type: "double", min: 0.0, max: 1.0, step: 0.05, description: "Integral gain for robot heading PID" },
  { key: "Drive/Heading/kD", value: 0.09, type: "double", min: 0.0, max: 0.5, step: 0.005, description: "Derivative gain for robot heading PID" },
  { key: "Drive/MaxVelocity", value: 65.0, type: "double", min: 10.0, max: 120.0, step: 1.0, description: "Maximum allowable linear velocity (inches/sec)" },
  { key: "Drive/MaxAcceleration", value: 45.0, type: "double", min: 10.0, max: 120.0, step: 1.0, description: "Maximum linear acceleration (inches/sec²)" },
  { key: "PedroPathing/Follower/kP", value: 0.18, type: "double", min: 0.05, max: 0.8, step: 0.01, description: "Pedro Pathing path follower proportional coefficient" },
  { key: "PedroPathing/UseHeadingPID", value: true, type: "boolean", description: "Enable heading feedback correction during path following" },
  { key: "Limelight/PipelineIndex", value: 0, type: "int", min: 0, max: 9, step: 1, description: "Active AprilTag detection pipeline index" }
];

export default function VariablesTuner({
  isStreaming,
  onPublishValue,
  savedConstants,
  onConstantsChange
}: VariablesTunerProps) {
  const [constants, setConstants] = useState<TunableConstant[]>(() => {
    return savedConstants && savedConstants.length > 0 ? savedConstants : DEFAULT_CONSTANTS;
  });

  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<"double" | "boolean" | "string" | "int">("double");
  const [newVal, setNewVal] = useState("0");
  const [newDesc, setNewDesc] = useState("");
  
  // Status feedback states
  const [publishStatus, setPublishStatus] = useState<Record<string, "idle" | "sending" | "success" | "error">>({});

  // Sync state if parent sends updated savedConstants
  useEffect(() => {
    if (savedConstants && savedConstants.length > 0) {
      setConstants(savedConstants);
    }
  }, [savedConstants]);

  // Report changes back to parent
  const updateConstants = (newConsts: TunableConstant[]) => {
    setConstants(newConsts);
    if (onConstantsChange) {
      onConstantsChange(newConsts);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    const updated = constants.map((c) => {
      if (c.key === key) {
        return { ...c, value };
      }
      return c;
    });
    updateConstants(updated);

    // Reset status back to idle when edited
    setPublishStatus(prev => ({ ...prev, [key]: "idle" }));
  };

  const handlePublish = async (constant: TunableConstant) => {
    const { key, value, type } = constant;
    setPublishStatus((prev) => ({ ...prev, [key]: "sending" }));

    try {
      // Send value to parent handler (which uses NT4 Client to publish)
      onPublishValue(key, value, type);
      
      setPublishStatus((prev) => ({ ...prev, [key]: "success" }));
      setTimeout(() => {
        setPublishStatus((prev) => ({ ...prev, [key]: "idle" }));
      }, 1500);
    } catch (err) {
      console.error(`Failed to publish variable ${key}:`, err);
      setPublishStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const handlePublishAll = () => {
    constants.forEach((c) => {
      handlePublish(c);
    });
  };

  const handleResetDefaults = () => {
    if (confirm("Reset all constants to default values?")) {
      updateConstants(DEFAULT_CONSTANTS);
      setPublishStatus({});
    }
  };

  const handleDeleteConstant = (key: string) => {
    if (confirm(`Remove constant "${key}"?`)) {
      const filtered = constants.filter((c) => c.key !== key);
      updateConstants(filtered);
    }
  };

  const handleAddNew = () => {
    if (!newKey.trim()) return;
    if (constants.some((c) => c.key.toLowerCase() === newKey.trim().toLowerCase())) {
      alert("A constant with this name already exists.");
      return;
    }

    let parsedVal: any = newVal;
    if (newType === "double") parsedVal = parseFloat(newVal) || 0.0;
    else if (newType === "int") parsedVal = parseInt(newVal) || 0;
    else if (newType === "boolean") parsedVal = newVal === "true";

    const newItem: TunableConstant = {
      key: newKey.trim(),
      value: parsedVal,
      type: newType,
      description: newDesc.trim() || undefined,
      min: (newType === "double" || newType === "int") ? 0 : undefined,
      max: (newType === "double" || newType === "int") ? 10 : undefined,
      step: newType === "double" ? 0.01 : newType === "int" ? 1 : undefined
    };

    updateConstants([...constants, newItem]);
    setShowAddModal(false);
    setNewKey("");
    setNewVal("0");
    setNewDesc("");
  };

  // Filter constants based on search
  const filteredConstants = constants.filter((c) =>
    c.key.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-4 h-full p-6 text-white bg-obsidian-light">
      
      {/* Header Panel */}
      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-ares-gold" />
          <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading">
            Variables Tuner
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <button
              onClick={handlePublishAll}
              className="px-2 py-1 bg-ares-red hover:bg-ares-bronze text-white text-[9px] font-black uppercase tracking-wider rounded transition-all flex items-center gap-1 cursor-pointer"
              title="Publish all constants to robot"
            >
              <Send size={10} /> Sync All
            </button>
          )}
          <button
            onClick={handleResetDefaults}
            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-marble/70 hover:text-white text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer"
            title="Reset to factory settings"
          >
            Reset Defaults
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-5 h-5 rounded bg-ares-gold/25 border border-ares-gold/35 text-ares-gold flex items-center justify-center hover:bg-ares-gold/35 transition-all cursor-pointer"
            title="Add custom tuning variable"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Filter and Status Banner */}
      <div className="flex items-center gap-3">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-marble/30">
            <Search size={12} />
          </span>
          <input
            type="text"
            placeholder="Search constants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none font-sans"
          />
        </div>
        {!isStreaming && (
          <div className="text-[9px] uppercase font-bold text-marble/40 border border-white/5 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0 font-heading">
            <AlertCircle size={10} /> Simulation Only
          </div>
        )}
      </div>

      {/* Constants tuning body */}
      <div className="flex-grow overflow-y-auto space-y-3.5 max-h-[365px] pr-1 scrollbar-thin scrollbar-thumb-white/5">
        {filteredConstants.length === 0 ? (
          <div className="text-center py-12 text-marble/25 text-xs font-mono uppercase tracking-wider">
            No variables match search filter.
          </div>
        ) : (
          filteredConstants.map((c) => {
            const status = publishStatus[c.key] || "idle";
            const step = c.step ?? (c.type === "double" ? 0.01 : 1);
            
            return (
              <div 
                key={c.key} 
                className="group/item border border-white/5 bg-black/20 hover:border-white/10 rounded-xl p-3.5 flex flex-col gap-2 transition-all"
              >
                {/* Variable Key Header */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <span className="text-white font-mono text-[11px] font-semibold break-all leading-tight">
                      {c.key}
                    </span>
                    {c.description && (
                      <span className="text-marble/40 text-[9px] mt-0.5 font-medium leading-normal font-sans">
                        {c.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteConstant(c.key)}
                      className="opacity-0 group-hover/item:opacity-100 p-1 text-marble/35 hover:text-ares-red transition-all cursor-pointer rounded"
                      title="Remove constant"
                    >
                      <Trash2 size={10} />
                    </button>
                    {isStreaming && (
                      <button
                        onClick={() => handlePublish(c)}
                        disabled={status === "sending"}
                        className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border transition-all cursor-pointer flex items-center gap-1 ${
                          status === "success"
                            ? "bg-ares-success/15 border-ares-success/20 text-ares-success font-heading"
                            : status === "error"
                            ? "bg-ares-red/15 border-ares-red/20 text-ares-red-light font-heading"
                            : status === "sending"
                            ? "bg-ares-gold/15 border-ares-gold/20 text-ares-gold font-heading"
                            : "bg-white/5 border-white/10 text-marble/60 hover:border-white/20 hover:text-white font-heading"
                        }`}
                      >
                        {status === "sending" ? (
                          <RefreshCw size={8} className="animate-spin text-ares-gold" />
                        ) : status === "success" ? (
                          <Check size={8} className="text-ares-success" />
                        ) : (
                          <Send size={8} />
                        )}
                        <span>{status === "success" ? "Synced" : status === "error" ? "Fail" : "Sync"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Input Fields / Sliders by variable Type */}
                <div className="mt-1 flex items-center justify-between gap-4 bg-black/15 p-2 rounded-lg border border-white/5">
                  {c.type === "boolean" ? (
                    <label className="flex items-center gap-2 cursor-pointer select-none text-[10px] uppercase font-bold tracking-wider text-marble/60 w-full py-0.5">
                      <input
                        type="checkbox"
                        checked={c.value}
                        onChange={(e) => handleValueChange(c.key, e.target.checked)}
                        className="accent-ares-gold cursor-pointer rounded border-white/10"
                      />
                      <span>Active Flag</span>
                    </label>
                  ) : c.type === "string" ? (
                    <input
                      type="text"
                      value={c.value}
                      onChange={(e) => handleValueChange(c.key, e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-ares-gold font-mono"
                    />
                  ) : (
                    // Numeric Slider + Precision controls (double or int)
                    <div className="flex items-center gap-3 w-full">
                      {/* Range slider */}
                      <input
                        type="range"
                        min={c.min ?? 0}
                        max={c.max ?? (c.type === "int" ? 10 : 2.0)}
                        step={step}
                        value={c.value}
                        onChange={(e) => {
                          const v = c.type === "int" ? parseInt(e.target.value) : parseFloat(e.target.value);
                          handleValueChange(c.key, isNaN(v) ? 0 : v);
                        }}
                        className="flex-grow accent-ares-gold h-1 bg-white/10 rounded-lg cursor-pointer"
                      />
                      
                      {/* Precise values +/- buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            const val = Number(c.value) - step;
                            const rounded = parseFloat(val.toFixed(c.type === "double" ? 4 : 0));
                            handleValueChange(c.key, rounded);
                          }}
                          className="w-5 h-5 rounded bg-white/5 border border-white/10 text-marble/60 flex items-center justify-center hover:bg-white/10 hover:text-white cursor-pointer select-none text-[11px] font-sans"
                        >
                          -
                        </button>
                        
                        <input
                          type="number"
                          step={step}
                          value={c.value}
                          onChange={(e) => {
                            const v = c.type === "int" ? parseInt(e.target.value) : parseFloat(e.target.value);
                            handleValueChange(c.key, isNaN(v) ? 0 : v);
                          }}
                          className="w-14 bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-center text-[10px] font-bold text-white font-mono focus:outline-none focus:border-ares-gold"
                        />
                        
                        <button
                          onClick={() => {
                            const val = Number(c.value) + step;
                            const rounded = parseFloat(val.toFixed(c.type === "double" ? 4 : 0));
                            handleValueChange(c.key, rounded);
                          }}
                          className="w-5 h-5 rounded bg-white/5 border border-white/10 text-marble/60 flex items-center justify-center hover:bg-white/10 hover:text-white cursor-pointer select-none text-[11px] font-sans"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add new constant overlay modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-obsidian-light border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <h4 className="text-sm font-heading font-black uppercase text-white tracking-widest border-b border-white/5 pb-2">
              ➕ Add Tuning Variable
            </h4>
            
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-marble/50 font-heading">Variable Name / Key</label>
                <input
                  type="text"
                  placeholder="e.g. Drive/Heading/kP"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/25 font-mono focus:outline-none focus:border-ares-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-marble/50 font-heading">Data Type</label>
                  <select
                    value={newType}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      setNewType(t);
                      if (t === "boolean") setNewVal("true");
                      else setNewVal("0");
                    }}
                    className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-gold cursor-pointer"
                  >
                    <option value="double">Double</option>
                    <option value="int">Integer</option>
                    <option value="boolean">Boolean</option>
                    <option value="string">String</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-marble/50 font-heading">Initial Value</label>
                  {newType === "boolean" ? (
                    <select
                      value={newVal}
                      onChange={(e) => setNewVal(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-gold cursor-pointer"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newVal}
                      onChange={(e) => setNewVal(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-ares-gold"
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-marble/50 font-heading">Brief Description</label>
                <input
                  type="text"
                  placeholder="What is this variable used for?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/25 focus:outline-none focus:border-ares-gold font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-2 border-t border-white/5 pt-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-2 rounded-xl bg-white/5 text-marble hover:bg-white/10 text-xs font-bold transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNew}
                className="px-4 py-2 rounded-xl bg-ares-gold hover:bg-ares-gold-soft text-black text-xs font-bold transition-all cursor-pointer font-sans"
              >
                Add Constant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
