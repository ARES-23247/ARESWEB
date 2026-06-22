"use client";

import React from "react";
import { Sliders, ChevronUp, ChevronDown, RefreshCw, Save, Trash2 } from "lucide-react";

interface DriverStationCardProps {
  isLayoutSettingsExpanded: boolean;
  setIsLayoutSettingsExpanded: (val: boolean) => void;
  configName: string;
  setConfigName: (val: string) => void;
  gameYear: string;
  setGameYear: (val: string) => void;
  fieldType: "ftc" | "frc";
  setFieldType: (val: "ftc" | "frc") => void;
  redDriverStation: "north" | "south" | "east" | "west";
  setRedDriverStation: (val: "north" | "south" | "east" | "west") => void;
  blueDriverStation: "north" | "south" | "east" | "west";
  setBlueDriverStation: (val: "north" | "south" | "east" | "west") => void;
  xAxisDirection: "up" | "down" | "left" | "right";
  setXAxisDirection: (val: "up" | "down" | "left" | "right") => void;
  yAxisDirection: "up" | "down" | "left" | "right";
  setYAxisDirection: (val: "up" | "down" | "left" | "right") => void;
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  showAllianceZones: boolean;
  setShowAllianceZones: (val: boolean) => void;
  showCoordinateAxes: boolean;
  setShowCoordinateAxes: (val: boolean) => void;

  // Loader related
  localGlbFile: File | null;
  hasGlbUrl: boolean;
  handleGlbFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  localBgFile: File | null;
  hasBgImageUrl: boolean;
  handleBgFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bgImage: HTMLImageElement | null;
  setRawUploadedImage: (img: HTMLImageElement | null) => void;
  setShowCropModal: (val: boolean) => void;

  // Actions
  saving: boolean;
  handleSaveToCloud: () => void;
  selectedConfigId: string;
  loading: boolean;
  handleDeleteLayout: () => void;
}

