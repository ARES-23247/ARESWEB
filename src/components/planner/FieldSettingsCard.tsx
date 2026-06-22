import React from "react";
import { Settings, Plus } from "lucide-react";

interface FieldSettingsCardProps {
  season: string;
  setSeason: (season: string) => void;
  customBgName: string;
  handleCustomBgUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FieldSettingsCard({
  season,
  setSeason,
  customBgName,
  handleCustomBgUpload,
}: FieldSettingsCardProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
        <Settings size={14} /> Field Settings
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="field-season-select" className="text-[9px] font-mono uppercase text-marble/50 block mb-1">
            Field Season
          </label>
          <select
            id="field-season-select"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-full bg-obsidian border border-white/10 rounded px-2 py-1.5 text-xs text-white uppercase font-bold focus:outline-none animate-none"
          >
            <option value="decode">DECODE (25/26)</option>
            <option value="into_the_deep">Into The Deep (24/25)</option>
            <option value="centerstage">Centerstage (23/24)</option>
            <option value="powerplay">Powerplay (22/23)</option>
            <option value="blank_grid">Generic Grid (Blank)</option>
            {customBgName && <option value="custom">Uploaded: {customBgName}</option>}
          </select>
        </div>

        <div>
          <span className="text-[9px] font-mono uppercase text-marble/50 block mb-1">
            Upload Custom Image
          </span>
          <label
            htmlFor="custom-field-bg-upload"
            className="w-full bg-white/5 border border-white/10 border-dashed rounded px-2.5 py-1.5 text-xs text-marble hover:text-white hover:bg-white/10 flex items-center justify-center font-bold cursor-pointer transition-all"
          >
            <Plus size={12} className="mr-1.5 text-ares-cyan" /> Upload Field
            <input
              id="custom-field-bg-upload"
              type="file"
              accept="image/*"
              onChange={handleCustomBgUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
export default FieldSettingsCard;
