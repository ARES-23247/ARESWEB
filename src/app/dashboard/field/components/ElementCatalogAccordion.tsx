"use client";

import React from "react";
import { Grid, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { ElementType } from "../types";

interface ElementCatalogAccordionProps {
  isElementCatalogExpanded: boolean;
  setIsElementCatalogExpanded: (val: boolean) => void;
  elementTypes: ElementType[];
  selectedElementTypeId: string | null;
  setSelectedElementTypeId: (id: string | null) => void;
  handleAddElementType: () => void;
  handleDeleteElementType: (id: string) => void;
  handleUpdateElementTypeField: (id: string, field: keyof ElementType, value: any) => void;
  handleAddElementInstance: (elementTypeId: string) => void;
}

export default function ElementCatalogAccordion({
  isElementCatalogExpanded,
  setIsElementCatalogExpanded,
  elementTypes,
  selectedElementTypeId,
  setSelectedElementTypeId,
  handleAddElementType,
  handleDeleteElementType,
  handleUpdateElementTypeField,
  handleAddElementInstance
}: ElementCatalogAccordionProps) {
  const selectedType = elementTypes.find((x) => x.id === selectedElementTypeId);

  return (
    <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isElementCatalogExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
      <div 
        onClick={() => setIsElementCatalogExpanded(!isElementCatalogExpanded)}
        className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
          isElementCatalogExpanded ? "border-b border-white/5 pb-3" : ""
        }`}
      >
        <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
          <Grid size={14} className="text-ares-gold" /> Element Catalog Types
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddElementType();
            }}
            className="px-2.5 py-1 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold"
          >
            <Plus size={10} /> New Type
          </button>
          {isElementCatalogExpanded ? <ChevronUp size={14} className="text-marble/40" /> : <ChevronDown size={14} className="text-marble/40" />}
        </div>
      </div>

      {isElementCatalogExpanded && (
        <>
          <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
            {elementTypes.length === 0 ? (
              <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-4">
                No element types defined.
              </div>
            ) : (
              elementTypes.map((t) => {
                const isSelected = t.id === selectedElementTypeId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedElementTypeId(t.id)}
                    className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-ares-gold/10 border-ares-gold text-white"
                        : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-[11px] font-mono font-bold truncate">
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddElementInstance(t.id);
                        }}
                        className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[8px] uppercase font-black tracking-widest rounded transition-all cursor-pointer"
                        title="Place instance of this type on field"
                      >
                        Place
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteElementType(t.id);
                        }}
                        className="text-marble/45 hover:text-ares-red-light p-1 cursor-pointer transition-colors"
                        title="Delete type catalog template"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedType ? (
            <div className="border-t border-white/5 pt-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                Type Properties: {selectedType.name}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Type Name
                  </label>
                  <input
                    type="text"
                    value={selectedType.name}
                    onChange={(e) => handleUpdateElementTypeField(selectedType.id, "name", e.target.value)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Shape
                  </label>
                  <select
                    value={selectedType.shape}
                    onChange={(e) => handleUpdateElementTypeField(selectedType.id, "shape", e.target.value as any)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                  >
                    <option value="sphere">Sphere (Circle)</option>
                    <option value="cylinder">Cylinder (Circle)</option>
                    <option value="box">Box (Rect)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Color (Hex)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="color"
                      value={selectedType.color}
                      onChange={(e) => handleUpdateElementTypeField(selectedType.id, "color", e.target.value)}
                      className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={selectedType.color}
                      onChange={(e) => handleUpdateElementTypeField(selectedType.id, "color", e.target.value)}
                      className="bg-black/45 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan w-full text-center"
                    />
                  </div>
                </div>
                {selectedType.shape === "box" ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Width (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedType.width}
                        onChange={(e) => handleUpdateElementTypeField(selectedType.id, "width", parseFloat(e.target.value) || 0.15)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Height (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedType.height}
                        onChange={(e) => handleUpdateElementTypeField(selectedType.id, "height", parseFloat(e.target.value) || 0.15)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                      Diameter (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedType.diameter || 0.15}
                      onChange={(e) => handleUpdateElementTypeField(selectedType.id, "diameter", parseFloat(e.target.value) || 0.15)}
                      className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Depth/Z-Height (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedType.depth}
                    onChange={(e) => handleUpdateElementTypeField(selectedType.id, "depth", parseFloat(e.target.value) || 0.15)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Mass (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedType.massKg}
                    onChange={(e) => handleUpdateElementTypeField(selectedType.id, "massKg", parseFloat(e.target.value) || 0.1)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex items-center gap-2 col-span-2 pt-1">
                  <input
                    type="checkbox"
                    id="movable-chk"
                    checked={selectedType.movable}
                    onChange={(e) => handleUpdateElementTypeField(selectedType.id, "movable", e.target.checked)}
                    className="w-4 h-4 accent-ares-gold cursor-pointer"
                  />
                  <label htmlFor="movable-chk" className="text-[10px] font-mono text-white cursor-pointer select-none">
                    Movable Physics Body (Dynamic)
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
              Select a type template to edit.
            </div>
          )}
        </>
      )}
    </div>
  );
}
