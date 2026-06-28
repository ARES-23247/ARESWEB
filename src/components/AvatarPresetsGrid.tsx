import React from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";

interface AvatarPresetsGridProps {
  styleMode: "bottts" | "avataaars";
  setStyleMode: (val: "bottts" | "avataaars") => void;
  avaState: any;
  setAvaState: (val: any) => void;
  botState: any;
  setBotState: (val: any) => void;
  AVATAAARS_OPTIONS: any;
  BOTTTS_OPTIONS: any;
}

export default function AvatarPresetsGrid({
  styleMode,
  setStyleMode,
  avaState,
  setAvaState,
  botState,
  setBotState,
  AVATAAARS_OPTIONS,
  BOTTTS_OPTIONS
}: AvatarPresetsGridProps) {
  const renderSelect = (label: string, value: string, options: string[], onChange: (val: string) => void) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider pl-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-ares-gold/50 focus-visible:ring-2 focus-visible:ring-ares-cyan appearance-none custom-select"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-obsidian">
            {opt.replace(/([A-Z0-9])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
          </option>
        ))}
      </select>
    </div>
  );

  const renderColorSelect = (label: string, value: string, options: string[], onChange: (val: string) => void) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider pl-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((hex: string) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange(hex)}
            className={`w-7 h-7 rounded-lg border-2 transition-all ${value === hex ? "border-white scale-110 shadow-lg" : "border-transparent hover:border-white/60"}`}
            style={{ backgroundColor: `#${hex}` }}
            aria-label={`Color #${hex}`}
          />
        ))}
      </div>
    </div>
  );

  const renderToggle = (label: string, value: boolean, onChange: (val: boolean) => void) => (
    <div className="flex items-center justify-between py-2">
      <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{label}</label>
      <button type="button" onClick={() => onChange(!value)} className="text-white">
        {value ? <ToggleRight size={28} className="text-ares-red" /> : <ToggleLeft size={28} className="text-white/60" />}
      </button>
    </div>
  );

  return (
    <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
      {/* Archetype Selector */}
      <div className="flex bg-black/50 p-1 rounded-xl mb-4 md:mb-6 border border-white/5">
        <button
          type="button"
          onClick={() => setStyleMode("avataaars")}
          className={`flex-1 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${styleMode === "avataaars" ? "bg-ares-red text-white shadow-lg" : "text-white/60 hover:text-white"}`}
        >
          👤 Human
        </button>
        <button
          type="button"
          onClick={() => setStyleMode("bottts")}
          className={`flex-1 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${styleMode === "bottts" ? "bg-ares-gold text-black shadow-lg" : "text-white/60 hover:text-white"}`}
        >
          🤖 Robot
        </button>
      </div>

      {/* Dynamic Property Grids */}
      <div className="space-y-5">
        {styleMode === "avataaars" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {renderSelect("Hair Style", avaState.top, AVATAAARS_OPTIONS.top, (val) => setAvaState({...avaState, top: val}))}
              {renderSelect("Eyes", avaState.eyes, AVATAAARS_OPTIONS.eyes, (val) => setAvaState({...avaState, eyes: val}))}
              {renderSelect("Eyebrows", avaState.eyebrows, AVATAAARS_OPTIONS.eyebrows, (val) => setAvaState({...avaState, eyebrows: val}))}
              {renderSelect("Mouth", avaState.mouth, AVATAAARS_OPTIONS.mouth, (val) => setAvaState({...avaState, mouth: val}))}
              {renderSelect("Clothing", avaState.clothing, AVATAAARS_OPTIONS.clothing, (val) => setAvaState({...avaState, clothing: val}))}
            </div>
            <div className="space-y-3">
              {renderColorSelect("Hair Color", avaState.hairColor, AVATAAARS_OPTIONS.hairColor, (val) => setAvaState({...avaState, hairColor: val}))}
              {renderColorSelect("Skin Tone", avaState.skinColor, AVATAAARS_OPTIONS.skinColor, (val) => setAvaState({...avaState, skinColor: val}))}
              {renderColorSelect("Clothes Color", avaState.clothesColor, AVATAAARS_OPTIONS.clothesColor, (val) => setAvaState({...avaState, clothesColor: val}))}
            </div>
            <div className="border-t border-white/5 pt-4 space-y-2">
              {renderToggle("Show Accessories", avaState.showAccessories, (val) => setAvaState({...avaState, showAccessories: val}))}
              {avaState.showAccessories && (
                <>
                  {renderSelect("Accessory Type", avaState.accessories, AVATAAARS_OPTIONS.accessories, (val) => setAvaState({...avaState, accessories: val}))}
                  {renderColorSelect("Accessory Color", avaState.accessoriesColor, AVATAAARS_OPTIONS.accessoriesColor, (val) => setAvaState({...avaState, accessoriesColor: val}))}
                </>
              )}
              
              {renderToggle("Show Facial Hair", avaState.showFacialHair, (val) => setAvaState({...avaState, showFacialHair: val}))}
              {avaState.showFacialHair && (
                <>
                  {renderSelect("Facial Hair Style", avaState.facialHair, AVATAAARS_OPTIONS.facialHair, (val) => setAvaState({...avaState, facialHair: val}))}
                  {renderColorSelect("Facial Hair Color", avaState.facialHairColor, AVATAAARS_OPTIONS.facialHairColor, (val) => setAvaState({...avaState, facialHairColor: val}))}
                </>
              )}
            </div>
          </>
        )}

        {styleMode === "bottts" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {renderSelect("Chassis", botState.face, BOTTTS_OPTIONS.face, (val) => setBotState({...botState, face: val}))}
              {renderSelect("Eyes", botState.eyes, BOTTTS_OPTIONS.eyes, (val) => setBotState({...botState, eyes: val}))}
              {renderSelect("Mouth", botState.mouth, BOTTTS_OPTIONS.mouth, (val) => setBotState({...botState, mouth: val}))}
              {renderSelect("Antenna", botState.top, BOTTTS_OPTIONS.top, (val) => setBotState({...botState, top: val}))}
              {renderSelect("Side Modules", botState.sides, BOTTTS_OPTIONS.sides, (val) => setBotState({...botState, sides: val}))}
              {renderSelect("Surface Texture", botState.texture, BOTTTS_OPTIONS.texture, (val) => setBotState({...botState, texture: val}))}
            </div>
            {renderColorSelect("Base Color", botState.baseColor, BOTTTS_OPTIONS.baseColor, (val) => setBotState({...botState, baseColor: val}))}
          </>
        )}
      </div>
    </div>
  );
}
