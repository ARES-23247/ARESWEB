"use client";

import React from "react";
import { Activity, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { FieldObstacle } from "./FieldCanvas";

interface ObstaclesListAccordionProps {
  isObstaclesExpanded: boolean;
  setIsObstaclesExpanded: (val: boolean) => void;
  obstacles: FieldObstacle[];
  selectedObstacleId: string | null;
  setSelectedObstacleId: (id: string | null) => void;
  handleAddObstacle: () => void;
  handleDeleteObstacle: (id: string) => void;
  handleUpdateObstacleField: (id: string, field: keyof FieldObstacle, value: any) => void;
  isDrawingPolygon: boolean;
  setIsDrawingPolygon: (val: boolean) => void;
  setDrawingPoints: (pts: { x: number; y: number }[]) => void;
  setHoverPoint: (pt: { x: number; y: number } | null) => void;
  handleMirrorObstacle: (obsId: string, axis: "x" | "y" | "center") => void;
  fieldType: "ftc" | "frc";
}

export default function ObstaclesListAccordion({
  isObstaclesExpanded,
  setIsObstaclesExpanded,
  obstacles,
  selectedObstacleId,
  setSelectedObstacleId,
  handleAddObstacle,
  handleDeleteObstacle,
  handleUpdateObstacleField,
  isDrawingPolygon,
  setIsDrawingPolygon,
  setDrawingPoints,
  setHoverPoint,
  handleMirrorObstacle,
  fieldType
}: ObstaclesListAccordionProps) {
  const selectedObs = obstacles.find((o) => o.id === selectedObstacleId);

  return (
    <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isObstaclesExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
      <div 
        onClick={() => setIsObstaclesExpanded(!isObstaclesExpanded)}
        className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
          isObstaclesExpanded ? "border-b border-white/5 pb-3" : ""
        }`}
      >
        <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
          <Activity size={14} className="text-ares-gold" /> Obstacle Inventory
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddObstacle();
            }}
            className="px-2 py-0.5 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[8.5px] uppercase font-black tracking-widest rounded transition-all cursor-pointer font-bold shrink-0"
          >
            <Plus size={10} /> Add Box
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsDrawingPolygon(!isDrawingPolygon);
              setDrawingPoints([]);
              setHoverPoint(null);
            }}
            className={`px-2 py-0.5 text-[8.5px] uppercase font-black tracking-widest rounded transition-all cursor-pointer font-bold shrink-0 ${
              isDrawingPolygon 
                ? "bg-ares-cyan/25 border border-ares-cyan text-ares-cyan" 
                : "bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30"
            }`}
          >
            <Plus size={10} /> {isDrawingPolygon ? "Drawing" : "Draw Poly"}
          </button>
          {isObstaclesExpanded ? <ChevronUp size={14} className="text-marble/40 cursor-pointer" /> : <ChevronDown size={14} className="text-marble/40 cursor-pointer" />}
        </div>
      </div>

      {isObstaclesExpanded && (
        <>
          <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
            {obstacles.length === 0 ? (
              <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-6">
                No obstacles placed yet.
              </div>
            ) : (
              obstacles.map((obs) => {
                const isSelected = obs.id === selectedObstacleId;
                return (
                  <div
                    key={obs.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedObstacleId(obs.id);
                    }}
                    className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-ares-gold/10 border-ares-gold text-white" 
                        : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="text-[11px] font-mono font-bold truncate">
                      {obs.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteObstacle(obs.id);
                      }}
                      className="text-marble/40 hover:text-ares-red-light p-1 cursor-pointer transition-colors focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                      title="Delete obstacle"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {selectedObs ? (
            <div className="border-t border-white/5 pt-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                Parameters: {selectedObs.name}
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Label Name
                  </label>
                  <input
                    type="text"
                    value={selectedObs.name}
                    onChange={(e) => handleUpdateObstacleField(selectedObs.id, "name", e.target.value)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Centroid X (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedObs.x}
                    onChange={(e) => {
                      const newX = parseFloat(e.target.value) || 0;
                      const diffX = newX - selectedObs.x;
                      if (selectedObs.shape === "polygon" && selectedObs.points) {
                        const updatedPoints = selectedObs.points.map(p => ({ x: p.x + diffX, y: p.y }));
                        handleUpdateObstacleField(selectedObs.id, "points", updatedPoints);
                      }
                      handleUpdateObstacleField(selectedObs.id, "x", newX);
                    }}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Centroid Y (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedObs.y}
                    onChange={(e) => {
                      const newY = parseFloat(e.target.value) || 0;
                      const diffY = newY - selectedObs.y;
                      if (selectedObs.shape === "polygon" && selectedObs.points) {
                        const updatedPoints = selectedObs.points.map(p => ({ x: p.x, y: p.y + diffY }));
                        handleUpdateObstacleField(selectedObs.id, "points", updatedPoints);
                      }
                      handleUpdateObstacleField(selectedObs.id, "y", newY);
                    }}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                  />
                </div>

                {selectedObs.shape === "polygon" ? (
                  <div className="col-span-2 space-y-3">
                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Edit Vertices (meters)
                      </label>
                    </div>

                    <div className="space-y-1.5 border border-white/5 bg-black/20 p-2.5 rounded-xl max-h-36 overflow-y-auto">
                      {(selectedObs.points || []).map((pt, idx) => {
                        return (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="text-[8px] font-mono text-marble/35 w-3.5">
                              #{idx + 1}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={pt.x}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const raw = parseFloat(e.target.value) || 0;
                                const updated = (selectedObs.points || []).map((p, i) =>
                                  i === idx ? { ...p, x: raw } : p
                                );
                                handleUpdateObstacleField(selectedObs.id, "points", updated);
                                const newCx = updated.reduce((sum, p) => sum + p.x, 0) / updated.length;
                                handleUpdateObstacleField(selectedObs.id, "x", Number(newCx.toFixed(3)));
                              }}
                              className="w-full bg-black/45 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-white font-mono text-center focus:outline-none focus:border-ares-cyan"
                              placeholder="X"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={pt.y}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const raw = parseFloat(e.target.value) || 0;
                                const updated = (selectedObs.points || []).map((p, i) =>
                                  i === idx ? { ...p, y: raw } : p
                                );
                                handleUpdateObstacleField(selectedObs.id, "points", updated);
                                const newCy = updated.reduce((sum, p) => sum + p.y, 0) / updated.length;
                                handleUpdateObstacleField(selectedObs.id, "y", Number(newCy.toFixed(3)));
                              }}
                              className="w-full bg-black/45 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-white font-mono text-center focus:outline-none focus:border-ares-cyan"
                              placeholder="Y"
                            />
                            <button
                              onClick={() => {
                                const updated = (selectedObs.points || []).filter((_, i) => i !== idx);
                                handleUpdateObstacleField(selectedObs.id, "points", updated);
                                if (updated.length > 0) {
                                  const newCx = updated.reduce((sum, p) => sum + p.x, 0) / updated.length;
                                  const newCy = updated.reduce((sum, p) => sum + p.y, 0) / updated.length;
                                  handleUpdateObstacleField(selectedObs.id, "x", Number(newCx.toFixed(3)));
                                  handleUpdateObstacleField(selectedObs.id, "y", Number(newCy.toFixed(3)));
                                }
                              }}
                              className="text-marble/40 hover:text-ares-red-light p-0.5 transition-colors"
                              title="Remove vertex"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        onClick={() => {
                          const newPt = { x: selectedObs.x + 0.1, y: selectedObs.y + 0.1 };
                          const updated = [...(selectedObs.points || []), newPt];
                          handleUpdateObstacleField(selectedObs.id, "points", updated);
                          const newCx = updated.reduce((sum, p) => sum + p.x, 0) / updated.length;
                          const newCy = updated.reduce((sum, p) => sum + p.y, 0) / updated.length;
                          handleUpdateObstacleField(selectedObs.id, "x", Number(newCx.toFixed(3)));
                          handleUpdateObstacleField(selectedObs.id, "y", Number(newCy.toFixed(3)));
                        }}
                        className="w-full py-1 text-[8px] uppercase font-black tracking-widest text-ares-gold border border-dashed border-ares-gold/20 hover:border-ares-gold/40 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                      >
                        Add Vertex
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Width (m) - Y Axis
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        value={selectedObs.width}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "width", parseFloat(e.target.value) || 0.1)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Height (m) - X Axis
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        value={selectedObs.height}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "height", parseFloat(e.target.value) || 0.1)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1.5 col-span-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                      Rotation (deg)
                    </label>
                    <span className="text-ares-cyan font-mono text-[10px] font-bold">{selectedObs.rotation ?? 0}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={selectedObs.rotation ?? 0}
                    onChange={(e) => handleUpdateObstacleField(selectedObs.id, "rotation", parseInt(e.target.value) || 0)}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-cyan focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                      Friction
                    </label>
                    <span className="text-ares-cyan font-mono text-[10px] font-bold">{(selectedObs.friction ?? 0.5).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedObs.friction ?? 0.5}
                    onChange={(e) => handleUpdateObstacleField(selectedObs.id, "friction", parseFloat(e.target.value) || 0)}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-cyan focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                      Restitution
                    </label>
                    <span className="text-ares-cyan font-mono text-[10px] font-bold">{(selectedObs.restitution ?? 0.3).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectedObs.restitution ?? 0.3}
                    onChange={(e) => handleUpdateObstacleField(selectedObs.id, "restitution", parseFloat(e.target.value) || 0)}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-ares-cyan focus:outline-none"
                  />
                </div>

                {/* Mirror Duplicate controls */}
                <div className="col-span-2 border-t border-white/5 pt-3 space-y-2">
                  <span className="text-[8px] uppercase font-black tracking-widest text-marble/45 block font-semibold">
                    Mirror Duplicate Copy
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleMirrorObstacle(selectedObs.id, "x")}
                      className="py-1.5 text-[8.5px] font-bold uppercase tracking-wider text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                      title="Duplicate and mirror across X-axis"
                    >
                      X-Axis (Y)
                    </button>
                    <button
                      onClick={() => handleMirrorObstacle(selectedObs.id, "y")}
                      className="py-1.5 text-[8.5px] font-bold uppercase tracking-wider text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                      title="Duplicate and mirror across Y-axis"
                    >
                      Y-Axis (X)
                    </button>
                    <button
                      onClick={() => handleMirrorObstacle(selectedObs.id, "center")}
                      className="py-1.5 text-[8.5px] font-bold uppercase tracking-wider text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                      title="Duplicate and mirror across center"
                    >
                      Center
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Obstacle Type
                  </label>
                  <select
                    value={selectedObs.obstacleType}
                    onChange={(e) => {
                      const newType = e.target.value as "blocking" | "ramp";
                      handleUpdateObstacleField(selectedObs.id, "obstacleType", newType);
                      handleUpdateObstacleField(selectedObs.id, "isBlocking", newType === "blocking");
                      if (newType === "ramp" && !selectedObs.rampDirection) {
                        handleUpdateObstacleField(selectedObs.id, "rampDirection", "up");
                      }
                    }}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                  >
                    <option value="blocking">Blocking Wall</option>
                    <option value="ramp">Non-Blocking Ramp</option>
                  </select>
                </div>

                {selectedObs.obstacleType === "ramp" && (
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                      Ramp Incline Direction
                    </label>
                    <select
                      value={selectedObs.rampDirection || "up"}
                      onChange={(e) => handleUpdateObstacleField(selectedObs.id, "rampDirection", e.target.value)}
                      className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                    >
                      <option value="up">North (Up)</option>
                      <option value="down">South (Down)</option>
                      <option value="left">West (Left)</option>
                      <option value="right">East (Right)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
              Select an obstacle to edit properties.
            </div>
          )}
        </>
      )}
    </div>
  );
}
