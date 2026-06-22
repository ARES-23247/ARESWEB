"use client";

import React, { useState } from "react";
import { Compass, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { FieldAprilTag } from "./FieldCanvas";

interface AprilTagRosterAccordionProps {
  isTagsExpanded: boolean;
  setIsTagsExpanded: (val: boolean) => void;
  apriltags: FieldAprilTag[];
  selectedTagId: number | null;
  setSelectedTagId: (id: number | null) => void;
  setSelectedObstacleId: (id: string | null) => void;
  setSelectedElementInstanceId: (id: string | null) => void;
  handleAddAprilTag: () => void;
  handleDeleteAprilTag: (id: number) => void;
  handleUpdateAprilTagField: (id: number, field: keyof FieldAprilTag, value: any) => void;
  handleImportAprilTagsJson: (json: string) => void;
}

export default function AprilTagRosterAccordion({
  isTagsExpanded,
  setIsTagsExpanded,
  apriltags,
  selectedTagId,
  setSelectedTagId,
  setSelectedObstacleId,
  setSelectedElementInstanceId,
  handleAddAprilTag,
  handleDeleteAprilTag,
  handleUpdateAprilTagField,
  handleImportAprilTagsJson
}: AprilTagRosterAccordionProps) {
  const [importText, setImportText] = useState<string>("[]");
  const selectedTag = apriltags.find((t) => t.id === selectedTagId);

  return (
    <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isTagsExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
      <div 
        onClick={() => setIsTagsExpanded(!isTagsExpanded)}
        className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
          isTagsExpanded ? "border-b border-white/5 pb-3" : ""
        }`}
      >
        <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
          <Compass size={14} className="text-ares-gold" /> AprilTags Inventory
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddAprilTag();
            }}
            className="px-2.5 py-1 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0"
          >
            <Plus size={10} /> Add Tag
          </button>
          {isTagsExpanded ? <ChevronUp size={14} className="text-marble/40 cursor-pointer" /> : <ChevronDown size={14} className="text-marble/40 cursor-pointer" />}
        </div>
      </div>

      {isTagsExpanded && (
        <>
          <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
            {apriltags.length === 0 ? (
              <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-4">
                No AprilTags placed yet.
              </div>
            ) : (
              apriltags.map((tag) => {
                const isSelected = tag.id === selectedTagId;
                return (
                  <div
                    key={tag.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTagId(tag.id);
                      setSelectedObstacleId(null);
                      setSelectedElementInstanceId(null);
                    }}
                    className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "bg-ares-gold/10 border-ares-gold text-white"
                        : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="text-[11px] font-mono font-bold truncate">
                      Tag #{tag.id} ({tag.x.toFixed(2)}, {tag.y.toFixed(2)})
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAprilTag(tag.id);
                      }}
                      className="text-marble/40 hover:text-ares-red-light p-1 cursor-pointer transition-colors"
                      title="Delete tag"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {selectedTag !== undefined && selectedTag !== null ? (
            <div className="border-t border-white/5 pt-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold font-bold">
                Tag Properties: Tag #{selectedTag.id}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Tag ID (Integer)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={selectedTag.id}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateAprilTagField(selectedTag.id, "id", parseInt(e.target.value) || 0)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Height Z (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedTag.z}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateAprilTagField(selectedTag.id, "z", parseFloat(e.target.value) || 0)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Position X (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedTag.x}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateAprilTagField(selectedTag.id, "x", parseFloat(e.target.value) || 0)}
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
                    value={selectedTag.y}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateAprilTagField(selectedTag.id, "y", parseFloat(e.target.value) || 0)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Yaw Angle (degrees)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={selectedTag.yaw}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateAprilTagField(selectedTag.id, "yaw", parseFloat(e.target.value) || 0)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
              Select a placed AprilTag to edit.
            </div>
          )}

          {/* WPILib JSON Importer */}
          <div className="border-t border-white/5 pt-4 space-y-2.5">
            <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold font-heading">
              WPILib apriltags.json Import
            </span>
            <p className="text-[8.5px] text-marble/40 leading-relaxed font-mono">
              Paste the raw content of your WPILib format apriltags.json file below to import all tags automatically.
            </p>
            <textarea
              value={importText}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='e.g., {"tags": [{"ID": 1, "pose": {"translation": {"x": 1.5, "y": 1.5, "z": 0.5}, "rotation": {"quaternion": {"W": 1, "X": 0, "Y": 0, "Z": 0}}}}]}'
              className="w-full h-16 bg-black/40 border border-white/10 rounded-lg p-2 text-[9px] font-mono text-white focus:outline-none focus:border-ares-cyan resize-none"
            />
            <button
              onClick={() => {
                handleImportAprilTagsJson(importText);
                setImportText("");
              }}
              className="w-full py-1.5 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg transition-all font-bold cursor-pointer"
            >
              Parse and Import
            </button>
          </div>
        </>
      )}
    </div>
  );
}