export default function DriverStationCard({
  isLayoutSettingsExpanded,
  setIsLayoutSettingsExpanded,
  configName,
  setConfigName,
  gameYear,
  setGameYear,
  fieldType,
  setFieldType,
  redDriverStation,
  setRedDriverStation,
  blueDriverStation,
  setBlueDriverStation,
  xAxisDirection,
  setXAxisDirection,
  yAxisDirection,
  setYAxisDirection,
  showGrid,
  setShowGrid,
  showAllianceZones,
  setShowAllianceZones,
  showCoordinateAxes,
  setShowCoordinateAxes,

  localGlbFile,
  hasGlbUrl,
  handleGlbFileChange,

  localBgFile,
  hasBgImageUrl,
  handleBgFileChange,
  bgImage,
  setRawUploadedImage,
  setShowCropModal,

  saving,
  handleSaveToCloud,
  selectedConfigId,
  loading,
  handleDeleteLayout
}: DriverStationCardProps) {
  return (
    <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isLayoutSettingsExpanded ? "p-6 space-y-4" : "p-4 space-y-0"}`}>
      <h3 
        onClick={() => setIsLayoutSettingsExpanded(!isLayoutSettingsExpanded)}
        className={`text-xs font-black uppercase text-white tracking-widest font-heading flex items-center justify-between cursor-pointer hover:text-ares-gold transition-colors select-none ${
          isLayoutSettingsExpanded ? "border-b border-white/5 pb-3" : ""
        }`}
      >
        <span className="flex items-center gap-2">
          <Sliders size={14} className="text-ares-gold" /> Layout Settings
        </span>
        {isLayoutSettingsExpanded ? <ChevronUp size={14} className="text-marble/40" /> : <ChevronDown size={14} className="text-marble/40" />}
      </h3>
      
      {isLayoutSettingsExpanded && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] uppercase font-black tracking-widest text-marble/55">
              Layout Name
            </label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Championship Finals layout..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-ares-cyan transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] uppercase font-black tracking-widest text-marble/55">
              Game Year / Season
            </label>
            <select
              value={["2025-2026", "2024-2025", "2023-2024", "2022-2023", "2021-2022"].includes(gameYear) ? gameYear : "custom"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setGameYear("");
                } else {
                  setGameYear(val);
                }
              }}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-ares-cyan cursor-pointer transition-colors"
            >
              <option value="2025-2026">2025-2026 Season</option>
              <option value="2024-2025">2024-2025 (Into The Deep / Reefscape)</option>
              <option value="2023-2024">2023-2024 (Centerstage / Crescendo)</option>
              <option value="2022-2023">2022-2023 (Powerplay / Charged Up)</option>
              <option value="2021-2022">2021-2022 (Freight Frenzy / Rapid React)</option>
              <option value="custom">Other / Custom Year...</option>
            </select>

            {!["2025-2026", "2024-2025", "2023-2024", "2022-2023", "2021-2022"].includes(gameYear) && (
              <input
                type="text"
                value={gameYear}
                onChange={(e) => setGameYear(e.target.value)}
                placeholder="Enter custom year (e.g., 2020-2021)..."
                className="w-full bg-black/45 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-ares-cyan mt-1.5"
              />
            )}
          </div>

          {/* Field Configuration Subsection */}
          <div className="border-t border-white/5 pt-3 space-y-3">
            <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold">
              Field Parameters
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                  Field Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as "ftc" | "frc")}
                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                >
                  <option value="ftc">FTC (Square)</option>
                  <option value="frc">FRC (2:1 Rect)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                  Red Station
                </label>
                <select
                  value={redDriverStation}
                  onChange={(e) => setRedDriverStation(e.target.value as any)}
                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                >
                  <option value="north">North</option>
                  <option value="south">South</option>
                  <option value="east">East</option>
                  <option value="west">West</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                  Blue Station
                </label>
                <select
                  value={blueDriverStation}
                  onChange={(e) => setBlueDriverStation(e.target.value as any)}
                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                >
                  <option value="north">North</option>
                  <option value="south">South</option>
                  <option value="east">East</option>
                  <option value="west">West</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                  +X Direction
                </label>
                <select
                  value={xAxisDirection}
                  onChange={(e) => setXAxisDirection(e.target.value as any)}
                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                >
                  <option value="up">Up (North)</option>
                  <option value="down">Down (South)</option>
                  <option value="left">Left (West)</option>
                  <option value="right">Right (East)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                  +Y Direction
                </label>
                <select
                  value={yAxisDirection}
                  onChange={(e) => setYAxisDirection(e.target.value as any)}
                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                >
                  <option value="up">Up (North)</option>
                  <option value="down">Down (South)</option>
                  <option value="left">Left (West)</option>
                  <option value="right">Right (East)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Display Options Subsection */}
          <div className="border-t border-white/5 pt-3 space-y-2">
            <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold">
              Display Options
            </span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-grid-chk"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="w-4 h-4 accent-ares-gold cursor-pointer"
                />
                <label htmlFor="show-grid-chk" className="text-[10px] font-mono text-white cursor-pointer select-none">
                  Show Grid Lines
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-alliance-chk"
                  checked={showAllianceZones}
                  onChange={(e) => setShowAllianceZones(e.target.checked)}
                  className="w-4 h-4 accent-ares-gold cursor-pointer"
                />
                <label htmlFor="show-alliance-chk" className="text-[10px] font-mono text-white cursor-pointer select-none font-medium">
                  Show Alliance Zones (FTC Only)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-axes-chk"
                  checked={showCoordinateAxes}
                  onChange={(e) => setShowCoordinateAxes(e.target.checked)}
                  className="w-4 h-4 accent-ares-gold cursor-pointer"
                />
                <label htmlFor="show-axes-chk" className="text-[10px] font-mono text-white cursor-pointer select-none">
                  Show Coordinate Axes
                </label>
              </div>
            </div>
          </div>

          {/* Field Assets Subsection */}
          <div className="border-t border-white/5 pt-3 space-y-3">
            <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold font-heading">
              Field Assets (2D/3D)
            </span>
            
            <div className="space-y-3">
              {/* 3D Model Upload */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                  3D Field Model (.glb, .gltf)
                </label>
                <input
                  type="file"
                  accept=".glb,.gltf"
                  onChange={handleGlbFileChange}
                  className="w-full text-[10px] text-marble/55 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-ares-gold file:text-black hover:file:bg-ares-gold-soft file:cursor-pointer cursor-pointer bg-black/30 p-1.5 rounded-lg border border-white/5 focus:outline-none"
                />
                {(localGlbFile || hasGlbUrl) && (
                  <p className="text-[8px] font-mono text-ares-success mt-0.5">
                    ✓ 3D Model GLB loaded
                  </p>
                )}
              </div>

              {/* 2D Background Upload */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                  2D Field Image (.png, .jpg)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBgFileChange}
                  className="w-full text-[10px] text-marble/55 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-ares-gold file:text-black hover:file:bg-ares-gold-soft file:cursor-pointer cursor-pointer bg-black/30 p-1.5 rounded-lg border border-white/5 focus:outline-none"
                />
                {(localBgFile || hasBgImageUrl) && (
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <p className="text-[8px] font-mono text-ares-success">
                      ✓ 2D Background loaded
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (bgImage) {
                          setRawUploadedImage(bgImage);
                          setShowCropModal(true);
                        } else {
                          alert("No background image currently loaded in cache.");
                        }
                      }}
                      className="text-left text-[8.5px] font-black uppercase text-ares-gold hover:text-ares-gold-soft tracking-wider cursor-pointer"
                    >
                      Adjust Crop & Alignment
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleSaveToCloud}
              disabled={saving}
              className="w-full bg-ares-gold text-black hover:bg-ares-gold-soft py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw size={12} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={12} /> Save Layout
                </>
              )}
            </button>

            <button
              onClick={handleDeleteLayout}
              disabled={!selectedConfigId || loading}
              className="w-full bg-ares-red/10 hover:bg-ares-red/20 text-ares-red-light border border-ares-red/20 py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-20 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
