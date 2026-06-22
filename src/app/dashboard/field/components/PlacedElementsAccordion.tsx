"use client";

import React from "react";
import { Activity, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { FieldElementInstance, ElementType } from "./FieldCanvas";

interface PlacedElementsAccordionProps {
  isPlacedElementsExpanded: boolean;
  setIsPlacedElementsExpanded: (val: boolean) => void;
  elements: FieldElementInstance[];
  elementTypes: ElementType[];
  selectedElementInstanceId: string | null;
  setSelectedElementInstanceId: (id: string | null) => void;
  handleDeleteElementInstance: (id: string) => void;
  handleUpdateElementInstanceField: (id: string, field: keyof FieldElementInstance, value: any) => void;
}

export default function PlacedElementsAccordion({
  isPlacedElementsExpanded,
  setIsPlacedElementsExpanded,
  elements,
  elementTypes,
  selectedElementInstanceId,
  setSelectedElementInstanceId,
  handleDeleteElementInstance,
  handleUpdateElementInstanceField
}: PlacedElementsAccordionProps) {
  const selectedElement = elements.find((x) => x.id === selectedElementInstanceId);
  const selectedElementType = selectedElement ? elementTypes.find((t) => t.id === selectedElement.elementTypeId) : null;

  return (
    <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isPlacedElementsExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
      <div 
        onClick={() => setIsPlacedElementsExpanded(!isPlacedElementsExpanded)}
        className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
          isPlacedElementsExpanded ? "border-b border-white/5 pb-3" : ""
        }`}
      >
        <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
          <Activity size={14} className="text-ares-gold" /> Placed Elements
        </h3>
        {isPlacedElementsExpanded ? <ChevronUp size={14} className="text-marble/40" /> : <ChevronDown size={14} className="text-marble/40" />}
      </div>

      {isPlacedElementsExpanded && (
        <>
          <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
            {elements.length === 0 ? (
              <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-4">
                No elements placed on field.
              </div>
            ) : (
              elements.map((el, idx) => {
                const type = elementTypes.find((t) => t.id === el.elementTypeId);
                const isSelected = el.id === selectedElementInstanceId;
                return (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementInstanceId(el.id)}
                    className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-ares-gold/10 border-ares-gold text-white"
                        : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: type?.color || "#fff" }}
                      />
                      <span className="text-[11px] font-mono font-bold truncate">
                        {type?.name || "Unknown"} #{idx + 1}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteElementInstance(el.id);
                      }}
                      className="text-marble/40 hover:text-ares-red-light p-1 cursor-pointer transition-colors"
                      title="Delete placed instance"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {selectedElement && selectedElementType ? (
            <div className="border-t border-white/5 pt-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                Instance: {selectedElementType.name || "Element"}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Position X (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedElement.x}
                    onChange={(e) => handleUpdateElementInstanceField(selectedElement.id, "x", parseFloat(e.target.value) || 0)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Position Y (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedElement.y}
                    onChange={(e) => handleUpdateElementInstanceField(selectedElement.id, "y", parseFloat(e.target.value) || 0)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Rotation (deg)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={selectedElement.rotation}
                    onChange={(e) => handleUpdateElementInstanceField(selectedElement.id, "rotation", parseFloat(e.target.value) || 0)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
              Select a placed element to edit.
            </div>
          )}
        </>
      )}
    </div>
  );
}
